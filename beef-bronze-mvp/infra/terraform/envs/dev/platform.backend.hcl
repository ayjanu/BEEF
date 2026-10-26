bucket       = "REPLACE_ME-beef-tfstate-ACCOUNT_ID" # output of infra/terraform/bootstrap
key          = "dev/platform.tfstate"
region       = "us-east-2"
encrypt      = true
use_lockfile = true # S3 native locking (Terraform 1.10+); no DynamoDB lock table
