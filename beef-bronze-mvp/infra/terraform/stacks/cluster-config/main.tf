# Stack 2 of 2: in-cluster configuration that needs a running cluster:
# the app namespace, Kubernetes Secrets built from Secrets Manager and the
# platform stack's outputs, and the ALB ingress class for EKS Auto Mode.
#
#   cd infra/terraform/stacks/cluster-config
#   terraform init -backend-config=../../envs/dev/cluster-config.backend.hcl
#   terraform apply -var-file=../../envs/dev/cluster-config.tfvars
#
# Bronze stores these secrets in (encrypted) Terraform state. Silver replaces
# this with External Secrets Operator syncing from Secrets Manager, with rotation.

terraform {
  required_version = ">= 1.11"
  backend "s3" {}
  required_providers {
    aws        = { source = "hashicorp/aws", version = "~> 6.70" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 3.4" }
  }
}

variable "region" {
  type    = string
  default = "us-east-2"
}
variable "state_bucket" { type = string }
variable "platform_state_key" { type = string }
variable "app_env" {
  description = "Value of APP_ENV for core-api. Only local and dev allow the dev OTP and liveness stubs."
  type        = string
}
variable "dev_otp_code" {
  description = "Fixed OTP for dev only. Leave null in staging and prod (core-api refuses to start otherwise)."
  type        = string
  default     = null
  sensitive   = true
}
variable "certificate_arn" {
  description = "ACM certificate for HTTPS on the ALB. Strongly recommended even in dev: tokens cross this hop."
  type        = string
  default     = null
}

provider "aws" {
  region = var.region
}

data "terraform_remote_state" "platform" {
  backend = "s3"
  config  = { bucket = var.state_bucket, key = var.platform_state_key, region = var.region }
}

locals {
  p  = data.terraform_remote_state.platform.outputs
  ns = local.p.app_namespace
}

data "aws_eks_cluster_auth" "this" {
  name = local.p.cluster_name
}

provider "kubernetes" {
  host                   = local.p.cluster_endpoint
  cluster_ca_certificate = base64decode(local.p.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.this.token
}

data "aws_secretsmanager_secret_version" "app" {
  secret_id = local.p.app_secret_arn
}

locals {
  app          = jsondecode(data.aws_secretsmanager_secret_version.app.secret_string)
  database_url = "postgres://${local.p.postgres_username}:${local.p.postgres_password}@${local.p.postgres_endpoint}:5432/beef"
  redis_url    = "rediss://:${local.p.valkey_auth_token}@${local.p.valkey_endpoint}:6379"
}

resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = local.ns
    labels = {
      "pod-security.kubernetes.io/enforce" = "restricted"
      "pod-security.kubernetes.io/warn"    = "restricted"
    }
  }
}

# One Secret per service holding only what that service needs (least privilege).
locals {
  service_secrets = {
    "core-api" = merge(
      {
        DATABASE_URL    = local.database_url
        REDIS_URL       = local.redis_url
        JWT_PRIVATE_KEY = local.app.JWT_PRIVATE_KEY
        JWT_PUBLIC_KEY  = local.app.JWT_PUBLIC_KEY
        INTERNAL_TOKEN  = local.app.INTERNAL_TOKEN
        PII_HASH_KEY    = local.app.PII_HASH_KEY
      },
      var.dev_otp_code == null ? {} : { DEV_OTP_CODE = var.dev_otp_code },
    )
    "game-engine" = {
      REDIS_URL      = local.redis_url
      JWT_PUBLIC_KEY = local.app.JWT_PUBLIC_KEY
      INTERNAL_TOKEN = local.app.INTERNAL_TOKEN
    }
    "matchmaking" = {
      REDIS_URL      = local.redis_url
      INTERNAL_TOKEN = local.app.INTERNAL_TOKEN
    }
    "chat" = {
      REDIS_URL       = local.redis_url
      JWT_PUBLIC_KEY  = local.app.JWT_PUBLIC_KEY
      INTERNAL_TOKEN  = local.app.INTERNAL_TOKEN
      SECRET_KEY_BASE = local.app.SECRET_KEY_BASE
    }
    "safety" = {
      DATABASE_URL   = local.database_url
      INTERNAL_TOKEN = local.app.INTERNAL_TOKEN
    }
  }
}

resource "kubernetes_secret_v1" "svc" {
  for_each = local.service_secrets
  metadata {
    name      = "${each.key}-secrets"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }
  data = each.value
}

# Non-secret, environment-specific settings shared by the Helm releases.
resource "kubernetes_config_map_v1" "env" {
  metadata {
    name      = "beef-env"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }
  data = {
    APP_ENV             = var.app_env
    AWS_REGION          = var.region
    DATABASE_SSL        = "require"
    DATABASE_CA_FILE    = "/opt/rds/global-bundle.pem" # baked into the core-api and safety images
    CHAT_MESSAGES_TABLE = local.p.chat_messages_table
    MOVE_LOG_TABLE      = local.p.move_logs_table
    MEDIA_BUCKET        = local.p.media_bucket
  }
}

# EKS Auto Mode's built-in load balancer controller is selected by this IngressClass.
resource "kubernetes_manifest" "alb_class_params" {
  manifest = {
    apiVersion = "eks.amazonaws.com/v1"
    kind       = "IngressClassParams"
    metadata   = { name = "beef-alb" }
    spec = merge(
      { scheme = "internet-facing", group = { name = "beef" } },
      var.certificate_arn == null ? {} : { certificateARNs = [var.certificate_arn] },
    )
  }
}

resource "kubernetes_ingress_class_v1" "alb" {
  metadata { name = "beef-alb" }
  spec {
    controller = "eks.amazonaws.com/alb"
    parameters {
      api_group = "eks.amazonaws.com"
      kind      = "IngressClassParams"
      name      = "beef-alb"
    }
  }
  depends_on = [kubernetes_manifest.alb_class_params]
}

output "namespace" { value = kubernetes_namespace_v1.app.metadata[0].name }
