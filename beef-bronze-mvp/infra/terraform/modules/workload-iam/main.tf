# Least-privilege AWS access per service through EKS Pod Identity. Each pod's
# service account maps to one role; no node-wide credentials, no static keys.

variable "name" { type = string }
variable "cluster_name" { type = string }
variable "namespace" { type = string }
variable "chat_messages_table_arn" { type = string }
variable "move_logs_table_arn" { type = string }
variable "media_bucket_arn" { type = string }

locals {
  policies = {
    "game-engine" = [{
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem", "dynamodb:GetItem"]
      Resource = [var.move_logs_table_arn]
    }]
    "chat" = [{
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem", "dynamodb:Query"]
      Resource = [var.chat_messages_table_arn]
    }]
    "core-api" = [{
      # Presigned media uploads arrive in Silver; scoped to the media bucket only.
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject"]
      Resource = ["${var.media_bucket_arn}/*"]
    }]
  }
}

data "aws_iam_policy_document" "pod_identity_trust" {
  statement {
    actions = ["sts:AssumeRole", "sts:TagSession"]
    principals {
      type        = "Service"
      identifiers = ["pods.eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "svc" {
  for_each           = local.policies
  name               = "${var.name}-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.pod_identity_trust.json
}

resource "aws_iam_role_policy" "svc" {
  for_each = local.policies
  name     = "access"
  role     = aws_iam_role.svc[each.key].id
  policy   = jsonencode({ Version = "2012-10-17", Statement = each.value })
}

resource "aws_eks_pod_identity_association" "svc" {
  for_each        = local.policies
  cluster_name    = var.cluster_name
  namespace       = var.namespace
  service_account = each.key
  role_arn        = aws_iam_role.svc[each.key].arn
}

output "role_arns" {
  value = { for k, r in aws_iam_role.svc : k => r.arn }
}
