// Command matchmaking runs BEEF's skill queue (Spec 03, "Play queue").
//
// Core API enqueues tickets over HTTP. A loop pairs compatible tickets every
// TICK and publishes each pairing to the Redis Stream `beef:matches`, where a
// core-api consumer group opens the game session. Queues live in Redis, so any
// number of matchmaking replicas can run; the atomic Lua removal guarantees a
// ticket is paired at most once even when replicas race.
package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	matchStream = "beef:matches"
	queuesSet   = "mm:queues"
	ticketTTL   = 10 * time.Minute
)

var (
	gameIDRe = regexp.MustCompile(`^[a-z0-9-]{2,40}$`)
	uuidRe   = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
)

func queueKey(game, region string) string { return "mm:q:" + game + ":" + region }
func ticketKey(user, game string) string  { return "mm:t:" + user + ":" + game }

// claim removes both tickets only if both are still queued, and publishes the match, atomically.
var claim = redis.NewScript(`
if redis.call('ZSCORE', KEYS[1], ARGV[1]) and redis.call('ZSCORE', KEYS[1], ARGV[2]) then
  redis.call('ZREM', KEYS[1], ARGV[1], ARGV[2])
  redis.call('DEL', KEYS[2], KEYS[3])
  redis.call('XADD', KEYS[4], 'MAXLEN', '~', 100000, '*', 'gameId', ARGV[3], 'region', ARGV[4], 'players', ARGV[5])
  return 1
end
return 0`)

type server struct {
	rdb           *redis.Client
	internalToken []byte
	log           *slog.Logger
}

type ticketRequest struct {
	UserID string  `json:"userId"`
	GameID string  `json:"gameId"`
	Rating float64 `json:"rating"`
	RD     float64 `json:"rd"`
	Region string  `json:"region"`
}

func (s *server) internal(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		got := []byte(r.Header.Get("x-internal-token"))
		if subtle.ConstantTimeCompare(got, s.internalToken) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "internal_only"})
			return
		}
		next(w, r)
	}
}

func (s *server) enqueue(w http.ResponseWriter, r *http.Request) {
	var t ticketRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&t); err != nil ||
		!uuidRe.MatchString(t.UserID) || !gameIDRe.MatchString(t.GameID) || t.Region == "" || t.Rating <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "validation_failed"})
		return
	}
	if t.RD <= 0 || t.RD > 350 {
		t.RD = 350 // unknown deviation: treat as a new player
	}
	ctx := r.Context()
	qk := queueKey(t.GameID, t.Region)
	_, err := s.rdb.TxPipelined(ctx, func(p redis.Pipeliner) error {
		p.ZAdd(ctx, qk, redis.Z{Score: t.Rating, Member: t.UserID})
		p.HSet(ctx, ticketKey(t.UserID, t.GameID), "enqueuedAt", time.Now().UnixMilli(), "region", t.Region, "rd", t.RD)
		p.Expire(ctx, ticketKey(t.UserID, t.GameID), ticketTTL)
		p.SAdd(ctx, queuesSet, qk)
		return nil
	})
	if err != nil {
		s.log.Error("enqueue failed", "err", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "queue_unavailable"})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"queued": true})
}

func (s *server) dequeue(w http.ResponseWriter, r *http.Request) {
	user := r.PathValue("userId")
	game := r.URL.Query().Get("gameId")
	if !uuidRe.MatchString(user) || !gameIDRe.MatchString(game) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "validation_failed"})
		return
	}
	ctx := r.Context()
	region, _ := s.rdb.HGet(ctx, ticketKey(user, game), "region").Result()
	if region != "" {
		s.rdb.ZRem(ctx, queueKey(game, region), user)
	}
	s.rdb.Del(ctx, ticketKey(user, game))
	writeJSON(w, http.StatusOK, map[string]any{"queued": false})
}

// tick runs one pairing pass over every known queue.
func (s *server) tick(ctx context.Context) {
	queues, err := s.rdb.SMembers(ctx, queuesSet).Result()
	if err != nil {
		s.log.Error("list queues", "err", err)
		return
	}
	now := time.Now()
	for _, qk := range queues {
		parts := strings.Split(qk, ":") // mm:q:<game>:<region>
		if len(parts) != 4 {
			continue
		}
		game, region := parts[2], parts[3]
		members, err := s.rdb.ZRangeWithScores(ctx, qk, 0, 499).Result()
		if err != nil || len(members) < 2 {
			continue
		}
		tickets := make([]Ticket, 0, len(members))
		for _, m := range members {
			user := m.Member.(string)
			fields, err := s.rdb.HMGet(ctx, ticketKey(user, game), "enqueuedAt", "rd").Result()
			if err != nil || fields[0] == nil {
				s.rdb.ZRem(ctx, qk, user) // ticket expired: drop the stale queue entry
				continue
			}
			ms, _ := strconv.ParseInt(fields[0].(string), 10, 64)
			rd := 350.0
			if fields[1] != nil {
				rd, _ = strconv.ParseFloat(fields[1].(string), 64)
			}
			tickets = append(tickets, Ticket{UserID: user, Rating: m.Score, RD: rd, EnqueuedAt: time.UnixMilli(ms)})
		}
		for _, p := range Pair(tickets, now) {
			players, _ := json.Marshal([]string{p[0].UserID, p[1].UserID})
			ok, err := claim.Run(ctx, s.rdb,
				[]string{qk, ticketKey(p[0].UserID, game), ticketKey(p[1].UserID, game), matchStream},
				p[0].UserID, p[1].UserID, game, region, string(players)).Int()
			if err != nil {
				s.log.Error("claim failed", "err", err)
				continue
			}
			if ok == 1 {
				s.log.Info("paired", "game", game, "region", region, "a", p[0].UserID, "b", p[1].UserID)
			}
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})).With("svc", "matchmaking")
	opts, err := redis.ParseURL(env("REDIS_URL", "redis://localhost:6379"))
	if err != nil {
		log.Error("bad REDIS_URL", "err", err)
		os.Exit(1)
	}
	token := os.Getenv("INTERNAL_TOKEN")
	if len(token) < 16 {
		log.Error("INTERNAL_TOKEN must be set (16+ chars)")
		os.Exit(1)
	}
	tickMs, _ := strconv.Atoi(env("TICK_MS", "250"))
	s := &server{rdb: redis.NewClient(opts), internalToken: []byte(token), log: log}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, map[string]bool{"ok": true}) })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if err := s.rdb.Ping(r.Context()).Err(); err != nil {
			writeJSON(w, 503, map[string]any{"ok": false})
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	mux.HandleFunc("POST /v1/tickets", s.internal(s.enqueue))
	mux.HandleFunc("DELETE /v1/tickets/{userId}", s.internal(s.dequeue))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		t := time.NewTicker(time.Duration(tickMs) * time.Millisecond)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				s.tick(ctx)
			}
		}
	}()

	srv := &http.Server{Addr: ":" + env("PORT", "8080"), Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
