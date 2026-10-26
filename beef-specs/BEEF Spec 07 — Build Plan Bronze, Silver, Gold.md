# BEEF Spec 07 — Build Plan: Bronze, Silver, Gold

Oct 26, 2026 · @Ayan

## The three tiers

Bronze proves the architecture, Silver proves the product, Gold proves the business is safe and legal to run in public. Each tier keeps every container from the tier before it and only adds code, data, and integrations inside them, so nothing built in Bronze is thrown away.

| Tier | What it proves | Who uses it | Exit test (all must pass) |
| --- | --- | --- | --- |
| **Bronze MVP** | Every service in Spec 03 runs as a real container, talks to the others, persists to real AWS storage, and is created entirely by Terraform | Engineers, internal demo | One command brings up the stack locally; `terraform apply` builds dev in AWS; a scripted end-to-end test runs signup → swipe → mutual match → chat → queue → play a full game → result → XP, BP, rating, leaderboard, against both local and AWS dev |
| **Silver MVP** | The product loop works: all beta games, all four levels, social feed, leaderboards, venues, verification, payments, analytics, all wired into the Bronze containers | Closed alpha and DFW beta testers (Spec 06, Phases 1 to 2) | Spec 06 Phase 2 gate: 3,000+ beta users, D7 20%, 5% of pairs reach Level 4, safety SLAs held 4 weeks |
| **Gold product** | BEEF is shippable to the public: full v1 catalog, compliance, security, scale, store approval | Public (Spec 06, Phase 3+) | Spec 06 launch criteria: SOC 2 Type I, pentest clean, load gate, 99.5% crash-free, counsel sign-off, store approval |

**Not in Bronze, on purpose:** identity vendors, payments, live video, pose AI, push notifications, and real SMS. Each has a stubbed interface in Bronze (e.g. phone OTP accepts a fixed code in dev) so Silver swaps in the vendor without changing callers.

## Repository layout

One monorepo holds every service, the app, the infrastructure, and the end-to-end test, so one pull request can change a contract and every caller of it, and CI proves they still agree.

```
beef/
  packages/
    contracts/      zod schemas + types shared by services and the app
    game-rules/     pure, deterministic rules for every title (server authority + client prediction)
  services/
    core-api/       NestJS (TypeScript): auth, profiles, swipe, threads, challenges, sessions, results, economy, leaderboards
    game-engine/    Node (TypeScript): WebSocket game host, state in Redis, move logs to DynamoDB
    matchmaking/    Go: skill queue, pairs tickets, publishes to a Redis Stream
    chat/           Elixir Phoenix: chat + presence + realtime events, messages in DynamoDB
    safety/         Python FastAPI: text moderation, reports, TAKE IT DOWN intake
  apps/mobile/      Expo (React Native) app
  infra/terraform/  AWS: network, EKS, data, ECR, IAM, secrets; one folder per environment
  deploy/           Dockerfiles and the Helm chart every service deploys with
  tests/e2e/        the Bronze exit test, runnable against local or AWS
  docker-compose.yml  full local stack
```

**How code reaches AWS:** a merge to `main` runs unit tests for all five languages, builds the five images, runs the end-to-end test against them in CI, pushes to ECR, and deploys to the dev EKS cluster with Helm. Terraform changes are planned on every pull request and applied by a human approval step.

**Two improvements over Spec 03 found while building:**

- **Shared zod contracts instead of GraphQL or OpenAPI codegen.** Every client of Core API in Bronze is TypeScript, so the schemas themselves are shared and both sides fail the typecheck together on a breaking change. Spec 03's GraphQL choice is deferred until a non-TypeScript client or the feed's query shape justifies it; an OpenAPI document for venue partners is generated from the same schemas in Silver.
- **ES256 tokens instead of a shared secret.** Only Core API can mint tokens; the other four services hold just the public key.

## Bronze MVP

Bronze is built: all five services run as real containers against real storage, the AWS environment is fully described in Terraform, and an 18-step end-to-end test passes against the local stack. What remains for Bronze is running `terraform apply` in an AWS account and pointing the same test at it.

### Services

| Service | Language | Bronze scope | Talks to | Tests |
| --- | --- | --- | --- | --- |
| core-api | TypeScript, NestJS | Phone OTP sign-in (dev code), adults-only gate, profiles, V0/V1 tier gate, swipe deck + mutual match, threads, challenges, queue entry, session creation, result recording, Glicko-2 ratings, XP/BP ledger with Spec 02 caps and diminishing returns, leaderboards, report proxy | Postgres, Redis, all four others | 10 unit (Glicko-2 matches Glickman's published example) |
| game-engine | TypeScript, Node | WebSocket host for server-authoritative sessions; state in Redis via compare-and-set so any replica serves any player; move logs to DynamoDB; reports results to core-api with retries | Redis, DynamoDB, core-api | 4 unit + 9 rules tests |
| matchmaking | Go | Skill queue; band starts at the players' combined rating deviation and widens every 15 s; atomic Lua pairing; publishes to a Redis Stream that core-api consumes with a consumer group | Redis | 6 unit |
| chat | Elixir, Phoenix | User and thread channels; membership checked with core-api; every message screened by safety before storage; history from DynamoDB; Redis PubSub across replicas; internal notify endpoint for realtime events | Redis, DynamoDB, core-api, safety | 3 unit |
| safety | Python, FastAPI | Text classification (trash talk passes; threats and money requests block; phone numbers blur), reports with Spec 04 response clocks, TAKE IT DOWN intake with 48 h deadline and ticket lookup | Postgres | 8 unit |

### AWS footprint (Terraform)

| Layer | Resource | Dev sizing | Prod sizing |
| --- | --- | --- | --- |
| Network | VPC, 3 AZs, public / private / database subnets | 1 NAT gateway | 1 NAT per AZ |
| Compute | EKS Auto Mode, Kubernetes 1.37 | Auto-scaled node pools | Same, more headroom |
| Database | Aurora PostgreSQL 17.9 Serverless v2 | 0–4 ACU, auto-pause after 30 min idle | 0.5–32 ACU, writer + reader |
| Cache | ElastiCache for Valkey, TLS + auth token | 1 × cache.t4g.micro | Primary + replica, Multi-AZ |
| NoSQL | DynamoDB: chat messages, move logs | On-demand, PITR | Same, deletion protection |
| Objects | S3 media bucket, KMS, 30-day expiry on raw captures |  |  |
| Registry | ECR × 5, immutable tags, scan on push |  |  |
| Identity | Pod Identity role per service (least privilege); GitHub OIDC deploy role limited to one namespace |  |  |
| Secrets | Secrets Manager: ES256 keypair, internal token, PII hash key |  |  |
| Ingress | One shared ALB through EKS Auto Mode; only public paths routed, `/internal/*` never exposed | HTTP, or HTTPS with a certificate | HTTPS required |

All three Terraform stacks pass `terraform validate` against current provider and module versions (AWS provider 6.70, EKS module 21.29, VPC module 6.7). All 29 rendered Kubernetes objects pass schema validation.

### Exit test results

- [x] Every service builds into a non-root container (Node 365 MB, Elixir 249 MB, Python 242 MB, Go 18 MB distroless)
- [x] `docker compose up` brings up the full stack with Postgres 17, Redis, and DynamoDB Local
- [x] End-to-end test passes all 18 steps: sign-up, under-18 rejection, tier gate, swipe and mutual match, chat screening (allow, block, blur), non-member thread denial, challenge and accept, illegal-move rejection, full game to a win, exact XP/BP payouts, queue pairing through the Go matchmaker, resignation, half-pay on a repeat game, leaderboard order, game-socket and internal-API access control, report triage, TAKE IT DOWN ticket, move log and chat history in DynamoDB
- [x] 40 unit tests across four languages, plus Elixir compile with warnings as errors
- [ ] `terraform apply` in the team's AWS account (needs account, state bucket, GitHub repo name)
- [ ] Same e2e test passing against AWS dev

### Fixes made while building (would have been bugs in AWS)

- The skill queue's fixed starting band made two new players wait over a minute after their first game; it now starts at their combined rating deviation, as Spec 02 intended.
- Aurora's certificate chains to the RDS root CA, which public trust stores lack: strict TLS would have refused every connection, and the Python driver's default mode verified nothing. Images now ship the RDS CA bundle and both services verify against it.
- ElastiCache's serverless option is cluster-mode only, which would reject the multi-key Lua scripts that make pairing and moves atomic; Terraform uses a node-based Valkey group instead.

## Silver MVP

Silver fills the Bronze containers with the beta product from Spec 01: all four levels, the 20-title beta catalog, the social layer, venues, verification, payments, and analytics. Three new deployables are added only where a different runtime is genuinely needed; everything else lands as modules inside the existing five.

| Area | Silver adds | Lives in | Spec |
| --- | --- | --- | --- |
| Games | Beta catalog of 20 titles (8 L1, 4 L2, 4 L3, 4 L4) as `game-rules` modules; real-time tick loop for Block Battle and Tap the Tile; React Native Skia renderer with drop, win-line, and result animations | game-rules, game-engine, app | 02 |
| Level 3 | In-app capture, on-device MediaPipe rep counting, challenge code and start gesture, presigned upload to S3, server re-count, opponent review and disputes | app, core-api, **media-worker (new, Python + GPU node pool)** | 02, 03 |
| Level 4 | Venues, slots, bookings, Stripe Connect deposits and no-show capture, staff QR check-in, venue score entry, reliability score | core-api, **venue portal (new, web)** | 05 |
| Social | Feed (Friends, Region, For You), result and rivalry cards, stories, follows, rematch CTA, search via OpenSearch | core-api, app | 01 |
| Leaderboards | Regional (H3 cells), friends, venue, weekly and seasonal resets with soft rating reset | core-api, Redis | 02 |
| Match | Go candidate generation with H3 distance, affinity + competitive-fit ranking, exposure control, drag gesture, challenge builder, incoming list | matchmaking, core-api, app | 03 |
| Identity | Twilio Verify OTP, Sign in with Apple and Google, 15-minute access + rotating refresh tokens, store age signals (Declared Age Range, Play Age Signals), Persona V1/V2 webhooks, V3 registry screen | core-api, app | 04 |
| Safety | Hosted text model, image classifiers, hash matching on every upload, moderator console, Shield + check-ins + dispatch API, Texas ch. 106 disclosures | safety, chat, core-api, **admin console (new, web)** | 04 |
| Money | BEEF Pro via RevenueCat; Stripe for venue deposits | core-api, app | 05 |
| Data | Event stream → S3 → Snowflake; product analytics; partner dashboard v1 | all services | 03, 05 |
| Platform | Staging environment, HTTPS on a real domain, External Secrets with rotation, ArgoCD GitOps, network policies, OpenTelemetry → Grafana Cloud, Sentry in the app, push notifications | infra, deploy | 03 |

**Exit test (Spec 06 Phase 2 gate):** 3,000+ beta users in DFW, D7 retention 20%, 5% of matched pairs reach Level 4, no-show rate under 10%, safety response targets held for 4 consecutive weeks, external pentest passed.

## Gold product

Gold is the version the public can download: the v1 catalog, live streaming, the full monetization set, every compliance obligation in Spec 04 operating day to day, and production infrastructure proven under load.

| Area | Gold adds |
| --- | --- |
| Product | v1 catalog (26 titles); dual live streams on LiveKit with the 30-second safety delay and viewer polls; BEEF Champion; sponsored cards; referral program; Season 1 cosmetics; Spanish localization |
| Compliance | SOC 2 Type I report; Texas ch. 106 disclosures live; TAKE IT DOWN process staffed 24/7 with 48-hour tracking; NCMEC CyberTipline registration and reporting; privacy program for Texas TDPSA, CUBI, Illinois BIPA, CCPA/CPRA; vendor DPAs; FCRA documents if the optional background check ships; counsel sign-off on every Spec 04 question |
| Store readiness | 18+ ratings, in-app account deletion, UGC safeguards, Sign in with Apple, privacy labels, age-signal integration, review notes and demo account |
| Security | External pentest clean, MASVS L2 for the app, ASVS L2 for APIs, staff SSO + hardware keys, audited admin actions |
| Scale and resilience | Production environment from `envs/prod` (Multi-AZ Aurora and Valkey, NAT per AZ, deletion protection), warm standby region, load gate of 50,000 game sessions and 200,000 chat sockets holding SLOs, 24/7 on-call with SLO-based alerts |
| Accessibility | WCAG 2.2 AA automated + manual VoiceOver and TalkBack passes |

**Exit test (Spec 06 launch criteria):** crash-free sessions 99.5% over 30 days, median time to match under 10 s, tutorial completion 80%, safety SLAs held 4 weeks, emergency relay p99 under 5 s, zero open critical or high security findings, SOC 2 Type I issued, store approval on both platforms.

## Build order

Bronze was built contracts-first, so every later piece compiled against a fixed interface: shared schemas and game rules, then Core API, then the services that call it, then the end-to-end test, then infrastructure, then the app. Four items remain to close Bronze; Silver then runs as epics in dependency order.

### Close Bronze (about 1 week, one engineer with AWS admin)

- [ ] Create the GitHub repository from the starter and enable branch protection on `main` with the `ci` checks required
- [ ] Bootstrap the Terraform state bucket; apply the platform and cluster-config stacks for dev (runbook in the repo)
- [ ] Request an ACM certificate for a dev domain so the ALB serves HTTPS
- [ ] Set the five GitHub environment variables and merge: `deploy-dev` must finish with the e2e test green against AWS

### Silver epics, in order

1. **Platform hardening:** staging environment, HTTPS domain, External Secrets with rotation, ArgoCD, OpenTelemetry → Grafana, Sentry. Everything after this ships through it.
2. **Real identity:** Twilio Verify, Sign in with Apple and Google, refresh tokens, store age signals, Persona V1/V2. Unblocks beta testers outside the team.
3. **Game catalog:** the remaining 19 beta titles on the rules framework, Skia renderer, real-time tick loop. Parallel with epic 4.
4. **Social layer:** feed, result and rivalry cards, stories, follows, H3 swipe deck with ranking, regional and friend leaderboards.
5. **Safety at beta scale:** hosted moderation models, image classification and hash matching, moderator console, Shield, check-ins, dispatch integration, Texas disclosures. Must finish before any Level 3 or 4 traffic.
6. **Level 3:** capture, on-device pose counting, media-worker re-count, review and disputes.
7. **Level 4 and venues:** venue portal, bookings, Stripe Connect deposits, staff check-in, score entry, reliability score. Pilot venues signed in Spec 06 Phase 0 onboard here.
8. **Money and data:** BEEF Pro via RevenueCat, event pipeline to Snowflake, partner dashboard v1.
9. **Beta readiness:** pentest, load test at beta scale, accessibility pass, TestFlight and Play internal track, campus launch prep.

## Developer workflow, environments, and cost

One pull request carries a change end to end; CI proves it in all five languages and against the full stack before anyone reviews it. Merges to `main` deploy to dev automatically; staging and prod (Silver and Gold) deploy by promoting the same image tags with an approval.

| Environment | Purpose | How it deploys | Data |
| --- | --- | --- | --- |
| Local | Day-to-day development, e2e test | `docker compose up` | Postgres, Redis, DynamoDB Local in containers |
| CI | Every pull request | GitHub Actions builds images and runs e2e in compose | Ephemeral |
| Dev (AWS) | Integration, internal demos | Automatic on merge to `main` | Synthetic only |
| Staging (Silver) | Release candidates, beta-like load | Promote image tag with approval | Synthetic only, never copies of prod |
| Prod (Gold) | Public | Promote with approval, canary rollout | Real users |

### Estimated AWS cost for dev

Approximate monthly cost in us-east-2 at Bronze traffic, from memory of public list prices; confirm with the AWS Pricing Calculator before budgeting.

| Item | Approximate monthly cost |
| --- | --- |
| EKS cluster fee | \~$73 |
| EKS Auto Mode compute (two to three small nodes, plus Auto Mode's management fee) | \~$80–150 |
| NAT gateway (single) + data | \~$35–50 |
| Application Load Balancer | \~$20–30 |
| Aurora Serverless v2 (scales to zero when idle) | \~$15–60 |
| ElastiCache Valkey cache.t4g.micro | \~$12 |
| DynamoDB, S3, ECR, Secrets Manager, CloudWatch logs | \~$15–30 |
| **Total** | **\~$250–400** |

Production (Multi-AZ, NAT per AZ, larger Aurora and Valkey, more nodes) is roughly 4 to 8 times that before traffic-driven costs; Spec 06 budgets it in the Phase 3 vendor line.

## The Bronze starter repo

The repository is delivered as a zip alongside this doc: 151 files, one commit, no secrets or build output. Everything listed below was run in this environment, not just written.

| Check | Result |
| --- | --- |
| Unit tests | 40 passing: TypeScript 23, Go 6, Python 8, Elixir 3 |
| Container images | All 5 build as non-root; matchmaking 18 MB distroless |
| End-to-end, local | 18/18 steps on a fresh stack |
| End-to-end, remote mode (as CI runs it against AWS) | 18/18 steps |
| Terraform | 3 stacks validate on Terraform 1.17 with AWS provider 6.70, EKS module 21.29, VPC module 6.7; `fmt` clean |
| Helm | Lint clean; 29 rendered objects pass Kubernetes schema validation |
| Mobile app | Typecheck clean on TypeScript 6.0; `expo-doctor` 20/20; Metro bundles a 4.9 MB Hermes Android bundle |
| Workflows | `actionlint` clean; action versions checked against each action's current docs |

**Before first use, replace:** `REPLACE_ME` values in `infra/terraform/envs/dev/*` (state bucket, GitHub repository, API allow-list CIDRs) and the iOS/Android identifiers `app.beef.dev` in `apps/mobile/app.json`.

**Version notes:** Expo SDK 58 pins TypeScript 6.0, so the whole repo uses 6.0 even though 7.0 is out; adopt 7 when Expo supports it. Kubernetes 1.37 and Aurora PostgreSQL 17.9 were the newest supported versions found; both are single variables.

### Sources

- [Amazon EKS Kubernetes versions in standard support](https://docs.amazonaws.cn/en_us/eks/latest/userguide/kubernetes-versions-standard.md)
- [Aurora PostgreSQL 17.9 announcement (Apr 7, 2026)](https://aws.amazon.com/about-aws/whats-new/2026/04/amazon-aurora-postgresql-17-9-16-13-15-17-14-22)
- [Expo SDK 58 upgrade guide](https://expo.dev/blog/how-to-upgrade-to-sdk-58.md)
- [LiveKit ingress (RTMP, WHIP, SRT)](https://docs.livekit.io/egress-ingress/ingress/overview/), for the Gold streaming work
