# PROMPT.MD – Full AWS Development Specification

## 📘 Project Context
I am building a **real‑time social gaming and communication app** as part of my **AWS Solutions Architect Professional certification**.
The system must:
- Use **as many relevant AWS managed services** as appropriate.
- Employ **intelligent, microservice‑driven architecture**.
- Maintain **serverless‑first principles**, emphasizing scalability, observability, and low cost.
- Integrate seamlessly with a **React Native + Expo frontend** exported from **Figma to VS Code**.

## 🎮 App Overview
Users can:
- Create accounts and profiles.
- Join matchmaking queues for live multiplayer games.
- Chat, share media, and spectate matches.
- Stream and upload highlights.
- Manage subscriptions and review analytics dashboards.

---

## 🧱 Architecture Summary (from uploaded specs)

**Languages / Frameworks:**  
React Native + Expo | Node (NestJS) | Go | Python (FastAPI) | Elixir or Socket.IO  
**Cloud Platform:** Amazon Web Services  

**Core AWS Components** [1]  
- **Auth:** Amazon Cognito (JWT + OAuth) or custom NestJS auth service on Fargate / Lambda.  
- **Profiles / Core Relational Data:** Amazon RDS (PostgreSQL) + RDS Proxy.  
- **High‑velocity Chat Payloads:** Amazon DynamoDB.  
- **Search & Feed:** Amazon OpenSearch Service.  
- **Media Storage:** Amazon S3 → Glacier (lifecycle).  
- **Matchmaking Engine:** Go + Redis Streams → Kinesis / SQS FIFO.  
- **Game Engine:** Node workers (Fargate or Lambda); deterministic seed replication.  
- **Chat & Presence:** WebSocket (API Gateway) + ElastiCache (Redis).  
- **Streaming:** LiveKit or Amazon IVS / MediaLive; CloudFront CDN.  
- **Moderation:** Python FastAPI + SageMaker Hugging Face model; SQS queue; Rekognition + Comprehend.  
- **Payments:** Stripe Connect via Lambda; Secrets in AWS Secrets Manager.  
- **Analytics:** Amazon Pinpoint + Kinesis Firehose / Snowflake feed.  
- **CI/CD:** GitHub Actions → ECR → ArgoCD (on EKS) or AWS CodePipeline.  
- **Observability:** OpenTelemetry, Prometheus, Grafana, CloudWatch, PagerDuty.  
- **Feature Flags:** LaunchDarkly / AWS AppConfig.

---

## 📱 Frontend Pages and Functions

| Page | Purpose | AWS / Service Integrations |
|------|----------|-----------------------------|
| **Welcome / Auth** | Login / Signup via email or OAuth; token exchange. | Cognito User Pool, AppSync |
| **Onboarding** | Profile setup and region selection. | API Gateway → RDS |
| **Home Feed** | Personalized content feed. | OpenSearch / DynamoDB |
| **Matchmaking Lobby** | Displays live games; users join queues. | Go microservice + ElastiCache |
| **Game Session** | Real‑time play + spectator mode. | Game Engine Lambdas + AppSync WebSockets |
| **Chat & Presence** | DMs, group chat, presence indicators. | DynamoDB + Redis + WebSocket API |
| **Media Hub** | Upload / view videos; stream live. | IVS / S3 / CloudFront |
| **Profile & Settings** | User profile edit, preferences, subscriptions. | Cognito + Stripe |
| **Analytics Dashboard** | Engagement and rewards. | Pinpoint + Custom API |
| **Partner Portal** | (Optional) Brand insights & data export. | S3 + OpenSearch + CSV export |

---

## ⚙️ Backend Microservices & Primary Functions

### 1. Authentication & Profiles
- JWT Auth via Cognito or NestJS service.  
- CRUD for profiles in RDS (PostgreSQL).  
- Cache profile reads in ElastiCache.  

### 2. Matchmaking & Queue
- Region‑partitioned pairing logic.  
- Queue state in Redis / Kinesis.  
- Publishes match events to Game Engine.  

### 3. Game Engine
- Stateless workers executing deterministic game logic.  
- Broadcast state updates via AppSync WebSockets.  
- Persist results to RDS + DynamoDB.  

### 4. Chat & Presence
- Real‑time messaging via API Gateway WebSockets.  
- Store messages in DynamoDB.  
- Presence tracking in Redis.  
- Integration with Moderation queue.  

### 5. Media & Streaming
- RTMP ingest → IVS stream → CloudFront distribution.  
- VOD uploads to S3 with Glacier archival policy.  
- Metadata indexed in OpenSearch.  

### 6. Safety & Moderation
- Text + image toxicity checks via SageMaker model.  
- SQS queues for async moderation.  
- Rekognition & Comprehend as secondary filters.  

### 7. Payments
- Stripe Connect integrations for subscriptions and B2B.  
- Webhooks handled in Lambda.  
- Ledger records in RDS + S3 backup.  

### 8. Data & Analytics
- Pinpoint for engagement metrics.  
- Kinesis Firehose → OpenSearch or Snowflake.  
- Dashboard via Grafana.  

### 9. DevOps / Observability
- GitHub Actions → ECR → ArgoCD (EKS).  
- OpenTelemetry traces, Prometheus metrics.  
- PagerDuty alerts on CloudWatch events.  

---

## 🧩 End‑to‑End Flow Example
1. User signs up → Cognito creates ID → Profile into RDS.  
2. User joins match → Go service pairs → Game Engine Lambda runs session.  
3. Game state and chat sync via WebSockets.  
4. Highlights sent to S3 → moderated → CloudFront CDN.  
5. Stripe handles subscription; Pinpoint tracks engagement.  

---

## 🧠 Your Role (Claude)
Behave as a **principal software architect** and **full‑stack engineer**.

**Goals**
1. Refine this architecture into modular service scaffolds.  
2. Produce directory structures for both frontend and backend.  
3. Generate TypeScript / Go / Python scaffolds for APIs and Lambdas.  
4. Create **Infrastructure‑as‑Code** templates (AWS CDK or Terraform).  
5. Build CI/CD YAMLs (GitHub Actions / ArgoCD).  
6. Demonstrate service interactions and API contracts.  
7. Recommend cost optimizations and compliance considerations.  
8. Output final artifacts as deployable, testable modules.  

**Output Format**
- Architecture Summary  
- Folder Structure  
- Service Scaffolds (with code)  
- Infrastructure‑as‑Code (CDK/Terraform)  
- DevOps Workflows  
- Next Steps / Iterative Delivery Plan  

---

## ✅ Objective
Deliver a **production‑grade, AWS‑native, modular backend** that integrates with my existing React Native frontend and demonstrates **certification‑level architectural excellence**.
