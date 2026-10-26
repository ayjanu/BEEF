# Stateful stores from Spec 03 "Data stores":
#   Aurora PostgreSQL Serverless v2  - source of truth (core-api, safety)
#   ElastiCache for Valkey           - queues, sessions, presence, leaderboards, PubSub
#   DynamoDB                         - chat messages, game move logs
#   S3                               - media (Silver), evidence vault (Gold)

variable "name" { type = string }
variable "vpc_id" { type = string }
variable "database_subnet_group_name" { type = string }
variable "database_subnet_ids" { type = list(string) }
variable "client_security_group_ids" {
  description = "Security groups allowed to reach Postgres and Valkey (the EKS cluster's)."
  type        = list(string)
}
variable "postgres_version" { type = string }
variable "aurora_min_acu" {
  description = "0 lets dev auto-pause when idle; use 0.5+ in prod."
  type        = number
}
variable "aurora_max_acu" { type = number }
variable "aurora_instance_count" { type = number }
variable "valkey_version" { type = string }
variable "valkey_node_type" { type = string }
variable "valkey_replicas" { type = number }
variable "deletion_protection" { type = bool }

# ---------------- Aurora PostgreSQL ----------------

resource "aws_security_group" "postgres" {
  name_prefix = "${var.name}-postgres-"
  description = "Aurora PostgreSQL: reachable only from the EKS cluster"
  vpc_id      = var.vpc_id
  lifecycle { create_before_destroy = true }
}

resource "aws_vpc_security_group_ingress_rule" "postgres" {
  for_each                     = toset(var.client_security_group_ids)
  security_group_id            = aws_security_group.postgres.id
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

# Bronze keeps the password in Terraform (encrypted S3 state) so the k8s stack
# can hand it to pods. Silver moves to External Secrets with rotation.
resource "random_password" "postgres" {
  length  = 40
  special = false
}

resource "aws_rds_cluster" "this" {
  cluster_identifier          = "${var.name}-pg"
  engine                      = "aurora-postgresql"
  engine_mode                 = "provisioned"
  engine_version              = var.postgres_version
  database_name               = "beef"
  master_username             = "beef_admin"
  master_password             = random_password.postgres.result
  db_subnet_group_name        = var.database_subnet_group_name
  vpc_security_group_ids      = [aws_security_group.postgres.id]
  storage_encrypted           = true
  backup_retention_period     = 7
  preferred_backup_window     = "08:00-09:00"
  deletion_protection         = var.deletion_protection
  skip_final_snapshot         = !var.deletion_protection
  final_snapshot_identifier   = var.deletion_protection ? "${var.name}-pg-final" : null
  copy_tags_to_snapshot       = true
  enable_http_endpoint        = false
  allow_major_version_upgrade = false

  serverlessv2_scaling_configuration {
    min_capacity             = var.aurora_min_acu
    max_capacity             = var.aurora_max_acu
    seconds_until_auto_pause = var.aurora_min_acu == 0 ? 1800 : null
  }
}

resource "aws_rds_cluster_instance" "this" {
  count                        = var.aurora_instance_count
  identifier                   = "${var.name}-pg-${count.index}"
  cluster_identifier           = aws_rds_cluster.this.id
  instance_class               = "db.serverless"
  engine                       = aws_rds_cluster.this.engine
  engine_version               = aws_rds_cluster.this.engine_version
  performance_insights_enabled = true
}

# ---------------- ElastiCache for Valkey ----------------
# Node-based, cluster mode DISABLED on purpose: game-engine and matchmaking run
# multi-key Lua scripts (atomic pairing, compare-and-set) that cluster mode's
# hash slots would reject. Serverless ElastiCache is cluster-mode only.

resource "aws_security_group" "valkey" {
  name_prefix = "${var.name}-valkey-"
  description = "Valkey: reachable only from the EKS cluster"
  vpc_id      = var.vpc_id
  lifecycle { create_before_destroy = true }
}

resource "aws_vpc_security_group_ingress_rule" "valkey" {
  for_each                     = toset(var.client_security_group_ids)
  security_group_id            = aws_security_group.valkey.id
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-valkey"
  subnet_ids = var.database_subnet_ids
}

resource "random_password" "valkey" {
  length  = 48
  special = false
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = "${var.name}-valkey"
  description                = "BEEF queues, sessions, presence, leaderboards"
  engine                     = "valkey"
  engine_version             = var.valkey_version
  node_type                  = var.valkey_node_type
  num_cache_clusters         = 1 + var.valkey_replicas
  automatic_failover_enabled = var.valkey_replicas > 0
  multi_az_enabled           = var.valkey_replicas > 0
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.valkey.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.valkey.result
  snapshot_retention_limit   = 1
}

# ---------------- DynamoDB ----------------

resource "aws_dynamodb_table" "chat_messages" {
  name         = "${var.name}-chat-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "thread_id"
  range_key    = "sk"

  attribute {
    name = "thread_id"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }
  deletion_protection_enabled = var.deletion_protection
}

resource "aws_dynamodb_table" "move_logs" {
  name         = "${var.name}-move-logs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }
  deletion_protection_enabled = var.deletion_protection
}

# ---------------- S3 media ----------------

resource "aws_s3_bucket" "media" {
  bucket_prefix = "${var.name}-media-"
  force_destroy = !var.deletion_protection
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "raw-level3-captures-30d" # Spec 04 retention: raw Level 3 video 30 days unless saved
    status = "Enabled"
    filter { prefix = "raw/" }
    expiration { days = 30 }
  }
}

output "postgres_endpoint" { value = aws_rds_cluster.this.endpoint }
output "postgres_username" { value = aws_rds_cluster.this.master_username }
output "postgres_password" {
  value     = random_password.postgres.result
  sensitive = true
}
output "valkey_endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
output "valkey_auth_token" {
  value     = random_password.valkey.result
  sensitive = true
}
output "chat_messages_table" { value = aws_dynamodb_table.chat_messages.name }
output "chat_messages_table_arn" { value = aws_dynamodb_table.chat_messages.arn }
output "move_logs_table" { value = aws_dynamodb_table.move_logs.name }
output "move_logs_table_arn" { value = aws_dynamodb_table.move_logs.arn }
output "media_bucket" { value = aws_s3_bucket.media.bucket }
output "media_bucket_arn" { value = aws_s3_bucket.media.arn }
