# VPC across three AZs: public subnets (load balancers), private subnets (EKS
# nodes and pods), and isolated database subnets (Aurora, ElastiCache).

variable "name" { type = string }
variable "cidr" {
  type    = string
  default = "10.40.0.0/16"
}
variable "single_nat_gateway" {
  description = "One NAT for the whole VPC (cheap, dev) vs one per AZ (resilient, prod)."
  type        = bool
  default     = true
}
variable "cluster_name" { type = string }

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.7"

  name = var.name
  cidr = var.cidr
  azs  = local.azs

  public_subnets   = [for i in range(3) : cidrsubnet(var.cidr, 8, i)]
  private_subnets  = [for i in range(3) : cidrsubnet(var.cidr, 4, i + 1)] # /20s: room for many pods
  database_subnets = [for i in range(3) : cidrsubnet(var.cidr, 8, i + 100)]

  enable_nat_gateway     = true
  single_nat_gateway     = var.single_nat_gateway
  one_nat_gateway_per_az = !var.single_nat_gateway
  enable_dns_hostnames   = true
  enable_dns_support     = true

  create_database_subnet_group = true

  # Tags the EKS Auto Mode load balancer controller uses to place ALBs.
  public_subnet_tags = {
    "kubernetes.io/role/elb"                    = 1
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"           = 1
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

output "vpc_id" { value = module.vpc.vpc_id }
output "vpc_cidr" { value = module.vpc.vpc_cidr_block }
output "private_subnet_ids" { value = module.vpc.private_subnets }
output "public_subnet_ids" { value = module.vpc.public_subnets }
output "database_subnet_group_name" { value = module.vpc.database_subnet_group_name }
output "database_subnet_ids" { value = module.vpc.database_subnets }
