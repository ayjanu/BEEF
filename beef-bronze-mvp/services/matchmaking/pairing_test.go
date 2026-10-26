package main

import (
	"testing"
	"time"
)

const settled = 50.0 // rating deviation of an established player

func TestBandStartsAtCombinedDeviationAndWidens(t *testing.T) {
	cases := []struct {
		wait     time.Duration
		rdA, rdB float64
		want     float64
	}{
		{0, settled, settled, MinBand},                // hypot(50,50)=70.7 -> floor of 100
		{14 * time.Second, settled, settled, MinBand}, // no widening before 15 s
		{15 * time.Second, settled, settled, 150},
		{45 * time.Second, settled, settled, 250},
		{0, 150, 200, 250},     // hypot(150,200)=250: uncertain players pair wider at once
		{0, 350, 350, MaxBand}, // brand-new players: capped
		{10 * time.Minute, settled, settled, MaxBand},
	}
	for _, c := range cases {
		if got := Band(c.wait, c.rdA, c.rdB); got != c.want {
			t.Errorf("Band(%v, %v, %v) = %v, want %v", c.wait, c.rdA, c.rdB, got, c.want)
		}
	}
}

func TestPairsCloseRatingsImmediately(t *testing.T) {
	now := time.Now()
	pairs := Pair([]Ticket{
		{UserID: "a", Rating: 1500, RD: settled, EnqueuedAt: now},
		{UserID: "b", Rating: 1550, RD: settled, EnqueuedAt: now},
	}, now)
	if len(pairs) != 1 {
		t.Fatalf("want 1 pair, got %d", len(pairs))
	}
}

func TestEstablishedPlayersFarApartWaitThenPair(t *testing.T) {
	now := time.Now()
	tickets := []Ticket{
		{UserID: "a", Rating: 1500, RD: settled, EnqueuedAt: now},
		{UserID: "b", Rating: 1720, RD: settled, EnqueuedAt: now},
	}
	if got := Pair(tickets, now); len(got) != 0 {
		t.Fatalf("a 220-point gap between settled players must not pair at once, got %d pairs", len(got))
	}
	if got := Pair(tickets, now.Add(45*time.Second)); len(got) != 1 {
		t.Fatalf("want 1 pair after 45s (band 250), got %d", len(got))
	}
}

func TestNewPlayersAfterOneGamePairImmediately(t *testing.T) {
	// Two new players right after their first game: ratings ~325 apart, deviations still ~290.
	now := time.Now()
	tickets := []Ticket{
		{UserID: "a", Rating: 1338, RD: 290, EnqueuedAt: now},
		{UserID: "b", Rating: 1662, RD: 290, EnqueuedAt: now},
	}
	if got := Pair(tickets, now); len(got) != 1 {
		t.Fatalf("uncertain ratings should pair at once, got %d pairs", len(got))
	}
}

func TestNeverPairsBeyondMaxBand(t *testing.T) {
	now := time.Now()
	tickets := []Ticket{
		{UserID: "a", Rating: 1000, RD: 350, EnqueuedAt: now.Add(-time.Hour)},
		{UserID: "b", Rating: 1500, RD: 350, EnqueuedAt: now.Add(-time.Hour)},
	}
	if got := Pair(tickets, now); len(got) != 0 {
		t.Fatalf("500-point gap must never auto-pair, got %d", len(got))
	}
}

func TestEachTicketUsedOnceAndSelfNeverPaired(t *testing.T) {
	now := time.Now()
	tickets := []Ticket{
		{UserID: "a", Rating: 1500, RD: settled, EnqueuedAt: now},
		{UserID: "a", Rating: 1500, RD: settled, EnqueuedAt: now},
		{UserID: "b", Rating: 1510, RD: settled, EnqueuedAt: now},
		{UserID: "c", Rating: 1520, RD: settled, EnqueuedAt: now},
		{UserID: "d", Rating: 1530, RD: settled, EnqueuedAt: now},
	}
	seen := map[string]bool{}
	for _, p := range Pair(tickets, now) {
		if p[0].UserID == p[1].UserID {
			t.Fatal("paired a user with themselves")
		}
		for _, tk := range p {
			if seen[tk.UserID] {
				t.Fatalf("user %s paired twice", tk.UserID)
			}
			seen[tk.UserID] = true
		}
	}
}
