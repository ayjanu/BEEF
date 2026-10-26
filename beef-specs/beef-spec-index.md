# BEEF spec suite and build status (as of 2026-10-26)

| # | Document | Link |
| --- | --- | --- |
| 01 | Product Requirements (includes the source audit) | https://claude.ai/artifact/Fm7BsF2UCXwM4A8NdzDo5W |
| 02 | Game Catalog, Scoring & Economy | https://claude.ai/artifact/BfxspNvBbx1V5VR3tvmLmo |
| 03 | Technical Architecture | https://claude.ai/artifact/W7cAUAzSCUDdGvfeaQ7odA |
| 04 | Trust, Safety, Privacy & Legal | https://claude.ai/artifact/WvgnWqWRB5CzpjiycibUiB |
| 05 | Business, Venues & Go-to-Market | https://claude.ai/artifact/FeY7zPJdUm5Z3WYHVZu3Hm |
| 06 | Delivery Plan | https://claude.ai/artifact/ShKv9RsnP2T7ip92kLkWzV |
| 07 | Build Plan: Bronze, Silver, Gold | https://claude.ai/artifact/1RZfGQp89XGCwSB7cVVpnv |

## Build status

- Bronze MVP starter repo built and verified locally: five services (NestJS core-api, Node game-engine, Go matchmaking, Elixir/Phoenix chat, Python/FastAPI safety), shared contracts and game rules, Expo SDK 58 app, Terraform for AWS (EKS Auto Mode, Aurora PostgreSQL 17.9, Valkey, DynamoDB, S3, ECR, Pod Identity, GitHub OIDC), one Helm chart, CI and deploy workflows.
- Verified: 40 unit tests, 18-step end-to-end test (local and remote mode), terraform validate on all stacks, Helm + Kubernetes schema validation, Metro Android bundle, expo-doctor 20/20.
- Remaining to close Bronze: apply Terraform in the AWS account, set GitHub environment variables, pass the e2e test against AWS dev.

## Key decisions made during the build

- Launch 18+ only (Spec 01 audit item 1); Beef Points never bought, staked, or paid by chance games.
- REST + shared zod contracts instead of GraphQL for the TypeScript app (Spec 03 decision revised).
- ES256 tokens: only core-api can mint; other services verify with the public key.
- EKS Auto Mode instead of self-managed node groups + Karpenter.
- Valkey node-based (cluster mode disabled) because pairing and game moves use atomic multi-key Lua scripts.
- Matchmaking band starts at the players' combined rating deviation (Spec 02), fixing a 75-second wait for new players found in testing.
- Images ship the RDS CA bundle; database TLS is verified, not just encrypted.
