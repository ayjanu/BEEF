variable "env" {
  description = "Environment name: dev, staging, or prod."
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env must be dev, staging, or prod."
  }
}

variable "region" {
  type    = string
  default = "us-east-2"
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "single_nat_gateway" {
  type    = bool
  default = true
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version. 1.37 was the newest in EKS standard support as of Oct 2026."
  type        = string
  default     = "1.37"
}

variable "eks_public_endpoint_cidrs" {
  description = "Who may reach the Kubernetes API. Set to your office/VPN ranges; never leave 0.0.0.0/0 in prod."
  type        = list(string)
}

variable "eks_admin_role_arns" {
  type    = list(string)
  default = []
}

variable "postgres_version" {
  description = "Aurora PostgreSQL engine version (17.9 announced by AWS on Apr 7, 2026)."
  type        = string
  default     = "17.9"
}

variable "aurora_min_acu" {
  type    = number
  default = 0
}

variable "aurora_max_acu" {
  type    = number
  default = 4
}

variable "aurora_instance_count" {
  type    = number
  default = 1
}

variable "valkey_version" {
  type    = string
  default = "8.1"
}

variable "valkey_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "valkey_replicas" {
  type    = number
  default = 0
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "app_namespace" {
  type    = string
  default = "beef"
}

variable "github_repository" {
  description = "owner/repo that deploys to this environment."
  type        = string
}

variable "create_github_oidc_provider" {
  description = "Create the account-wide GitHub OIDC provider here (true in exactly one stack per account)."
  type        = bool
  default     = true
}
