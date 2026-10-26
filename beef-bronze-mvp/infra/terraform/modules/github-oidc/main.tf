# Lets GitHub Actions deploy without long-lived AWS keys: the workflow
# exchanges its OIDC token for a short-lived role session. The role can push
# images and deploy into one namespace; it cannot change infrastructure.

variable "name" { type = string }
variable "github_repository" {
  description = "owner/repo allowed to assume the deploy role."
  type        = string
}
variable "github_environment" {
  description = "GitHub environment whose jobs may deploy (protect it with required reviewers for prod)."
  type        = string
}
variable "ecr_repository_arns" { type = list(string) }
variable "cluster_name" { type = string }
variable "cluster_arn" { type = string }
variable "namespace" { type = string }
variable "create_oidc_provider" {
  description = "The GitHub OIDC provider is account-wide; create it in only one environment."
  type        = bool
  default     = true
}

data "aws_caller_identity" "me" {}

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.create_oidc_provider ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  oidc_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${data.aws_caller_identity.me.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.oidc_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:${var.github_environment}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.trust.json
}

resource "aws_iam_role_policy" "deploy" {
  name = "push-and-deploy"
  role = aws_iam_role.deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:DescribeImages",
        ]
        Resource = var.ecr_repository_arns
      },
      { Effect = "Allow", Action = ["eks:DescribeCluster"], Resource = var.cluster_arn },
    ]
  })
}

# Kubernetes rights: edit inside the app namespace only.
resource "aws_eks_access_entry" "deploy" {
  cluster_name  = var.cluster_name
  principal_arn = aws_iam_role.deploy.arn
}

resource "aws_eks_access_policy_association" "deploy" {
  cluster_name  = var.cluster_name
  principal_arn = aws_iam_role.deploy.arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy"
  access_scope {
    type       = "namespace"
    namespaces = [var.namespace]
  }
  depends_on = [aws_eks_access_entry.deploy]
}

output "deploy_role_arn" { value = aws_iam_role.deploy.arn }
