# Terraform S3 backend configuration.
# NOTE: The S3 bucket and DynamoDB table must already exist before using this backend.
terraform {
  backend "s3" {
    bucket         = "luminai-terraform-state-dev"
    key            = "dev/vpc/terraform.tfstate"
    region         = "af-south-1"
    dynamodb_table = "luminai-terraform-locks"
    encrypt        = true
  }
}

# If you don't have the S3 bucket/table yet, comment out the `backend` block
# above for the first run and use local state. Once the bucket and table exist,
# run `terraform init -migrate-state` to move the local state into S3.
