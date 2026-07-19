#!/bin/bash
# Initialize LocalStack S3 bucket for local testing

set -e

BUCKET_NAME="${S3_BUCKET:-lapcam-local-test}"
REGION="us-east-1"

echo "Waiting for LocalStack to be ready..."
sleep 5

echo "Creating S3 bucket: $BUCKET_NAME..."
aws --endpoint-url=http://localhost:4566 s3 mb s3://$BUCKET_NAME --region $REGION || true

echo "Configuring CORS..."
aws --endpoint-url=http://localhost:4566 s3api put-bucket-cors \
    --bucket $BUCKET_NAME \
    --cors-configuration '{
        "CORSRules": [
            {
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "HEAD", "PUT"],
                "AllowedOrigins": ["*"],
                "ExposeHeaders": ["ETag"],
                "MaxAgeSeconds": 3600
            }
        ]
    }' \
    --region $REGION || true

echo "Bucket configured successfully!"
aws --endpoint-url=http://localhost:4566 s3 ls --region $REGION
