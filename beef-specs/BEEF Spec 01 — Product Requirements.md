# BEEF Spec 01 — Product Requirements

Oct 26, 2026 · @Ayan

## Spec suite

BEEF is specified in six documents that replace all three source drafts. Where they conflict, the lower-numbered doc wins on *what* to build and the higher-numbered doc wins on *how*.

| # | Document | Owns | Primary reader |
| --- | --- | --- | --- |
| 01 | Product Requirements (this doc) | Vision, levels, navigation, core flows, brand, MVP cut, source audit | Founders, PM, design |
| 02 | [Game Catalog, Scoring & Economy](https://claude.ai/artifact/BfxspNvBbx1V5VR3tvmLmo) | Game engine contract, launch catalog, verification per game, XP/BP math, ratings, anti-cheat | Game design, engineering |
| 03 | [Technical Architecture](https://claude.ai/artifact/W7cAUAzSCUDdGvfeaQ7odA) | Client, backend services, data, real-time, media, AI, infra, security engineering | Engineering |
| 04 | [Trust, Safety, Privacy & Legal](https://claude.ai/artifact/WvgnWqWRB5CzpjiycibUiB) | Age assurance, ID and screening, emergency, moderation, CSAM, privacy law, gaming law, store rules | Founders, counsel, T&S |
| 05 | [Business, Venues & Go-to-Market](https://claude.ai/artifact/FeY7zPJdUm5Z3WYHVZu3Hm) | Venue program, B2B product, monetization, unit economics, launch market plan | Founders, BizDev, investors |
| 06 | [Delivery Plan](https://claude.ai/artifact/ShKv9RsnP2T7ip92kLkWzV) | Phases and gates, team, budget, QA, release criteria, risk register | Founders, eng lead, investors |

**Engineering build plan:** [Spec 07 — Build Plan: Bronze, Silver, Gold](https://claude.ai/artifact/1RZfGQp89XGCwSB7cVVpnv) turns Specs 01 to 06 into three build tiers and documents the working Bronze starter repository.

**Rules applied across the suite**

- Design choices in the sources (colors, fonts, mascot styling, animation names) are treated as provisional and marked *provisional*.
- Architecture and purpose/content choices from the sources are kept as requirements, and improved where a source choice was outdated, unsafe, or contradictory. Every such change is logged in the audit below.
- Every external fact (law, platform rule, vendor capability) was checked against current sources as of October 2026 and is cited in the doc that relies on it.
- Plain-language requirement levels: **must** (launch-blocking), **should** (target for the phase), **may** (optional).

## Source audit: what changed and why

The three source drafts contain a strong concept and a lot of usable detail, but 34 issues would have caused legal exposure, store rejection, wasted build time, or a broken economy. The highest-impact changes: BEEF launches **18+ only**, **Beef Points can never be bought, wagered, or won by chance**, **first in-person meets happen only at partner venues**, and the **release plan is re-based from stale 2025 dates to a November 2026 start**.

### Legal and safety corrections

| # | Source said | Problem | Resolution | Doc |
| --- | --- | --- | --- | --- |
| 1 | Level 1 open to all ages; COPPA safe-mode, parental dashboards, separate romantic pools for minors | Mixing minors into a stranger-matching app with romantic mode and in-person meets is the single largest safety and legal risk in the concept. The amended COPPA Rule has been enforceable since April 22, 2026, and Texas SB 2420 (app-store age verification and parental consent) is currently enforceable | Launch 18+ only. Age gate via Apple Declared Age Range and Google Play Age Signals plus selfie age estimation. No teen product until a separate, purpose-built one is approved | 04 |
| 2 | Background check (Checkr/Evident) before in-person meetings, implied as a safety guarantee | Match Group's background-check partnership with Garbo ended over cost and public-records quality; checks give false assurance. Texas Bus. & Com. Code ch. 106 dictates exact disclosures whether or not checks are run | ID + liveness verification for Level 4, sex-offender registry screen, optional consented check. Statutory Texas disclosures shipped either way. Never badge anyone "safe" | 04 |
| 3 | 911 quick-dial sends GPS, user ID, and last three chat images to servers "for subpoenas" | Apps cannot place 911 calls on a user's behalf; bulk-sending chat images is a privacy liability with no safety benefit | Native one-tap dial plus a professional dispatch integration (Noonlight-style) that relays location and the meet details the user entered | 04 |
| 4 | No NCII takedown process | TAKE IT DOWN Act enforcement began May 19, 2026: 48-hour removal of reported intimate images, open to non-users | Public takedown form, ticket IDs, hash-based duplicate removal, 48-hour SLA tracking | 04 |
| 5 | Generic "grooming model" | REPORT Act made CSAM, child sex-trafficking, and enticement reports to NCMEC mandatory with 1-year preservation | Hash matching on all uploads, NCMEC CyberTipline reporting runbook, 1-year evidence vault | 04 |
| 6 | "Wagered points" in challenges; poker chips convert 1:1 to BP; coin flip earns BP; BP redeemable for real goods | Something of value + chance + prize is the classic gambling test; also triggers store simulated-gambling rules | BP is earn-only and never staked. Chance games pay XP only. Stakes are cosmetic bragging rights | 02, 04 |
| 7 | Paid tournament buy-ins and prize pots | Texas AG opinion GA-0926 treats entry fees for pure skill or speed contests as likely not a bet, but other states differ and Apple requires licensing for real-money gaming | No paid entry at launch. Sponsor-funded prizes only. Paid skill tournaments gated on state-by-state counsel sign-off | 05 |
| 8 | Live-stream anything, including Level 4 in public venues | Bystanders in venues have not consented; strangers streaming each other | Streaming requires V2 verification, opponent consent, 30-second delay, and venue opt-in; bystander blur | 04 |
| 9 | Brass-knuckle logo backdrop, mascot holding brass knuckles | Weapon imagery contradicts "friendly rivalry" and safety positioning, and complicates college and venue partnerships and ad approvals | Provisional; recommend testing a non-weapon mark before committing | 01 |
| 10 | Game names: Uno-Lite, Battle Tetris, Connect 4, Wordle, Catan, Hacky-Sack, Frisbee, Hula-Hoop, Ping Pong; badge "Chopped" | All are registered trademarks of other companies | Generic names throughout catalog; trademark clearance on "BEEF" itself is an open decision | 02 |

### Product and economy corrections

| # | Source said | Problem | Resolution | Doc |
| --- | --- | --- | --- | --- |
| 11 | Three different tab bars, and the Matchmaking tab duplicates the Beefs tab ("shows active chats") | Contradiction; two tabs doing one job | One tab bar: Feed, Play, Match, Beefs, Profile | 01 |
| 12 | Level 2 Mind Games require full verification | Low-risk text games behind an ID wall kills activation | Verification tiers V0 to V3 matched to actual risk per level | 01, 04 |
| 13 | First doc puts billiards and bowling in Level 3 and 9-ball in Level 4 | Contradicts the four-level definition | Levels follow the premise: 1 phone, 2 mind, 3 physical (remote), 4 in person | 01 |
| 14 | 80+ games, 20 per level, at launch | Roughly 4 to 6 engineer-weeks per polished real-time game; this alone is years of work | 20-title beta catalog, 26 at v1 launch, on a shared engine; catalog grows by templates | 02 |
| 15 | Arm wrestling with the phone between elbows; AR thumb wrestling | Accelerometer cannot measure grip force; phone damage; camera cannot resolve thumb pins | Cut from Level 1. Arm wrestling moves to Level 4 with a referee | 02 |
| 16 | BP values differ for the same game across docs (RPS: 10 BP vs 10 per round + 20) | No economy model; BP redeemable for real goods would be farmed by colluding alts | One BP formula tied to verification strength, daily caps, venue-funded redemption | 02 |
| 17 | Battle Pass $4.99/mo and Pro $4.99/mo listed as separate products | Duplicate price point, confusing offer | Two tiers: BEEF Pro and BEEF Champion; seasonal cosmetics track inside Pro | 05 |
| 18 | "Chopped" badge for >65% losses; "D1 Instigator" for most challenges sent | Public shaming badge drives churn; rewarding volume rewards spam and harassment | Chopped becomes opt-in and renamed; Instigator counts *accepted* challenges | 02 |
| 19 | Level 4 venues arrive in Phase 4 (month 16+) | Venues are the business model and Victor is a core persona | Manual venue pilot with 5 to 10 Dallas venues during beta | 05, 06 |
| 20 | Swipe and game queue blur together | Two different systems: social matching vs skill pairing | Specified separately: Match (people) and Play queue (games) | 01, 03 |

### Technical corrections

| # | Source said | Problem | Resolution | Doc |
| --- | --- | --- | --- | --- |
| 21 | Reanimated 2; Framer Motion | Reanimated 2 is several majors behind; Framer Motion is a web library | Reanimated 4 + React Native Skia on the New Architecture | 03 |
| 22 | Expo EAS, unspecified versions | Expo SDK 58 (React Native 0.88) shipped Oct 2026 | Pin to current SDK at kickoff, upgrade each SDK cycle | 03 |
| 23 | MoveNet for pose | Ecosystem has moved to MediaPipe Pose Landmarker (33 landmarks) on LiteRT | MediaPipe Pose Landmarker on device; server re-check | 03 |
| 24 | reCAPTCHA v3 on mobile auth | Built for web; weak signal in native apps | Apple App Attest and Google Play Integrity; reCAPTCHA only on web surfaces | 03 |
| 25 | SKAN v4 pipelines | Apple's successor framework is AdAttributionKit | AdAttributionKit plus SKAN interop | 03 |
| 26 | Whisper-v3 "toxicity classifier" | Whisper is speech-to-text, not a classifier | Speech-to-text, then text classifiers | 03 |
| 27 | GraphQL (Apollo) in one doc, REST in another; Socket.IO vs Phoenix; MongoDB vs DynamoDB vs ClickHouse vs Snowflake; Cognito vs custom auth | Each source picked differently | One decision each, logged in 03 with rationale | 03 |
| 28 | Level 3 cheat detection: timecode watermark + accelerometer hash | A propped-up phone's accelerometer records nothing about the athlete | In-app capture only, server-issued on-screen challenge code, device attestation, pose AI, peer dispute | 02, 03 |
| 29 | "60 fps for modern OLEDs" | Current flagship displays run up to 120 Hz | Match display refresh rate, floor of 60 fps, reduce-motion honored | 01 |
| 30 | Rollback netcode for 8-ball | 8-ball is turn-based; rollback is for real-time action games | Server-authoritative turns; rollback only for real-time titles | 03 |
| 31 | Release gates: prototype July 2025, launch Dec 2025, SOC 2 Oct 2025 | All dates are in the past | Re-based plan starting November 2026 | 06 |
| 32 | Apple external payments ignored | US external purchase links are allowed; the commission is still being litigated | In-app purchase by default; web checkout behind a flag | 05 |
| 33 | Primary red #E63946 for small text everywhere | Contrast is about 3.9:1 on the light token, failing WCAG AA for body text | Red reserved for large text, fills, and icons on light surfaces | 01 |
| 34 | Microservice sprawl in five languages from day one | Hiring and operating cost for a seed-stage team | Same stack, phased: fewer deployables at MVP, split as load proves it | 03 |

## Vision and positioning

BEEF is a mobile app (iOS and Android) that turns meeting people into a game: you find people nearby, challenge them, and the relationship grows as the stakes move from a phone game to a face-to-face match at a local venue. It is *Tinder meets GamePigeon meets TikTok*, with a business engine that sends players to bowling alleys, bars, and arcades.

**The problem.** Opening lines are awkward, dating apps feel transactional, and "want to hang out?" has no hook. A challenge is a better icebreaker than a bio: it gives two strangers something to do, something to talk about, and a natural reason to meet.

**The escalation ladder is the product.** Each level asks for a little more trust and gives a little more reward:

1. **Shade** (Level 1): play a phone game in chat. Zero risk.
2. **Now It's Personal** (Level 2): get-to-know-you mind games. You learn about each other.
3. **Prove It!** (Level 3): physical challenges recorded on camera. You see each other.
4. **BEEF!** (Level 4): meet in person at a partner venue. The payoff, for the users and for the venue.

### North-star goals

| Goal | What it means in the product | Measured by |
| --- | --- | --- |
| Connect people through competitive play | Every match starts with a game, not a pickup line | Match to first game played within 24 h |
| Foster safe, meaningful relationships | Platonic, romantic, professional, and hobby intents, each with its own pool and color | Level 4 meets per active pair; safety incident rate |
| Create a new genre of social content | Rivalries, rematches, and side-by-side proofs as watchable posts and streams | Share rate of result cards; feed watch time |
| Two-sided ecosystem | Points and perks for players; verified foot traffic and data for venues | Venue-attributed visits per month |
| Global scale, hyper-local feel | Region-scoped leaderboards, venues, and feeds that localize automatically | Share of matches within 25 miles |

### Non-goals (v1)

- No users under 18. No teen mode.
- No real-money wagering, cash prizes from entry fees, or purchasable points.
- No meeting a stranger at a private location through BEEF; first in-person meets are at partner venues.
- No web app for players at launch (venue portal and admin are web).
- No user-generated games or open game SDK in v1 (moderated question decks are allowed).

## Personas

The five source personas stand, with one change: the college persona is moved from 20 to 19+ to reflect the 18+ floor, and each persona now names the level where BEEF wins them.

| Persona | Who | Job to be done | Wins at | Must never happen |
| --- | --- | --- | --- | --- |
| Casual Gamer Claire | 19, college sophomore, Dallas | Meet people on campus without the pressure of a party | Levels 1 to 2, then campus venue nights | Getting matched with someone far older under a platonic intent |
| Fitness Junkie Jay | 30, tech professional | Accountability partners for weekly physical challenges | Level 3 streaks and rematches | Losing to someone who faked a video |
| Social Butterfly Bella | 27, extrovert | Low-pressure dates that start with a game | Romantic intent, Levels 2 and 4 | Meeting someone in an unsafe place, or being followed |
| Venue Owner Victor | Bowling alley GM | Fill weekday lanes with verified, paying groups | Level 4 bookings, Tuesday-night promos | No-shows holding reserved lanes |
| Streamer Sam | Twitch partner | Audience-driven challenges and hype tools | Live dual-streams, viewer polls, tournaments | Raids and harassment in his chat |

Two personas are added because the business depends on them:

- **Campus Organizer Olivia** (student activities or Greek life chair): runs welcome-week and mixer brackets; needs group sign-up, team brackets, and an organizer view. She is the cheapest acquisition channel BEEF has.
- **Trust & Safety Tess** (internal moderator): needs a queue that shows context, history, and severity in one screen, and tools that act in seconds. Every safety requirement in Spec 04 is written for her.

## The four levels and verification tiers

Levels describe *how* people compete; verification tiers describe *who* is allowed to. The source tied "verified users" to Levels 2 to 4 as one gate. This spec replaces that with four tiers so each level asks only for the trust its risk requires.

### Verification tiers

| Tier | How a user gets it | Unlocks |
| --- | --- | --- |
| V0 Registered | Phone OTP, Sign in with Apple or Google, store age signal says 18+ | Browse, Level 1 vs. friends, feed viewing |
| V1 Real person | Selfie liveness check + photo match to profile photos | Match tab, chat with non-friends, Levels 1 and 2 with anyone, posting |
| V2 Verified ID | Government ID + liveness via identity vendor; name and DOB stored as a token, not the image | Level 3 media challenges, going live, romantic intent |
| V3 Meet-ready | V2 + sex-offender registry screen + emergency contact set + safety brief completed; optional consented background check | Level 4 in-person challenges and reservations |

V-tier badges show only the tier, never the result of a check. A V3 badge means "verified and screened," not "safe." (Required disclosures: Spec 04.)

### Levels

| Level | Name | What it is | Min tier | Proof of result | Typical session |
| --- | --- | --- | --- | --- | --- |
| 1 | Shade | Phone games played inside chat or full screen, turn-based or real-time | V0 (friends), V1 (anyone) | Server-authoritative game state | 1 to 10 min |
| 2 | Now It's Personal | Get-to-know-you and mental-skill games | V1 | Server-scored, or mutual confirm for opinion games | 3 to 10 min |
| 3 | Prove It! | Physical challenges done remotely, captured on camera | V2 | In-app capture + pose AI + opponent review | 1 to 5 min, async within 48 h |
| 4 | BEEF! | Meet in person at a partner venue | V3, both players | Venue staff QR scan + both players confirm, or venue system feed | 30 to 120 min |

### Rules that apply across levels

- **Formats:** 1v1, 2v2, 3v3, and free-for-all where the game supports it. Users can belong to any number of teams, or none.
- **Escalation is invited, never forced.** Moving a pair from Level 2 to Level 4 requires both to accept, and either can step back down at any time without penalty.
- **First meet rule:** the first Level 4 meet between two people who met on BEEF must be at a Safe-Beef Certified partner venue. After two completed venue meets, they may choose any public venue BEEF lists.
- **Chaperone and referee:** any Level 3 or 4 challenge can add up to two friends as referees. Referees see the challenge, can verify a result, and earn the *Ref, Do Something!* badge progress.
- **Intent travels with the challenge.** Every challenge carries the sender's intent (platonic, romantic, both), shown by color, and cannot be sent across an intent the recipient has excluded.

## Navigation

One bottom tab bar with five tabs replaces the three conflicting versions in the sources. The center tab is the swipe deck because a new challenge is the action that creates every other kind of activity.

| Position | Tab | Icon (provisional) | Job | Replaces in sources |
| --- | --- | --- | --- | --- |
| 1 | Feed | Sunglasses | Friends, Following, Region Trending, For You; stories row; live now | Feed |
| 2 | Play | Controller / compass | Game browser by level, quick-match queue, venue list and map for Level 4, tournaments | Discover, Game Browser |
| 3 | Match | Boxing glove | Swipe deck of nearby people; incoming challenges; who accepted you | Matchmaking (minus the duplicated chat list) |
| 4 | Beefs | Chat bubble with "#!@&%" | All chats: 1:1, group (up to 20), team, event threads; games embedded inline | Beefs, Chats |
| 5 | Profile | Silhouette | Public profile, stats, achievements, leaderboards (solo, duo, team), teams, safety center, settings | Profile, Leaderboards |

Persistent elements outside the tabs:

- **Shield button** in every Level 3 and 4 screen and every chat with a non-friend: opens the safety sheet (check-in, share location, alert contacts, emergency). Long-press triggers emergency directly.
- **Notification inbox** in the Feed header.
- **Chief Beef** (mascot) delivers tutorials, empty states, and system messages; never used for safety or legal copy, which stays plain.

## Core flows

### Onboarding (target: first game played in under 3 minutes)

The source's 7-step flow asked for ID before the user had any reason to care. The new flow front-loads fun and defers verification until a feature needs it.

1. **Welcome:** short looping montage, *Get Started*, *Sign in*. Sign in with Apple, Google, or phone number (Apple requires Sign in with Apple when other social logins are offered).
2. **Age check:** read the store age signal; if unavailable or under 18, run selfie age estimation; under 18 ends here with a friendly exit.
3. **Basics:** first name, username, birthday, one photo or avatar.
4. **Interests:** tap game categories and vibe tags (outgoing, chill, city, outdoors, competitive, casual). These feed both swipe affinity and game recommendations.
5. **Intent and privacy defaults:** platonic / romantic / both (color-coded), who can challenge me, who can see my profile. Privacy defaults are the most private option.
6. **Test drive:** a 60-second Level 1 game against Chief Beef. First win shows the BP and XP animation.
7. **Permissions in context:** location asked when the user opens Match; notifications asked after the first challenge is sent; camera asked at first Level 3.
8. **Verification on demand:** V1 liveness prompted when the user first swipes; V2 when they first try Level 3 or going live; V3 setup when they first open Level 4.

Tutorial carousel from the source is replaced by contextual coach marks, one per screen on first visit, skippable.

### Match: swipe to challenge

1. Deck shows nearby profiles filtered by intent, age range, distance (1 to 50 miles), and tier. Cards show photo, first name, age, distance bucket (never exact), top games, prompts, and V-tier badge.
2. **Left** skips. **Right** sends a default challenge: the recipient's favorite Level 1 or 2 game. **Tap the glove** opens the custom challenge builder: game, level, format, time, venue (Level 4), and a cosmetic stake.
3. A challenge sits in the recipient's *Incoming* list for 72 hours. Accepting opens a chat with the game already loaded. Mutual right-swipes open a chat immediately.
4. Daily right-swipe cap (free: 50; Pro: unlimited) limits spam. Repeated ignored challenges to the same person are blocked after one.
5. If nobody is nearby after 3 minutes of browsing, the deck widens radius, then offers cross-region Level 1 and 2 only.

### Play: game queue (separate from Match)

1. Pick a game card (name, level, format, avg duration, queue time, skill tag, *Learn* button).
2. *Quick match* enters the region-scoped skill queue; *Challenge a friend* or *Challenge someone on the leaderboard* sends a direct challenge.
3. Queue widens skill band every 15 s and falls back to cross-region after a configurable time (default 90 s) for Levels 1 and 2.
4. Level 4 cards open the venue picker: list and map of partner venues offering that game, with open slots.

### Challenge lifecycle (all levels)

Discover → Learn → Challenge or queue → Accept → Play → Verify → Result → Share → Reward → Rematch. The state machine, timeouts, and dispute rules are specified in Spec 02.

### Beefs: chat

- Thread types: 1:1, group (up to 20), team, event (auto-created per Level 4 booking, with the venue and referees).
- Inline game cards per level: L1 *Take turn*, L2 *Answer*, L3 *Upload proof* and side-by-side compare, L4 *Check in*, *Start stream*, *Confirm score*.
- Media: photos, short video, voice notes, GIFs and stickers. Read receipts and typing indicators, each user-controllable.
- Location sharing: off by default; per-chat, time-boxed (1 h, until the event ends), revocable.
- Auto-translate per message, toggled per chat.
- Safety: unsolicited-image blur by default; "Does this bother you?" prompt on flagged messages; one-tap report and block.

### Feed and stories

- Sorts: Friends, Following, Region Trending, For You.
- Card types: result recap, rivalry tracker (head-to-head history), side-by-side Level 3 proof, Level 4 photo carousel, achievement, venue event, live now.
- **Dual live stream:** two opponents on split screen; viewers react, vote on the winner (for fun, never deciding the official result), and suggest the next challenge from a preset list.
- Stories: 24 h, 15 s per frame, poll and quiz stickers, viewer list.
- Every result card has *Rematch* (or *Get your get-back* if the viewer lost the last one).

### Profile

- Public: nickname, photos, bio, up to three Hinge-style prompts, games of preference, strengths and weaknesses (self-declared and stats-derived), featured achievements (up to 5), V-tier, intent color.
- Stats: per-game rating, win/loss, streaks, head-to-head records, solo / duo / team leaderboards.
- Relationship stats (private by default): platonic vs romantic matches, Level 4 meets, rematch rate.
- Teams: create, invite, captain role, team leaderboard, team chat.
- Safety center: emergency contacts, check-in schedule, blocked users, verification status, data download and delete.

## Brand system and UI principles

Everything in this section is *provisional* design direction from the sources, kept as the starting brief for a brand designer. Only the accessibility and performance rules are requirements.

### Voice

Confident, playful, slightly provocative; trash talk is welcome, hate is not. All system copy passes inclusive-language review. Safety, legal, and payment copy is always plain and never jokey.

### Taglines (provisional)

Primary: **BEEF! Conquer your hometown.** Secondary: *Settle scores* · *Watch or fight* · *Become the hero of your hometown* · *Tap in, throw down* · *Anyone. Any time. Any place.* Retire *End battles before they start*; testing should confirm whether people read it as anti-competition.

### Lexicon (provisional)

| Phrase | Used for |
| --- | --- |
| Squash that Beef! | Game start / challenge accepted |
| Settle the score! | Opening a turn-based game in chat |
| Get your get-back | Rematch CTA when the viewer lost the last meeting |
| Even the odds | Comeback prompt when losing |
| Gloves Off | Level-up and tier-up animation |

### Visual tokens (provisional) and contrast

| Token | Hex | Contrast on Midnight Black | Allowed use |
| --- | --- | --- | --- |
| Primary Red | #E63946 | about 4.7:1 | Buttons, fills, large text, icons. Not for body text on light backgrounds (about 3.9:1) |
| Electric Blue | #1FA2FF | about 7.1:1 | Links, platonic intent |
| Neon Lilac | #BC4AFE | about 5.1:1 | Highlights, "both" intent |
| Midnight Black | #0B0D17 | n/a | Dark theme background |
| High-Viz White | #F5F7FA | n/a | Light theme background, text on dark |

Intent colors from the source (blue, pink, purple) must never be the only signal: each also gets an icon and label for color-blind users. Fonts: Bebas Neue (display), Inter (body). JetBrains Mono is dropped; there is no developer community surface in v1.

### Logo and mascot

Two competing directions exist: a bull-snout exclamation point, and a brass-knuckle backdrop. This spec recommends the bull direction for the app icon and the mascot (Chief Beef, a cel-shaded bull referee) and testing a non-weapon variant before committing to brass knuckles. The mascot appears in onboarding, tutorials, empty states, and celebrations, not in safety flows.

### Motion and performance rules (requirements)

- Animate at the display's refresh rate (up to 120 Hz on supported devices), never below 60 fps on the reference mid-tier Android device.
- Every decisive moment has an animation and a lexicon line: challenge sent, accepted, win, loss, level-up, rematch, streak.
- Screen shake and flashing effects respect the OS reduce-motion setting and an in-app toggle; no flashes above 3 per second.
- WCAG 2.2 AA: dynamic type, 44 pt touch targets, screen-reader labels on every game control, haptics never the only feedback.

## MVP scope, metrics, open decisions

The MVP is the smallest product that proves the escalation ladder in one city: people match, play, and end up at a venue. Dallas–Fort Worth is the launch market (venue outreach and campuses are local; Texas law is already mapped).

### MVP in and out

| In the MVP (Dallas beta) | Deferred |
| --- | --- |
| Onboarding, V0 to V3 verification | Teen product (not planned) |
| Match swipe + challenge builder | Ticketed (paid) live streams |
| 12 Level 1 and 2 titles, 4 Level 3, 4 Level 4 | Paid tournaments and prize pools |
| Chat with inline games, media, translation | Custom game creation |
| Feed, stories, result cards, rematch | Global availability and localization beyond English and Spanish |
| Level 4 with 5 to 10 pilot venues, manual ops allowed | Venue self-serve API integrations |
| Safety center, emergency, moderation, takedown | Ads |
| BEEF Pro subscription | BEEF Champion tier |

### Success metrics

| Metric | Beta target | Why it matters |
| --- | --- | --- |
| Activation: first game within 24 h of install | 60% | Proves the hook |
| Match to first game played | 50% | Challenges beat bios |
| D1 / D7 / D30 retention | 40% / 20% / 10% | Category benchmarks for social apps |
| Level ladder: pairs reaching Level 2 / Level 4 | 30% / 5% | Proves escalation |
| Venue-attributed visits per pilot venue per month | 40 | Proves the B2B model to Victor |
| Safety incidents (reported harm) | under 0.2 per 1,000 sessions | Source target, kept |
| Report-to-action time, high severity | under 1 h | Trust |

Targets are hypotheses to be re-set after four weeks of beta data.

### Open decisions

- [ ] Trademark clearance for "BEEF" in app stores, Class 9 and 41, and a fallback name
- [ ] Logo direction: bull vs brass knuckles (user testing in Phase 0)
- [ ] Whether romantic intent ships in the beta or one month after (safety team readiness)
- [ ] Launch cities after Dallas: Austin and Houston (source) vs a college town
- [ ] Identity vendor final pick (Persona, Stripe Identity, or Onfido; see Spec 04)

### Sources

- [Texas SB 2420 status tracker](https://texasdatalaw.com/tracker/sb-2420/) and [Supreme Court denial](https://www.infolawgroup.com/insights/2026/7/7/supreme-court-clears-the-way-texass-app-store-accountability-act-is-now-enforceable)
- [Amended COPPA Rule, Federal Register](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule)
- [FTC begins enforcing the TAKE IT DOWN Act](https://www.ftc.gov/news-events/news/press-releases/2026/05/ftc-begins-enforcing-take-it-down-act)
- [REPORT Act, Public Law 118-59](https://www.congress.gov/118/plaws/publ59/PLAW-118publ59.htm)
- [Garbo ends Match Group partnership (TechCrunch)](https://techcrunch.com/?p=2584559)
- [Tex. Bus. & Com. Code §106.005](https://texas.public.law/statutes/tex._bus._&_com._code_section_106.005)
- [Texas AG Opinion GA-0926](https://www.oag.state.tx.us/opinions/greg-abbott/ga-0926)
- [Noonlight dispatch API for dating apps](https://www.noonlight.com/blog/whats-missing-from-todays-dating-apps)
- [Expo SDK 58 upgrade guide](https://expo.dev/blog/how-to-upgrade-to-sdk-58.md)
- [MediaPipe Pose Landmarker](https://developers.google.cn/mediapipe/solutions/vision/pose_landmarker)
- [AdAttributionKit and SKAdNetwork](https://ppc.land/skadnetwork/)
- [Apple Declared Age Range expansion](https://www.helpnetsecurity.com/?p=358863) and [Google Play Age Signals global rollout](https://betanews.com/article/google-play-age-signals-api-global-rollout/)
- [Epic v. Apple commission status](https://thenextweb.com/news/supreme-court-apple-epic-contempt-app-store-commission)
