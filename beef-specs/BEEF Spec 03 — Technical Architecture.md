# BEEF Spec 03 — Technical Architecture

Oct 26, 2026 · @Ayan

## Architecture decisions

The source stack is kept: React Native + Expo, Kubernetes on AWS, NestJS + Postgres, Go + Redis matchmaking, Node game workers, Elixir Phoenix chat, LiveKit, Python FastAPI moderation, Stripe Connect. Where sources disagreed or named something outdated, one choice is made below. The main improvement is **phasing**: the same languages and services, but fewer deployables at MVP, split only when load proves it.

| Topic | Sources offered | Decision | Why |
| --- | --- | --- | --- |
| Client API | GraphQL (Apollo) vs REST paths | Revised in Spec 07: REST for the app with shared zod contracts (@beef/contracts) typed on both sides; OpenAPI generated from the same schemas for venue partners; WebSockets for real-time. GraphQL deferred until a non-TypeScript client or the feed's query shape needs it | Every Bronze client is TypeScript, so sharing the schemas catches breaking changes at compile time with less machinery than GraphQL or codegen |
| Real-time transport | Socket.IO vs Phoenix Channels; GraphQL subscriptions | Phoenix Channels for chat, presence, notifications. Dedicated game WebSocket for game sessions. No GraphQL subscriptions | One proven real-time layer; games need their own tick loop |
| Auth | AWS Cognito vs custom NestJS; bcrypt 12 | Custom auth service in NestJS: passkeys, Sign in with Apple and Google, phone OTP. Passwords optional, Argon2id if used | Verification tiers, device attestation, and account linking live in one service the team controls; Apple requires its sign-in when other social logins are offered |
| Primary database | Postgres | Amazon Aurora PostgreSQL | Kept; managed failover |
| Chat storage | DynamoDB vs MongoDB | DynamoDB (partition by thread, sort by time) | Kept from source; MongoDB dropped |
| Analytics | ClickHouse vs Snowflake vs "custom pipeline" | Event stream → S3 data lake → Snowflake; product analytics UI on top | One warehouse; Snowflake also powers partner data sharing |
| Search | ElasticSearch / OpenSearch | Amazon OpenSearch for user, venue, and feed search | Kept |
| Game engine | Node workers, "rollback netcode" for everything, Unity mini-games | Node workers running the shared TypeScript rules package; rollback only for real-time titles; no Unity in v1 | Unity-as-a-library embeds a second large runtime and build pipeline; Skia covers every 2D title in the catalog |
| Animation | Reanimated 2, Framer Motion | Reanimated 4 + React Native Skia + Lottie for mascot | Reanimated 2 is obsolete; Framer Motion is web-only |
| Pose AI | MoveNet | MediaPipe Pose Landmarker (on device) + server re-check | Current, 33 landmarks, better for form checks |
| Bot defense | reCAPTCHA v3 | Apple App Attest + Google Play Integrity in-app; reCAPTCHA Enterprise on web pages | reCAPTCHA is a web control |
| Ad attribution | SKAN v4 | AdAttributionKit with SKAdNetwork interop; server-side events | Apple's current framework |
| Feature flags | LaunchDarkly | LaunchDarkly | Kept |
| Deploy | GitHub Actions → ECR → ArgoCD | Kept | GitOps fits EKS |

## System at a glance

Three clients reach five services through one edge layer; media runs on managed LiveKit until volume justifies self-hosting.

&#91;embedded content: BEEF system at MVP · clients, edge, services, data, external\]

Core API is the source of truth for accounts, results, and the Beef Point ledger; every other service writes results back to it. External services are called from Core API and the safety workers only, never directly from the app, except store billing and LiveKit, which have client SDKs.

## Mobile client

One TypeScript codebase for iOS and Android, built with Expo (EAS) on the React Native New Architecture. Pin the Expo SDK current at kickoff (SDK 58 with React Native 0.88 as of October 2026) and upgrade once per SDK cycle.

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Expo SDK (current), React Native New Architecture, Hermes | Dev builds via EAS; Expo Go not used |
| Navigation | Expo Router with native tabs | Five tabs per Spec 01 |
| State | Redux Toolkit + RTK Query (GraphQL base query); MMKV persistence | Kept from source |
| Rendering for games | React Native Skia | 2D games, result cards, side-by-side compositor |
| Animation | Reanimated 4, Gesture Handler, Lottie (mascot) | Refresh-rate aware; reduce-motion respected |
| Camera and vision | react-native-vision-camera + frame processors; MediaPipe Pose Landmarker (lite model) via native module | On-device rep counting for Level 3 |
| Real-time | Phoenix JS client (chat, presence); native WebSocket (games); LiveKit React Native SDK (video) |  |
| Push | APNs + FCM via Expo Notifications; server-side send |  |
| Location | expo-location; foreground by default; background only during an active Level 4 event with user opt-in | Source asked for always-on background location: removed for privacy and store review |
| Attestation | App Attest (iOS), Play Integrity (Android) | Token on login and on sensitive calls |
| Age signals | Declared Age Range (iOS), Play Age Signals (Android) via a thin native module | Wrapped behind one `getAgeSignal()` interface |
| Payments | StoreKit 2 / Play Billing via RevenueCat for subscriptions and cosmetics; Stripe for venue deposits (physical services are outside store IAP rules) |  |
| OTA updates | EAS Update for JS-only fixes; native changes go through store review | Store rules forbid changing app purpose via OTA |
| Mini-games | Level 1 titles are native Skia code in the binary, not downloaded HTML5 | Avoids Apple 4.7 mini-app review overhead; keeps games offline-capable |
| i18n | English and Spanish at launch; ICU messages; auto-translate in chat via server |  |

**Reference devices for performance budgets:** iPhone 13 and a mid-tier Android with 6 GB RAM. App download under 80 MB; cold start under 2.5 s on the Android reference.

## Backend services and phasing

The source lists seven microservices in five languages from day one. This spec keeps every one of them but starts with five deployables and splits modules out when a scaling or ownership reason appears.

| Service | Stack | Owns | MVP deployable | Splits out when |
| --- | --- | --- | --- | --- |
| Core API | NestJS (TypeScript) + Aurora Postgres | Auth, profiles, verification tiers, social graph, feed, venues, bookings, economy ledger, admin API | Yes: modular monolith | Auth and economy split at Phase 4 or \~200k MAU |
| Matchmaking | Go + Redis Streams | Play queue pairing, swipe deck candidate generation | Yes | Already separate |
| Game engine | Node.js workers | Game sessions, rules execution, real-time ticks, replays | Yes | Real-time titles get their own pool at scale |
| Chat and presence | Elixir Phoenix Channels + DynamoDB | Threads, messages, typing, presence, in-app notifications fan-out | Yes | Already separate |
| Trust and safety | Python FastAPI workers + SQS | Text, image, video, audio classification; hash matching; risk scores; report queue | Yes | Already separate |
| Media | LiveKit (Cloud at MVP) + S3 + CloudFront + MediaConvert | Live rooms, recording, clips, transcodes | Managed service | Self-host LiveKit on EKS when cost justifies |
| Payments | Stripe Connect via Core API module | Venue payouts, deposits, refunds | Inside Core API | Phase 4 |
| Notifications | Core API module + queue | Push, email (SendGrid), SMS (Twilio) | Inside Core API | High volume |

**Third-party services** (one primary each, with a named fallback): identity verification Persona (fallback Stripe Identity); emergency dispatch Noonlight-style API; SMS and OTP Twilio Verify; email SendGrid; subscriptions RevenueCat; feature flags LaunchDarkly; CSAM hash matching via Thorn Safer or Microsoft PhotoDNA; translation via a machine-translation API.

## Real-time systems

### Chat and presence (Phoenix)

- Clients join `user:{id}` (inbox, notifications) and `thread:{id}` topics; Phoenix PubSub with Redis adapter across nodes.
- Message write path: client → Phoenix → safety pre-check (synchronous, under 150 ms, text only) → DynamoDB → fan-out. Images and video go to S3 via presigned upload and are delivered only after the async safety scan clears (blurred placeholder meanwhile).
- Game cards in chat are messages of type `game_card` that reference a `game_session_id`; the card re-renders as the session state changes.
- Message retention: 2 years by default, user-deletable; reported content preserved per Spec 04.

### Game sessions (Node workers)

- Session created by Core API on challenge accept; a worker claims it via Redis lock and owns its state.
- **Turn-based:** client sends a move intent → worker runs `validate` + `apply` from the shared rules package → persists the move log → broadcasts new state. Clients predict locally for instant feel and reconcile.
- **Real-time:** fixed 20 Hz server tick; inputs timestamped; server-authoritative with client-side prediction; rollback reconciliation only for titles that need it (Block Battle, Tap the Tile).
- Every session is replayable from `seed + rules_version + move_log`; this is the evidence for disputes and the source for auto-clips.

### Play queue (Go)

- Queues keyed by `game:format:region:skill_bucket` in Redis Streams. Region = H3 geospatial cell (resolution 5, roughly city scale).
- Pairing loop every 250 ms: widen skill band by ±1 deviation every 15 s; after the regional timeout (default 90 s, Levels 1 and 2 only) merge with neighboring cells, then national.
- Target: p99 pairing decision under 20 ms (source target kept); median time to match under 10 s at medium load.

### Swipe deck (Go candidate generation + Core API ranking)

1. **Hard filters:** intent compatibility both ways, age ranges both ways, distance, blocks, V-tier, not already seen in 30 days.
2. **Candidate retrieval:** H3 ring search outward from the user's cell until 300 candidates.
3. **Scoring:** affinity (shared games, vibe tags, prompts) + competitive fit (rating closeness in shared games) + activity recency + reply likelihood. Cold start uses distance and shared interests (source design kept).
4. **Exposure control:** every profile gets a fair share of impressions; heavily right-swiped profiles are throttled so they are not flooded with challenges (a known safety issue on dating apps).
5. **Never ranked on:** race, ethnicity, religion, or any inferred sensitive trait. The source's "MBTI tags" are kept only as optional self-declared vibe tags.

## Data stores and core data model

| Store | Holds | Notes |
| --- | --- | --- |
| Aurora PostgreSQL | Users, profiles, verification status, social graph, challenges, game sessions (metadata), results, ratings, economy ledger, venues, bookings, reports, audit log | Source of truth; PostGIS for venue geo; row-level encryption for PII fields |
| DynamoDB | Chat messages, game move logs | High write volume, simple access patterns |
| Redis (ElastiCache) | Queues, sessions, rate limits, presence, leaderboards (sorted sets). ElastiCache for Valkey, node-based with cluster mode disabled, because the atomic multi-key Lua scripts need a single keyspace | Leaderboards snapshot hourly to Postgres |
| OpenSearch | User, venue, game, and feed search | Rebuilt from Postgres via change stream |
| S3 + CloudFront | Media, clips, avatars; Glacier for archival | Signed URLs; EXIF and GPS stripped on upload |
| S3 data lake + Snowflake | Analytics events, partner reporting | No raw PII in the lake; pseudonymous IDs |
| Evidence vault (separate S3 bucket, object lock) | Reported content, NCMEC report data, dispute evidence | Restricted IAM role; 1-year minimum retention for NCMEC data |

### Core entities

Consolidated from the three source ER sketches; every source entity is kept, renamed where two sources used different names.

| Entity | Key fields | Replaces source names |
| --- | --- | --- |
| User | id, phone\_hash, email, status, age\_band, created\_at | User |
| Verification | user\_id, tier (V0–V3), method, vendor\_ref, checked\_at, expires\_at | (new) |
| Profile | user\_id, display\_name, bio, prompts\[\], photos\[\], vibe\_tags\[\], intents\[\], visibility | Profile |
| Team | id, name, captain\_id, members\[\] | (new; source required multi-team membership) |
| Challenge | id, from, to (user or team), game\_id, level, format, stake, intent, state, expires\_at | Match |
| GameSession | id, challenge\_id, rules\_version, seed, state, started\_at, ended\_at | GameSession, GameInstance |
| Result | session\_id, outcome per side, verification\_method, strength, verified\_at | (split from GameInstance) |
| Rating | user\_or\_team\_id, game\_id, format, mu, sigma or rd, season | (new; replaces ELO field) |
| LedgerEntry | user\_id, currency (XP or BP), delta, reason, ref\_id, created\_at | (new; double-entry for BP) |
| Thread, Message | thread\_id, type, members; message\_id, sender, type, body, media\_ref | ChatMessage |
| Venue, Slot, Booking | venue\_id, geo, certification; slot\_id, game, start, capacity; booking\_id, deposit\_ref, status | Venue, Coupon |
| Offer, Redemption | offer\_id, venue\_id, bp\_cost, terms; redemption\_id, single-use token | Coupon |
| Stream | id, room, participants, audience scope, delay, recording\_ref | Stream |
| Report, Dispute, Case | id, subject, category, severity, status, assignee, evidence\_refs | Dispute |
| LeaderboardSnapshot | scope (global, region, friends, venue), game\_id, period, entries | LeaderboardSnapshot |

The source's `User.salted_password_hash` is replaced by passkey credentials plus optional Argon2id hash; `User.geo_hash` is not stored on the user (location is ephemeral, kept per session at H3 cell precision only).

## Media, live streaming, and AI

### Live streaming (LiveKit)

- **Phone streams** publish over WebRTC directly into a LiveKit room; viewers subscribe via WebRTC (interactive, sub-second) for small rooms. Large audiences receive HLS from LiveKit Egress via CloudFront, which also gives the 30-second safety delay cheaply.
- **Dual stream:** two publishers in one room, server-side composite egress for the feed and for recording.
- **Venue multi-cam and streamer setups:** LiveKit Ingress accepts RTMP, WHIP, and SRT, so OBS or a venue camera can join a room. The source said "RTMP/SRT → LiveKit"; WHIP is added as the preferred low-latency path.
- **Recording:** opt-in per stream; recordings stored 30 days unless saved as a highlight.
- **Live moderation:** audio transcribed in near-real-time (speech-to-text), text classifiers on transcript and comments, frame sampling (1 frame per 2 s) through image classifiers; a moderator can kill a stream in one action.

### Clips and result cards

- Game moment markers (Spec 02 framework) trigger server-side clip renders from replays (Level 1) or recordings (Level 3 and 4).
- Side-by-side compositor for Level 3: both captures aligned on the start gesture, rep counter overlaid.
- Transcode with AWS Elemental MediaConvert; output vertical 9:16 for feed and external share.

### Pose verification (Level 3)

| Step | Where | What |
| --- | --- | --- |
| 1. Challenge code | Server → device | One-time 4-character code + random start gesture, valid 5 minutes |
| 2. Live count | Device | MediaPipe Pose Landmarker (lite) at 15 to 30 fps; joint-angle state machine per exercise; live rep counter shown |
| 3. Upload | Device → S3 | Video + landmark trace + attestation token |
| 4. Re-count | Server (GPU worker) | Full model re-run; count must match device within ±1 rep or ±1 s; start gesture and code checked by OCR + pose |
| 5. Review | Opponent, then human if disputed | 24 h window |

Accuracy targets before a Level 3 title can be ranked: rep count within ±1 on 95% of a 500-clip labeled test set, across body types, skin tones, lighting, and camera angles. Titles that miss the bar ship unranked (XP only).

### Trust and safety ML

| Signal | Approach |
| --- | --- |
| Text (chat, bios, comments) | Hosted moderation model + fine-tuned classifier for BEEF-specific trash-talk vs harassment; multilingual |
| Images and video | Nudity, violence, weapons, minors-likelihood classifiers; unsolicited-nudity blur in chat |
| Known CSAM and NCII | Perceptual hash matching (PhotoDNA or Safer) on every upload, before delivery |
| Voice and live audio | Speech-to-text first (the source's "Whisper toxicity classifier" conflated the two), then text classifiers |
| Behavior | Rate of challenges sent vs accepted, block and report rates, rapid move-to-off-platform requests, money requests: feeds a per-user risk score |

All models are tools for reviewers, not judges: automated actions are limited to blur, hold-for-review, rate limit, and temporary mute. Bans need a human, except for hash-matched CSAM.

## Infrastructure, DevOps, and security engineering

### Infrastructure

- **Cloud:** AWS, one primary region (us-east-2, Ohio; evaluate an AWS Local Zone in Dallas for latency-sensitive game workers) with a warm standby region for Postgres and S3 replication from v1 launch.
- **Compute:** EKS Auto Mode (AWS-managed, Karpenter-based node pools, built-in load balancer controller and Pod Identity agent); Spot capacity for stateless workers (game, media jobs), on-demand for Phoenix and Core API. Matchmaking region shards per source.
- **Edge:** CloudFront + AWS WAF + Shield Standard; API Gateway is not used (Core API sits behind an ALB).
- **Infrastructure as code:** Terraform for AWS; Helm charts per service; ArgoCD syncs from a GitOps repo.
- **Environments:** dev (per-branch preview for Core API), staging (production-like, synthetic data), production. No production PII ever copied to lower environments.

### CI/CD

GitHub Actions → build, unit tests, SAST, dependency and container scan → ECR → ArgoCD canary (5% → 50% → 100% with automatic rollback on error-rate SLO burn). Mobile: EAS Build per PR for internal testers, EAS Submit to TestFlight and Play internal track, phased store rollout at 10% → 50% → 100% over 7 days.

### Observability

OpenTelemetry traces and metrics from every service → Grafana Cloud (Tempo, Mimir/Prometheus, Loki), source choice kept. Mobile crash and performance via Sentry. PagerDuty on-call with two rotations (platform, trust and safety tooling). Every alert maps to an SLO.

### Security engineering

| Control | Requirement |
| --- | --- |
| Transport | TLS 1.3 everywhere; certificate pinning for the auth and payments endpoints |
| Data at rest | KMS-managed keys, AES-256; field-level encryption for DOB, phone, ID tokens, emergency contacts |
| Identity documents | Never stored by BEEF; vendor returns a verification result and a reference ID |
| Secrets | AWS Secrets Manager; no secrets in mobile binaries; short-lived service credentials via IRSA |
| Access | SSO + hardware keys for staff; just-in-time production access; every admin action audited and reviewable |
| App security | OWASP MASVS L2 for the app, OWASP ASVS L2 for APIs; SAST and DAST gates on merge; annual third-party pentest before launch and yearly after |
| Rate limits | Per user, per device, per IP buckets on auth, swipe, challenge send, message send, report |
| Location privacy | Distances shown as buckets (under 1 mi, 1 to 5 mi, 5 to 10 mi, 10+); jitter + H3 snapping to defeat trilateration attacks, a known dating-app vulnerability |
| Incident response | Acknowledge in 30 min, contain in 24 h, root-cause write-up in 72 h (source targets kept); breach-notification playbook per state law |
| Compliance targets | SOC 2 Type I at v1 launch, Type II 12 months later; PCI scope kept to SAQ A by never touching card data (Stripe, store billing). The source's ISO 27001 target moves to the international expansion phase |

## Service levels, budgets, and API surface

### Service-level objectives

| Surface | SLO | Source target |
| --- | --- | --- |
| Core API availability | 99.9% monthly | (new) |
| Core API latency | p95 under 120 ms | Kept |
| Chat message delivery | p95 under 300 ms sender to recipient, same region | (new) |
| Turn-based move round trip | p95 under 70 ms server processing + network | Kept (WebSocket spike target) |
| Real-time game tick | 20 Hz, p95 input-to-ack under 100 ms | (new) |
| Play queue time to match | median under 10 s at medium load | Kept |
| Level 3 verification | median under 2 min from upload | (new) |
| Emergency alert relay | p99 under 5 s from tap to dispatch provider | (new; must-have) |
| Crash-free sessions | 99.5% or higher | Kept |

### Load test gate

k6 ramp to 50,000 concurrent game sessions and 200,000 concurrent chat sockets in staging, holding SLOs for 30 minutes, before v1 launch (source's 50k figure kept, chat added).

### API surface (examples)

GraphQL (app): `me`, `profile(id)`, `swipeDeck(cursor)`, `feed(sort, cursor)`, `games(level)`, `venues(near, game)`; mutations `sendChallenge`, `respondChallenge`, `swipe`, `bookSlot`, `confirmResult`, `dispute`, `report`, `redeemOffer`.

REST (partner and internal):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /v1/venues/{id}/slots | Venue availability (source endpoint kept) |
| POST | /v1/venues/{id}/bookings | Create booking with deposit hold |
| POST | /v1/events/{id}/checkin | Staff QR scan |
| POST | /v1/events/{id}/result | Staff or venue-system score post |
| POST | /v1/webhooks/stripe, /v1/webhooks/identity, /v1/webhooks/dispatch | Vendor callbacks |
| POST | /v1/takedown | Public NCII removal request (no account required) |

WebSocket: `wss://game.beef.app/session/{id}` (game), Phoenix `wss://rt.beef.app/socket` (chat, presence).

### Sources

- [Expo SDK 58 upgrade guide](https://expo.dev/blog/how-to-upgrade-to-sdk-58.md)
- [LiveKit Ingress: RTMP, WHIP, SRT](https://docs.livekit.io/egress-ingress/ingress/overview/) and [self-hosting overview](https://docs.livekit.io/transport/self-hosting.md)
- [MediaPipe Pose Landmarker](https://developers.google.cn/mediapipe/solutions/vision/pose_landmarker)
- [AdAttributionKit and SKAdNetwork status](https://ppc.land/skadnetwork/)
- [Apple age assurance APIs](https://www.helpnetsecurity.com/?p=358863) and [Google Play Age Signals](https://betanews.com/article/google-play-age-signals-api-global-rollout/)
- [Apple Mini Apps Partner Program and guideline 4.7 (TechCrunch)](https://techcrunch.com/2025/11/13/apple-halves-commissions-for-mini-app-makers/?sidebar=a)
- [REPORT Act preservation requirements](https://www.congress.gov/118/plaws/publ59/PLAW-118publ59.htm)
