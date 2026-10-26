output "region" { value = var.region }
output "cluster_name" { value = module.eks.cluster_name }
output "cluster_endpoint" { value = module.eks.cluster_endpoint }
output "cluster_certificate_authority_data" { value = module.eks.cluster_certificate_authority_data }
output "ecr_repository_urls" { value = module.ecr.repository_urls }
output "deploy_role_arn" { value = module.github_oidc.deploy_role_arn }
output "app_secret_arn" { value = module.secrets.secret_arn }
output "app_namespace" { value = var.app_namespace }

output "postgres_endpoint" { value = module.data.postgres_endpoint }
output "postgres_username" { value = module.data.postgres_username }
output "postgres_password" {
  value     = module.data.postgres_password
  sensitive = true
}
output "valkey_endpoint" { value = module.data.valkey_endpoint }
output "valkey_auth_token" {
  value     = module.data.valkey_auth_token
  sensitive = true
}
output "chat_messages_table" { value = module.data.chat_messages_table }
output "move_logs_table" { value = module.data.move_logs_table }
output "media_bucket" { value = module.data.media_bucket }
