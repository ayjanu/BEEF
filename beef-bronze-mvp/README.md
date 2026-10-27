# BEEF!

Competitive-networking app: meet people by challenging them, from a phone game up to a match at a local venue. This repository holds the **Bronze MVP** (every service from the architecture spec running as a real container against real storage, the AWS environment in Terraform) and the **Silver** platform on top of it: the beta game catalog, the social feed, and in-person play at partner venues. An end-to-end test proves the whole loop.

Specs live in Claude Docs: Spec 01 (Product) through Spec 07 (Build Plan). Spec 07 defines Bronze, Silver, and Gold and what each must prove.

## What's here

| Path | What | Stack |
| --- | --- | --- |
| `packages/contracts` | Request/response schemas shared by every service and the app | TypeScript, zod 4 |
| `packages/game-rules` | Pure, deterministic rules for all titles, plus the match layer (timers, forfeits, hidden information, exact replay) | TypeScript, chess.js |
| `services/core-api` | Auth, profiles, swipe, threads, challenges, sessions, results, ratings, economy, leaderboards, feed, follows, blocks, venues, bookings, in-person safety | NestJS 11, Postgres, Redis |
| `services/game-engine` | WebSocket game host; per-player views; server timers; screens player text; move logs to DynamoDB | Node 22, ws, Redis |
| `services/matchmaking` | Skill queue; pairs by rating and rating deviation; publishes to a Redis Stream | Go 1.26 |
| `services/chat` | Chat, presence, realtime events; every message screened before delivery | Elixir 1.18, Phoenix 1.8 |
| `services/safety` | Moderation, reports with response clocks, TAKE IT DOWN Act intake | Python 3.13, FastAPI |
| `apps/mobile` | iOS/Android app | Expo SDK 58, React Native 0.88, Redux Toolkit |
| `infra/terraform` | AWS: VPC, EKS Auto Mode, Aurora PostgreSQL, Valkey, DynamoDB, S3, ECR, IAM, secrets | Terraform 1.17, AWS provider 6.70 |
| `deploy` | Dockerfiles and one Helm chart for all services | Helm 4 |
| `tests/e2e` | The Bronze and Silver exit test, runnable locally or against AWS | Node 22 |

## Run it locally

Requirements: Docker, Node 22.

```bash
npm ci
npm run keys:dev          # writes .env: ES256 keypair, internal token, PII hash key, chat secret
docker compose up -d --build
npm run e2e               # 30 steps, ~2 min (Trivia and Level 4 wait on real timers)
```

Services: core-api `:3000`, game-engine `:3100`, chat `:4000`, safety `:8000`, matchmaking `:8080`, Postgres `:5432`, Redis `:6379`, DynamoDB Local `:8001`. Sign in with any E.164 phone number and the dev code `000000`.

Run the app against the local stack:

```bash
npm run build -w packages/contracts -w packages/game-rules
cd apps/mobile && npm ci && npx expo start
```

On an Android emulator use `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` (and the matching `GAME_WS`/`CHAT_WS` URLs); on a physical device use your machine's LAN IP.

## What Silver adds

**Games.** Eight online titles on one framework:

| Title | Notes |
| --- | --- |
| Four Up, Dots and Boxes | Turn-based; idle turns forfeit after 24 h |
| Chess 5+3, Chess Bullet 1+0 | Server clocks; clocks start after both first moves; a missed first move aborts |
| Trivia Burst | 12 questions, everyone answers at once, 10 s rounds; answers never reach the app |
| Would You Rather | No winner; a match % instead; XP only |
| Two Truths & a Lie | Statements screened by the safety service; XP only |
| 20 Questions | The secret is hidden from the asker; exact guesses verified by the server; XP only |

Every change to a match is a log entry with a server timestamp, so a stored log replays to the exact result, timer events included. A seat that never moved makes the game a no-contest, which stops alt-account farming.

**Social.** A feed of result cards from your games and the people you follow, with cursor paging, reactions, screened comments, follows, "run it back" rematches, and hiding your own results. A block hides both people from each other in the deck, feed, profiles, comments, challenges, chat, the skill queue, and venue meets.

**Level 4, in person (no money).**
- **Venues and staff.** Venues are onboarded through an internal ops API; owners add staff; staff publish slots.
- **Who can meet.** Players book with someone they matched with. Both must be V3, and a pair's first two meets must be at Safe-Beef Certified venues.
- **Check-in and results.** Staff check players in by scanning 2-minute signed QR codes, then attest the result. The result moves ratings, appears on venue leaderboards, and posts to the feed.
- **Safety (Spec 04).**
  - The Shield: I'm OK, get me out, alert contacts, emergency.
  - Emergency contacts.
  - Prompts at the start and planned end of a meet, plus no-show marking.
  - A two-stage escalation when a player doesn't answer after a meet.
  - Private "did you feel safe?" ratings.
  - Staff flags.

## Tests

| Command | Covers |
| --- | --- |
| `npm test` | game-rules: every title, match layer, replay, content (39); core-api: Glicko-2, economy, meet safety (15); game-engine: timers, views, screening (8) |
| `cd services/matchmaking && go test ./...` | pairing bands, fairness cap, no double-pairing, blocked pairs (7) |
| `cd services/safety && pytest` | moderation verdicts incl. game text, report clocks, NCII deadline (9) |
| `cd services/chat && mix test` | ids, token checks (3) |
| `npm run e2e` | the full Bronze + Silver loop across all services (30 steps) |

CI (`.github/workflows/ci.yml`) runs all of the above plus app typecheck, `expo-doctor`, a Metro bundle, Terraform validate, Helm lint, and Kubernetes schema validation.

## Deploy to AWS

See [docs/runbook-aws.md](docs/runbook-aws.md). In short: bootstrap the state bucket, `terraform apply` the platform stack, then the cluster-config stack, set five GitHub environment variables, and merge to `main`.

## Dev-only stubs and known gaps

**Dev-only stubs.**
- **Phone OTP** accepts `DEV_OTP_CODE`. Core API refuses to start if it is set in staging or prod.
- **Identity verification** is a dev endpoint that grants V1, or V2/V3 when you pass `{ "tier": "V3" }`. Only `local` and `dev` allow it. The identity vendor's webhook replaces it.
- **SMS** (safety alerts to emergency contacts) is logged, not sent, in `local` and `dev`. Staging and prod need an SMS provider.
- **Moderation** is a rule-based provider behind an interface; a hosted model replaces it.
- **Secrets** reach pods through Terraform-created Kubernetes Secrets; External Secrets with rotation replaces them.

**Known gaps.**
- **Venue staff tools** exist only as an API (scan, attest, flag). The partner portal UI and the in-app QR scanner come next.
- **The Emergency button** opens the dialer and a critical review. Dispatch through a professional monitoring service is Gold.
- **The trivia bank** has 36 original questions. Grow it, or move it to the database with category packs, before ranked trivia launches widely.
- **Clips, stories and live video** wait on the media moderation pipeline (Gold).

## Corporate networks

All Dockerfiles accept an optional build secret `extra_ca` (a PEM bundle) for networks with a TLS-inspecting proxy:

```bash
docker build --secret id=extra_ca,src=/path/to/corp-ca.pem -f deploy/docker/node-service.Dockerfile --build-arg SERVICE=core-api .
```

Base images come from the AWS public ECR mirror of Docker Official Images (`BASE_REGISTRY`) to avoid Docker Hub pull limits.
