#!/bin/bash
# View LapCam server logs in real-time
# Usage: ./view-logs.sh <EC2_HOST> <KEY_FILE>

set -e

EC2_HOST="${1:-}"
KEY_FILE="${2:-$HOME/.ssh/lapcam-key.pem}"

if [ -z "$EC2_HOST" ]; then
    # Try to get from terraform
    EC2_HOST=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=lapcam-server" "Name=instance-state-name,Values=running" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text 2>/dev/null)
    
    if [ -z "$EC2_HOST" ] || [ "$EC2_HOST" = "None" ]; then
        echo "❌ ERROR: Could not find EC2 instance"
        echo "Usage: $0 <EC2_HOST> [KEY_FILE]"
        exit 1
    fi
fi

echo "Connecting to $EC2_HOST..."
echo "Press Ctrl+C to exit"
echo ""

ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ubuntu@"$EC2_HOST" \
    "sudo journalctl -u lapcam-server -f --no-pager"
