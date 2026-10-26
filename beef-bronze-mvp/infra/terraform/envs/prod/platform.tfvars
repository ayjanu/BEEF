# Production shape (Gold). Not applied in Bronze; kept here so dev and prod
# differ only in these values, never in code.
env                         = "prod"
region                      = "us-east-2"
vpc_cidr                    = "10.50.0.0/16"
single_nat_gateway          = false # one NAT per AZ
kubernetes_version          = "1.37"
postgres_version            = "17.9"
aurora_min_acu              = 0.5
aurora_max_acu              = 32
aurora_instance_count       = 2 # writer + reader in another AZ
valkey_node_type            = "cache.m7g.large"
valkey_replicas             = 1 # Multi-AZ automatic failover
deletion_protection         = true
github_repository           = "REPLACE_ME/beef"
create_github_oidc_provider = false # created by the dev stack if same account; true if prod is its own account
eks_public_endpoint_cidrs   = ["203.0.113.0/24"]
