# Stack 1 of 2: AWS platform (network, EKS, data stores, registries, IAM, secrets).
#
#   cd infra/terraform/stacks/platform
#   terraform init -backend-config=../../envs/dev/platform.backend.hcl
#   terraform apply -var-file=../../envs/dev/platform.tfvars

terraform {
  required_version = ">= 1.11"
  backend "s3" {} # bucket/key/region come from envs/<env>/platform.backend.hcl
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.70" }
    random = { source = "hashicorp/random", version = "~> 3.7" }
    tls    = { source = "hashicorp/tls", version = "~> 4.1" }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { app = "beef", env = var.env, managed_by = "terraform", stack = "platform" }
  }
}

locals {
  name     = "beef-${var.env}"
  services = ["core-api", "game-engine", "matchmaking", "chat", "safety"]
}

module "network" {
  source             = "../../modules/network"
  name               = local.name
  cidr               = var.vpc_cidr
  single_nat_gateway = var.single_nat_gateway
  cluster_name       = local.name
}

module "eks" {
  source                = "../../modules/eks"
  name                  = local.name
  kubernetes_version    = var.kubernetes_version
  vpc_id                = module.network.vpc_id
  subnet_ids            = module.network.private_subnet_ids
  public_endpoint_cidrs = var.eks_public_endpoint_cidrs
  admin_role_arns       = var.eks_admin_role_arns
}

module "data" {
  source                     = "../../modules/data"
  name                       = local.name
  vpc_id                     = module.network.vpc_id
  database_subnet_group_name = module.network.database_subnet_group_name
  database_subnet_ids        = module.network.database_subnet_ids
  client_security_group_ids  = [module.eks.cluster_primary_security_group_id]
  postgres_version           = var.postgres_version
  aurora_min_acu             = var.aurora_min_acu
  aurora_max_acu             = var.aurora_max_acu
  aurora_instance_count      = var.aurora_instance_count
  valkey_version             = var.valkey_version
  valkey_node_type           = var.valkey_node_type
  valkey_replicas            = var.valkey_replicas
  deletion_protection        = var.deletion_protection
}

module "ecr" {
  source   = "../../modules/ecr"
  name     = "beef"
  services = local.services
}

module "secrets" {
  source = "../../modules/app-secrets"
  name   = local.name
}

module "workload_iam" {
  source                  = "../../modules/workload-iam"
  name                    = local.name
  cluster_name            = module.eks.cluster_name
  namespace               = var.app_namespace
  chat_messages_table_arn = module.data.chat_messages_table_arn
  move_logs_table_arn     = module.data.move_logs_table_arn
  media_bucket_arn        = module.data.media_bucket_arn
}

data "aws_eks_cluster" "this" {
  name       = module.eks.cluster_name
  depends_on = [module.eks]
}

module "github_oidc" {
  source               = "../../modules/github-oidc"
  name                 = local.name
  github_repository    = var.github_repository
  github_environment   = var.env
  create_oidc_provider = var.create_github_oidc_provider
  ecr_repository_arns  = module.ecr.repository_arns
  cluster_name         = module.eks.cluster_name
  cluster_arn          = data.aws_eks_cluster.this.arn
  namespace            = var.app_namespace
}
