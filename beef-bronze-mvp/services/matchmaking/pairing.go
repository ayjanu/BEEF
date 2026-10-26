package main

import (
	"math"
	"sort"
	"time"
)

// Ticket is one player waiting in a queue for one game in one region.
type Ticket struct {
	UserID     string
	Rating     float64
	RD         float64 // Glicko-2 rating deviation: how unsure we are of Rating
	EnqueuedAt time.Time
}

const (
	// MinBand is the narrowest window, used for well-established players.
	MinBand = 100.0
	// WidenPer15s is how much the window grows for every 15 seconds of waiting.
	WidenPer15s = 50.0
	// MaxBand caps widening. A 400-point gap is roughly a 90% expected win for
	// the favorite; Spec 02 forbids pairing beyond that unless both opt in.
	MaxBand = 400.0
)

// Band returns how far apart two players' ratings may be.
//
// Spec 02: "start at ±1 deviation band, widen every 15 s". The starting width
// is the combined rating deviation of the two players, so new players (high
// deviation, ratings still moving fast) pair widely right away, while
// established players get tight, fair games. A fixed starting band would make
// two new players who just played each other wait over a minute.
func Band(wait time.Duration, rdA, rdB float64) float64 {
	start := math.Max(MinBand, math.Hypot(rdA, rdB))
	steps := math.Floor(wait.Seconds() / 15)
	return math.Min(start+WidenPer15s*steps, MaxBand)
}

// Pair greedily pairs neighbors in rating order. A pair is allowed when the
// rating gap fits inside the band for the longer wait of the two. Each ticket
// is used at most once. Pure function: no Redis, fully unit-tested.
func Pair(tickets []Ticket, now time.Time) [][2]Ticket {
	sorted := append([]Ticket(nil), tickets...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].Rating < sorted[j].Rating })

	var pairs [][2]Ticket
	for i := 0; i+1 < len(sorted); {
		a, b := sorted[i], sorted[i+1]
		if a.UserID == b.UserID {
			i++
			continue
		}
		wait := now.Sub(a.EnqueuedAt)
		if w := now.Sub(b.EnqueuedAt); w > wait {
			wait = w
		}
		if math.Abs(a.Rating-b.Rating) <= Band(wait, a.RD, b.RD) {
			pairs = append(pairs, [2]Ticket{a, b})
			i += 2
		} else {
			i++
		}
	}
	return pairs
}
