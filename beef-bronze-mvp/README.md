# BEEF!

Competitive-networking app: meet people by challenging them, from a phone game up to a match at a local venue. This repository is the **Bronze MVP**: every service from the architecture spec running as a real container against real storage, the AWS environment in Terraform, and an end-to-end test that proves the whole loop.

Specs live in Claude Docs: Spec 01 (Product) through Spec 07 (Build Plan). Spec 07 defines Bronze, Silver, and Gold and what each must prove.

## What's here

| Path | What | Stack |
| --- | --- | --- |
| `packages/contracts` | Request/response schemas shared by every service and the app | TypeScript, zod 4 |
| `packages/game-rules` | Pure, deterministic game rules (server authority + client prediction) | TypeScript |
| `services/core-api` | Auth, profiles, swipe, threads, challenges, sessions, results, ratings, economy, leaderboards | NestJS 11, Postgres, Redis |
| `services/game-engine` | WebSocket game host; moves validated on the server; move logs to DynamoDB | Node 22, ws, Redis |
| `services/matchmaking` | Skill queue; pairs by rating and rating deviation; publishes to a Redis Stream | Go 1.26 |
| `services/chat` | Chat, presence, realtime events; every message screened before delivery | Elixir 1.18, Phoenix 1.8 |
| `services/safety` | Moderation, reports with response clocks, TAKE IT DOWN Act intake | Python 3.13, FastAPI |
| `apps/mobile` | iOS/Android app | Expo SDK 58, React Native 0.88, Redux Toolkit |
| `infra/terraform` | AWS: VPC, EKS Auto Mode, Aurora PostgreSQL, Valkey, DynamoDB, S3, ECR, IAM, secrets | Terraform 1.17, AWS provider 6.70 |
| `deploy` | Dockerfiles and one Helm chart for all services | Helm 4 |
| `tests/e2e` | The Bronze exit test, runnable locally or against AWS | Node 22 |

## Run it locally

Requirements: Docker, Node 22.

```bash
npm ci
npm run keys:dev          # writes .env: ES256 keypair, internal token, PII hash key, chat secret
docker compose up -d --build
npm run e2e               # 18 steps, ~3 s once the stack is up
```

Services: core-api `:3000`, game-engine `:3100`, chat `:4000`, safety `:8000`, matchmaking `:8080`, Postgres `:5432`, Redis `:6379`, DynamoDB Local `:8001`. Sign in with any E.164 phone number and the dev code `000000`.

Run the app against the local stack:

```bash
npm run build -w packages/contracts -w packages/game-rules
cd apps/mobile && npm ci && npx expo start
```

On an Android emulator use `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` (and the matching `GAME_WS`/`CHAT_WS` URLs); on a physical device use your machine's LAN IP.

## Tests

| Command | Covers |
| --- | --- |
| `npm test` | game-rules (9), core-api Glicko-2 + economy (10), game-engine (4) |
| `cd services/matchmaking && go test ./...` | pairing bands, fairness cap, no double-pairing (6) |
| `cd services/safety && pytest` | moderation verdicts, report clocks, NCII deadline (8) |
| `cd services/chat && mix test` | ids, token checks (3) |
| `npm run e2e` | the full Bronze loop across all services (18 steps) |

CI (`.github/workflows/ci.yml`) runs all of the above plus app typecheck, `expo-doctor`, a Metro bundle, Terraform validate, Helm lint, and Kubernetes schema validation.

## Deploy to AWS

See [docs/runbook-aws.md](docs/runbook-aws.md). In short: bootstrap the state bucket, `terraform apply` the platform stack, then the cluster-config stack, set five GitHub environment variables, and merge to `main`.

## Dev-only stubs (replaced in Silver)

- **Phone OTP** accepts `DEV_OTP_CODE`. Core API refuses to start if it is set in staging or prod.
- **V1 liveness** is a dev endpoint that grants V1. Only `local` and `dev` allow it.
- **Moderation** is a rule-based provider behind an interface; Silver swaps in a hosted model.
- **Secrets** reach pods through Terraform-created Kubernetes Secrets; Silver uses External Secrets with rotation.

## Corporate networks

All Dockerfiles accept an optional build secret `extra_ca` (a PEM bundle) for networks with a TLS-inspecting proxy:

```bash
docker build --secret id=extra_ca,src=/path/to/corp-ca.pem -f deploy/docker/node-service.Dockerfile --build-arg SERVICE=core-api .
```

Base images come from the AWS public ECR mirror of Docker Official Images (`BASE_REGISTRY`) to avoid Docker Hub pull limits.
