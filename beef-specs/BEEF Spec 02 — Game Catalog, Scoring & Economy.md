# BEEF Spec 02 — Game Catalog, Scoring & Economy

Oct 26, 2026 · @Ayan

## Game framework contract

Every title, at every level, is a plug-in to one framework so the catalog can grow by configuration instead of bespoke builds. A new title is "done" only when it implements all nine parts below.

| Part | What the title provides | What the platform provides |
| --- | --- | --- |
| 1. Manifest | id, name, level, formats (1v1, 2v2, FFA), duration, skill tag, location tag, equipment icons, chance factor (none / low / high), min V-tier | Game card in Play, search, filters |
| 2. Rules module | Pure TypeScript functions: `init(seed, config)`, `validate(state, move)`, `apply(state, move)`, `result(state)`; run identically on client (prediction) and server (authority) | Versioned rules registry; replay from seed + move log |
| 3. Renderer | Full-screen view and compact chat-card view, built on React Native Skia | Theming tokens, haptics, sound bus, reduce-motion |
| 4. Tutorial | 3 to 5 coach steps, one looping demo, Chief Beef lines | Tutorial player, "Learn" button, completion tracking |
| 5. Verification method | One of: server-authoritative, mutual confirm, capture + AI + review, venue attest (see Verification) | Dispute queue, evidence store |
| 6. Scoring config | Win condition, tiebreak, per-game stats emitted | Rating update, XP and BP via the economy formula (never hard-coded per game) |
| 7. Media hooks | Moment markers (e.g. `decisive_shot`) for auto-clips | Clip generation, result card, side-by-side compositor |
| 8. Feed template | Which stats appear on the result card | Card rendering, share sheet, rematch CTA |
| 9. Telemetry | Game-specific events against the shared schema | Analytics pipeline, balance dashboards |

**Game card fields** (from the source, kept): title, level tag, player-count icons, average duration, skill level, location tag (home, bar, outdoors, venue), equipment icons, 3-second looping preview. **Added:** average queue time in your region, friends playing now, chance-factor icon.

**Real-time vs turn-based.** Turn-based titles (chess, 8-ball, word games) embed in chat and survive app backgrounding; a turn can wait up to 24 hours (configurable per game). Real-time titles (block battle, reflex games) run full screen with a 3-second reconnect grace and forfeit after 15 seconds offline.

## Challenge lifecycle

Every challenge, from a swipe or the queue, moves through one state machine. Nothing pays out until a result reaches Verified.

&#91;embedded content: challenge lifecycle · 11 states, one dispute loop\]

Timeouts: an unanswered challenge expires after 72 h; a Level 1 turn after 24 h (forfeit); Level 3 proof must be uploaded within 48 h of acceptance; a Level 4 no-show more than 20 minutes past the booking forfeits and releases the venue hold per the deposit rules in Spec 05. Either player may cancel before In play at no cost; cancelling after a Level 4 booking follows the venue's cancellation window.

## Result verification and disputes

A result only counts toward ratings, leaderboards, and Beef Points once it is verified. Verification strength sets how much a result is worth (the economy multiplier in Progression), so the easiest results to fake earn the least.

| Method | Used by | How it works | Strength multiplier |
| --- | --- | --- | --- |
| Server-authoritative | All Level 1, scored Level 2 (trivia, word, logic) | Server validates every move from a seeded state; client cannot report a result | 1.0 |
| Mutual confirm | Opinion Level 2 (Would You Rather, Two Truths) | Both players confirm; no rating change, XP only | XP only |
| Capture + AI + review | Level 3 | In-app camera only. Server issues a one-time on-screen code and a random start gesture (e.g. "touch left knee") that must appear in the first 3 s. On-device pose model counts reps; server re-runs the count on upload. Opponent has 24 h to accept or dispute | 0.8, or 1.0 with a referee |
| Venue attest | Level 4 | Staff scans the event QR at check-in and enters or confirms the score on the venue tablet, or the venue's own system (lane scoring, lap timer) posts it via API | 1.5 |
| Player attest | Level 4 at non-partner public venues (after 2 venue meets) | Both players confirm in app, optional referee; GPS check-in within 150 m | 0.5 |

### Dispute flow

1. Either player taps *Dispute* within 24 h (Level 3) or before leaving the venue geofence (Level 4).
2. Evidence is attached automatically: move log, capture, pose trace, venue entry, referee vote.
3. Auto-resolve if a referee or venue staff already attested; their call stands.
4. Otherwise a reviewer decides within 72 h. Outcomes: uphold, overturn, or void (no rating, XP refunded as participation).
5. A user with more than 3 overturned results in 30 days loses Level 3 ranked access for 14 days.

Viewer votes on live streams are entertainment only and never decide an official result.

## Launch catalog

The beta ships 20 titles and v1 ships 26, chosen for build cost, replay value, and how well each one fuels the escalation ladder. The other 60+ source titles stay in the backlog (next section) and are added roughly 2 per month after launch. Per-title Beef Point values are gone: every title uses the one economy formula in Progression.

### Level 1 "Shade": phone games

| Title | Phase | Format | Win condition | Key stats | Notes |
| --- | --- | --- | --- | --- | --- |
| Chess | Beta | 1v1 | Checkmate, resign, or flag. Modes: Classic 5+3, Bullet 1+0 | Rating, avg move time | Spectator "ghost mode" with optional engine bar, off in ranked |
| 8-Ball Pool | Beta | 1v1 | Race to 1 or 3 racks; standard or quick rules | Pot %, break success, fouls | Deterministic physics on server; client predicts |
| Four Up | Beta | 1v1 | Four in a row, 7x6 grid, 30 s turns | Avg moves to win | Renamed from Connect 4 |
| Word Blitz | Beta | 1v1, FFA | Most points in a 90 s, 4x4 letter grid | Words/min, longest word | Same seed for both players |
| Block Battle | Beta | 1v1 | Opponent tops out; line clears send garbage | Pieces/min, attack/min | Renamed from Battle Tetris; real-time |
| Dots and Boxes | Beta | 1v1 | Most boxes on 6x6 | Chain captures | Chat-embedded |
| Draw and Guess | Beta | 1v1, 2v2 | Most correct guesses in 3 rounds | Avg guess time | Drawings run through image moderation |
| Tap the Tile | Beta | 1v1 | Highest score in 30 s | Taps/s, accuracy | Same seed; real-time |
| Crazy Eights | v1 | 1v1 to 4 | First to empty hand | Draw rate | Replaces "Uno-Lite" |
| Five-Letter Duel | v1 | 1v1 | Solve the same hidden word in fewer guesses, then faster | Avg guesses | Replaces "Wordle" naming |

### Level 2 "Now It's Personal": mind games

| Title | Phase | Format | Win condition | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| Would You Rather | Beta | 1v1, group | No winner; compatibility score from matched answers | Mutual, XP only | 10 curated prompts per round; moderated user decks later |
| Two Truths and a Lie | Beta | 1v1, group | Most lies caught + most opponents fooled | Mutual | Statements screened for personal data (phone, address) |
| Trivia Burst | Beta | 1v1, FFA | Most correct, 12 questions, 10 s each | Server | Licensed or original question bank; category packs |
| 20 Questions | Beta | 1v1 | Guesser solves in 20 or fewer | Server (answer locked at start) | AI suggests questions on request |
| Vibe Check | v1 | 1v1 | No winner; radar chart of overlap | Mutual, XP only | Replaces "Personality Poll"; strong match-tab signal |

### Level 3 "Prove It!": physical challenges

All Level 3 titles require V2, an in-app capture of 15 to 60 s, the on-screen challenge code, and a one-time liability acknowledgment. Dangerous dares (heights, traffic, fire, water, stunts on vehicles) are banned by policy and auto-flagged.

| Title | Phase | Measure | AI counts it? | Notes |
| --- | --- | --- | --- | --- |
| 60-Second Push-Ups | Beta | Valid reps in 60 s | Yes (elbow angle, hip line) | Form overlay from Chief Beef in tutorial |
| Plank Hold | Beta | Seconds in valid plank | Yes (body-line angle) | Side camera view required |
| Wall Sit | Beta | Seconds with knee angle 80 to 100 degrees | Yes | Replaces source's accelerometer-in-pocket method |
| Bottle-Flip Streak | Beta | Landed flips in 60 s | No; opponent review | Classic share bait |
| Jump-Rope Count | v1 | Jumps in 30 s | Yes (foot lift cadence) |  |

### Level 4 "BEEF!": in person

| Title | Phase | Format | Result source | Notes |
| --- | --- | --- | --- | --- |
| Bowling | Beta | 1v1, teams | Staff confirm or scoring-monitor photo; lane-system API later | Hero journey; handicap optional |
| Pool (8- and 9-ball) | Beta | 1v1, 2v2 | Staff or referee confirm | 9-ball race to 5 per source |
| Darts (501, Cricket) | Beta | 1v1, 2v2 | Staff confirm; electronic board API later |  |
| Trivia Night | Beta | Teams up to 6 | Venue host enters team scores | Bar partners' weekly trivia becomes BEEF events |
| Axe Throwing | v1 | 1v1 | Staff confirm | Venue safety briefing is mandatory; no alcohol before throwing per venue rules |
| Table Tennis | v1 | 1v1, 2v2 | Staff or referee confirm | Renamed from "Ping Pong" |

## Source titles: backlog, changed, or cut

Every source title is accounted for in one of the buckets below. Backlog titles are ordered by expected value per build week.

| Bucket | Titles | Reason |
| --- | --- | --- |
| Backlog, Level 1 (post-v1) | Mini-Golf Rush, 2048 Duel, Space Shooter PvP, Memory Flip, Sudoku Race, Water Sort, Car Escape, Merge Duel | Good titles; real-time shooter and mini-golf physics are the costliest, so they come last |
| Backlog, Level 2 | Riddle Dash, Anagram Race, Category Sprint, Flag Match, Emoji Decode, Memory Numbers, Caption This (from Reaction GIF Caption), Build-A-Story, Quick Draw vs AI, Cipher Duel, Logic Grid, Debate (voice) | Debate needs live voice moderation first; Caption This needs a licensed GIF source |
| Backlog, Level 3 | Trick Shot, Pen Spin, Cup-Stack Speed, Yoga Hold, Sock Toss, Balloon Keep-Up, Footbag Juggles (from Hacky-Sack), Hoop Spin (from Hula-Hoop), High-Knee Count, Disc Accuracy (from Frisbee), Dance Replicate | Renamed where the source used a trademark; Dance needs licensed music |
| Backlog, Level 4 | Laser Tag, Mini-Golf, Escape Room, Karaoke, Archery, Go-Kart, VR Arena, Paintball, Board Game Night (generic, not "Catan"), Cornhole, Shuffleboard, Foosball, Scavenger Hunt, Photo Bingo, Charity Walk, Arm Wrestling (refereed) | Each needs a venue category partner; added as venues sign |
| Changed: XP only, no Beef Points | Texas Hold'em, Blackjack (rebuilt as Blackjack Duel: both players vs. the same shoe) | Chance-driven card games must never pay redeemable points |
| Changed: utility, not a game | Coin Flip, Rock-Paper-Scissors | Pure chance; used as a fair "Decider" (who picks the game, who breaks) with no rewards |
| Deferred for licensing | Music Snip-Guess, Film Buff Trivia, Quote Completion | Requires licensed audio, clips, or a cleared quote set |
| Cut | Arm Wrestling (phone between elbows), Thumb Wrestling (AR), Staring Contest (async), Step-Count Sprint, Squat-Jump Height, Paper-Airplane Distance, Sandfall | Sensors cannot measure the outcome reliably, the phone gets damaged, or the result is trivially faked (shaking a phone counts steps). Sandfall is a toy with no winner |

## Skill ratings and fair pairing

Use **Glicko-2** for 1v1 and **OpenSkill (Weng-Lin)** for teams and free-for-all, one rating per game per format. Plain Elo, as named in the sources, has no notion of uncertainty, which is exactly what the sources' "confidence interval for new players" and "placement matches" require.

- **Placement:** 5 placement games per title; rating deviation starts high so new players move fast.
- **Display:** players see a tier (Rookie, Contender, Champ, Legend) and a per-game rank badge, not raw numbers; numbers appear in the stats page.
- **Seasons:** every 12 weeks. Ratings soft-reset (deviation raised, mean pulled 25% toward the population mean), leaderboards reset, season cosmetics awarded.
- **Quick-match pairing:** start at ±1 deviation band, widen every 15 s; never pair players whose rating gap gives the favorite above 90% expected win, unless both opt in.
- **Swipe challenges are unranked by default.** A challenge between people who matched socially uses ratings only if both toggle *Ranked*. This stops people farming rating from new matches.
- **Smurf and sandbag signals:** new account win rate above 85% across 10 games, sudden rating drops just before tournaments, and many accounts on one device feed the Integrity score (Anti-cheat).

## Progression and economy

BEEF runs on three separate things that the sources blended together: **XP** (progress, unlimited, worthless outside the app), **Beef Points** (redeemable for real perks, so scarce and guarded), and **stakes** (bragging rights, never value). Most Beef Points are earned and spent at venues, which turns the economy into the venue flywheel instead of a liability.

### The three things players earn

|  | XP | Beef Points (BP) | Stakes |
| --- | --- | --- | --- |
| Earned by | Finishing any game, win or lose; tutorials; daily streaks | Verified results, venue check-ins, venue promos, referrals that reach V1 | Agreed before a challenge |
| Spent on | Nothing; drives account level 1 to 100 and titles | Venue perks (venue-funded), BEEF cosmetics, BEEF merch | Cosmetic only: loser wears the winner's chosen frame for 24 h, posts a concession card, or hands over a trophy |
| Buyable | No | **Never** | No |
| Transferable | No | No (no gifting, no tipping) | n/a |
| Paid by chance games | Yes | **No** | No |
| Expires | No | After 12 months of account inactivity (counsel to confirm notice rules) | 24 h display |

The source's "tipping streamers with Beef Points" is removed: transferable, redeemable points become a money-transmission and fraud channel. Streamer support moves to cosmetic gifts bought with real money through the store (Spec 05).

### Beef Point formula

```latex
BP = B_{level} \times O \times S \times D
```

| Term | Values |
| --- | --- |
| B (base by level) | L1: 10 · L2: 10 · L3: 20 · L4: 50 |
| O (outcome) | Win 1.0 · Draw 0.6 · Loss 0.3 |
| S (verification strength) | From the Verification table: 0.5 to 1.5; mutual-confirm games pay 0 |
| D (diminishing returns) | Same opponent, same day: 1st game 1.0 · 2nd 0.5 · 3rd 0.25 · 4th+ 0 |

**Venue actions** add flat BP: partner check-in +100, first visit to a new partner venue +100 bonus, venue-funded promos ("Tuesdays 2x") as configured by the venue.

**Daily caps:** Levels 1 and 2 combined 50 BP per day; Level 3 60 BP per day; Level 4 no daily cap, 300 BP per venue visit. A typical venue night (check-in + one win) earns 175 BP; a full day of phone games earns 50.

**Redemption value target:** 1,000 BP is worth about $5 of perk value. Most perks are venue-funded (free shoe rental, half-price wings) and cost BEEF nothing. BEEF-funded perks are budgeted monthly, and finance tracks the outstanding-points liability as balance × expected redemption rate × $/BP.

### Levels, ranks, and badges

- **Account level** (1 to 100) from XP; title unlocks at 10, 25, 50, 75, 100; *Gloves Off* animation on each level-up.
- **Rank tier per game** from rating: Rookie → Contender → Champ → Legend. The source's "VIP queue priority" perk for high tiers is dropped because it lengthens everyone else's queue.
- **Achievements:** tiered Bronze / Silver / Gold / Platinum, plus hidden ones. Featured up to 5 on profile.

| Badge | Rule | Change from source |
| --- | --- | --- |
| Top Dog | #1 on a regional leaderboard for a game in a weekly cycle | Kept |
| D1 Instigator | Most *accepted* challenges in your region in a month | Was "most sent"; that rewarded spam |
| Ref, Do Something! | 10 verified sessions as referee or chaperone | Kept |
| Cooked | Loss rate above 65% over 20+ games; hidden unless the user opts in to display it | Replaces "Chopped" (a TV-show trademark and a churn risk) |
| Get-Back Achieved | Win a rematch against someone who beat you last time | New; rewards the rematch loop |
| Hometown Hero | Level 4 wins at 5 different partner venues | New; ties to the primary tagline and venue goals |

## Anti-cheat and collusion

The largest economic threat is not hacked clients but two real accounts (or one person with two phones) feeding each other wins for redeemable points. Defenses are layered so no single check has to be perfect.

| Threat | Defense |
| --- | --- |
| Modified client sends fake moves | Server-authoritative rules; client sends intents only; impossible input timing (e.g. sub-80 ms reaction streaks) flagged |
| Engine assistance in chess | Move-match rate vs engine on ranked games above threshold → review; ranked only |
| Win trading between friends | Diminishing returns per opponent per day; BP-weighted graph analysis of who beats whom; clusters frozen pending review |
| Multi-accounting | One account per verified identity at V1+ (face template dedupe at the identity vendor); device attestation (App Attest, Play Integrity); device and payment fingerprint linking |
| Pre-recorded or edited Level 3 video | In-app capture only; one-time on-screen code + random start gesture; frame-timing and re-encode checks; server pose re-count |
| Fake Level 4 results | Venue attest or GPS-checked player attest; staff QR codes rotate every 30 s; venue-level anomaly checks (one venue issuing unusual BP volume) |
| Venue fraud (fake check-ins to farm promos) | Venue BP issuance capped per day; check-in must match a booking or a geofenced live session; audit clawback in MSA |
| Sandbagging before tournaments | Tournament seeding uses peak rating over 30 days, not current rating |

**Integrity score.** Each account carries a hidden 0 to 100 score built from the signals above. Below 60: BP earning pauses and redemptions need review. Below 30: ranked and Level 4 access suspended pending review. Every automated penalty is appealable, and the appeal is reviewed by a person.

**Sources consulted for this doc:** source catalogs (attached drafts); rating systems are standard published methods (Glicko-2 by Glickman; OpenSkill by Weng and Lin); gambling-element reasoning is detailed with citations in Spec 04.
