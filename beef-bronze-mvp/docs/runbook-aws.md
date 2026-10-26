# Runbook: stand up BEEF dev in AWS

Time: about 45 minutes, most of it waiting for EKS and Aurora. You need an AWS account with admin access, the AWS CLI, Terraform 1.11+, Helm, kubectl, and the GitHub repository name.

## 1. State bucket (once per account)

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply -var account_alias=<short-name>
# note the output: state_bucket
```

Put that bucket name into `infra/terraform/envs/dev/platform.backend.hcl`, `cluster-config.backend.hcl`, and `cluster-config.tfvars`.

## 2. Platform stack

Edit `infra/terraform/envs/dev/platform.tfvars`:

- `github_repository` = `owner/repo`
- `eks_public_endpoint_cidrs` = your office/VPN egress IP ranges (never `0.0.0.0/0` in prod)

```bash
cd infra/terraform/stacks/platform
terraform init -backend-config=../../envs/dev/platform.backend.hcl
terraform plan  -var-file=../../envs/dev/platform.tfvars -out plan.tfplan
terraform apply plan.tfplan
```

Creates: VPC (3 AZs), EKS Auto Mode cluster, Aurora PostgreSQL Serverless v2, ElastiCache Valkey, two DynamoDB tables, S3 media bucket, five ECR repositories, per-service Pod Identity roles, Secrets Manager secret, GitHub OIDC deploy role.

## 3. Cluster-config stack

Optional but strongly recommended: request an ACM certificate for a domain (e.g. `dev.beef.example`) and set `certificate_arn` in `cluster-config.tfvars`. Without it the ALB serves plain HTTP and tokens cross the internet unencrypted.

```bash
cd ../cluster-config
terraform init -backend-config=../../envs/dev/cluster-config.backend.hcl
terraform apply -var-file=../../envs/dev/cluster-config.tfvars
```

Creates: `beef` namespace (restricted Pod Security), one Secret per service, the `beef-env` ConfigMap, and the `beef-alb` IngressClass for EKS Auto Mode.

## 4. GitHub

Settings → Environments → `dev` → Variables:

| Variable | Value |
| --- | --- |
| `AWS_REGION` | `us-east-2` |
| `AWS_DEPLOY_ROLE_ARN` | `terraform output -raw deploy_role_arn` (platform stack) |
| `EKS_CLUSTER_NAME` | `terraform output -raw cluster_name` |
| `ECR_REGISTRY` | `<account>.dkr.ecr.us-east-2.amazonaws.com` |
| `DEV_BASE_URL` | `https://dev.beef.example` or `http://<alb-dns-name>` |

Merge to `main`. CI runs, then `deploy-dev` builds and pushes images, deploys with Helm, and runs the e2e test against AWS (`E2E_REMOTE=1`).

The ALB is created on the first deploy. Find its DNS name with:

```bash
kubectl -n beef get ingress core-api -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

## 5. Verify

- `kubectl -n beef get pods` shows 2+ ready replicas for each of the five services
- `curl $DEV_BASE_URL/v1/status` returns `{"ok":true,"service":"beef"}`
- `curl -X POST $DEV_BASE_URL/internal/results` returns 404 (internal routes are never exposed)
- The `deploy-dev` workflow's e2e step is green: Bronze exit test passed in AWS

## Tear down (dev)

```bash
helm -n beef uninstall core-api chat game-engine matchmaking safety   # removes the ALB
cd infra/terraform/stacks/cluster-config && terraform destroy -var-file=../../envs/dev/cluster-config.tfvars
cd ../platform && terraform destroy -var-file=../../envs/dev/platform.tfvars
```

Uninstall the Helm releases first so the load balancer controller deletes the ALB before Terraform removes the subnets it lives in.
