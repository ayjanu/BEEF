# EKS in Auto Mode: AWS manages compute (Karpenter-based node pools), the load
# balancer controller, EBS CSI, and the Pod Identity agent. This replaces the
# node groups + Karpenter + controller installs Spec 03 assumed, with far less
# to operate at Bronze, while keeping the "EKS + Karpenter" architecture.

variable "name" { type = string }
variable "kubernetes_version" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "public_endpoint_cidrs" {
  description = "CIDRs allowed to reach the Kubernetes API publicly. Narrow this to office/VPN ranges."
  type        = list(string)
}
variable "admin_role_arns" {
  description = "IAM roles granted cluster-admin through EKS access entries (no aws-auth ConfigMap)."
  type        = list(string)
  default     = []
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.29"

  name               = var.name
  kubernetes_version = var.kubernetes_version

  endpoint_public_access       = true
  endpoint_public_access_cidrs = var.public_endpoint_cidrs
  endpoint_private_access      = true

  # Whoever runs `terraform apply` gets admin, so the k8s stack can bootstrap.
  enable_cluster_creator_admin_permissions = true

  compute_config = {
    enabled    = true
    node_pools = ["general-purpose", "system"]
  }

  vpc_id     = var.vpc_id
  subnet_ids = var.subnet_ids

  access_entries = {
    for i, arn in var.admin_role_arns : "admin-${i}" => {
      principal_arn = arn
      policy_associations = {
        admin = {
          policy_arn   = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = { type = "cluster" }
        }
      }
    }
  }

  enabled_log_types = ["api", "audit", "authenticator"]
}

output "cluster_name" { value = module.eks.cluster_name }
output "cluster_endpoint" { value = module.eks.cluster_endpoint }
output "cluster_certificate_authority_data" { value = module.eks.cluster_certificate_authority_data }
output "cluster_primary_security_group_id" { value = module.eks.cluster_primary_security_group_id }
output "node_security_group_id" { value = module.eks.node_security_group_id }
