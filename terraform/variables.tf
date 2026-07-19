variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "domain" {
  description = "Domain name for the server (e.g., sec.sigma-chat.biz)"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "ami_id" {
  description = "Ubuntu 22.04 AMI ID (will be looked up if not provided)"
  type        = string
  default     = ""
}

variable "key_name" {
  description = "EC2 key pair name for SSH access"
  type        = string
}

variable "create_dns_record" {
  description = "Whether to create a Route53 DNS record"
  type        = bool
  default     = false
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID (required if create_dns_record is true)"
  type        = string
  default     = ""
}

variable "admin_password" {
  description = "Initial admin password for web UI"
  type        = string
  sensitive   = true
}
