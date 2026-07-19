terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "LapCam"
      Environment = "personal"
      ManagedBy   = "terraform"
    }
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# VPC
resource "aws_vpc" "lapcam" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "lapcam-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "lapcam" {
  vpc_id = aws_vpc.lapcam.id

  tags = {
    Name = "lapcam-igw"
  }
}

# Public Subnet
resource "aws_subnet" "lapcam_public" {
  vpc_id                  = aws_vpc.lapcam.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "lapcam-public-subnet"
  }
}

# Route Table
resource "aws_route_table" "lapcam_public" {
  vpc_id = aws_vpc.lapcam.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.lapcam.id
  }

  tags = {
    Name = "lapcam-public-rt"
  }
}

# Route Table Association
resource "aws_route_table_association" "lapcam_public" {
  subnet_id      = aws_subnet.lapcam_public.id
  route_table_id = aws_route_table.lapcam_public.id
}

# Security Group for EC2
resource "aws_security_group" "lapcam_server" {
  name        = "lapcam-server-sg"
  description = "Security group for LapCam server"
  vpc_id      = aws_vpc.lapcam.id

  # HTTPS from anywhere (for Web UI and signaling)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS for Web UI and WebRTC signaling"
  }

  # WebRTC UDP ports (mediasoup default range)
  ingress {
    from_port   = 10000
    to_port     = 10100
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "WebRTC media traffic (UDP)"
  }

  # WebRTC TCP ports (fallback)
  ingress {
    from_port   = 10000
    to_port     = 10100
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "WebRTC media traffic (TCP)"
  }

  # SSH from your IP (optional - restrict to your IP)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access (restrict in production)"
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "lapcam-server-sg"
  }
}

# S3 Bucket for Recordings
resource "aws_s3_bucket" "recordings" {
  bucket = "lapcam-recordings-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "lapcam-recordings"
    Description = "Video recordings storage"
  }
}

# S3 Bucket Versioning (optional, for backup)
resource "aws_s3_bucket_versioning" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  
  versioning_configuration {
    status = "Disabled" # Enable if you want versioning
  }
}

# S3 Lifecycle Policy - Delete after 7 days
resource "aws_s3_bucket_lifecycle_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    id     = "expire-old-recordings"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 7
    }
  }
}

# S3 Bucket Policy (private, only accessible via IAM)
resource "aws_s3_bucket_policy" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonHTTPS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          aws_s3_bucket.recordings.arn,
          "${aws_s3_bucket.recordings.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# CORS Configuration for S3 (allow video playback)
resource "aws_s3_bucket_cors_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://${var.domain}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# IAM Role for EC2
resource "aws_iam_role" "lapcam_server" {
  name = "lapcam-server-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for S3 Access
resource "aws_iam_role_policy" "lapcam_s3" {
  name = "lapcam-s3-access"
  role = aws_iam_role.lapcam_server.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.recordings.arn,
          "${aws_s3_bucket.recordings.arn}/*"
        ]
      }
    ]
  })
}

# Instance Profile
resource "aws_iam_instance_profile" "lapcam_server" {
  name = "lapcam-server-profile"
  role = aws_iam_role.lapcam_server.name
}

# EC2 Instance
resource "aws_instance" "lapcam_server" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.lapcam_public.id
  vpc_security_group_ids = [aws_security_group.lapcam_server.id]
  iam_instance_profile   = aws_iam_instance_profile.lapcam_server.name
  key_name               = var.key_name

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  user_data = templatefile("${path.module}/user_data.sh", {
    domain       = var.domain
    s3_bucket    = aws_s3_bucket.recordings.bucket
    aws_region   = var.aws_region
  })

  tags = {
    Name = "lapcam-server"
  }
}

# Elastic IP (optional, for static IP)
resource "aws_eip" "lapcam_server" {
  domain   = "vpc"
  instance = aws_instance.lapcam_server.id

  tags = {
    Name = "lapcam-eip"
  }
}

# Route53 Record (if using domain)
resource "aws_route53_record" "lapcam" {
  count   = var.create_dns_record ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.domain
  type    = "A"
  ttl     = "300"
  records = [aws_eip.lapcam_server.public_ip]
}

# Outputs
output "server_public_ip" {
  description = "Public IP address of the LapCam server"
  value       = aws_eip.lapcam_server.public_ip
}

output "server_url" {
  description = "URL to access the LapCam web UI"
  value       = "https://${var.domain}"
}

output "s3_bucket_name" {
  description = "S3 bucket name for recordings"
  value       = aws_s3_bucket.recordings.bucket
}
