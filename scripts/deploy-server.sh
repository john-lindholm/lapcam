#!/bin/bash
# Deploy LapCam server to EC2 instance

set -e

# Configuration
EC2_USER="ubuntu"
EC2_HOST=""  # Set via argument or environment
KEY_FILE=""  # Set via argument or environment
SERVER_DIR="/home/lapcam/lapcam-server"

usage() {
    echo "Usage: $0 -h <host> -k <key_file>"
    echo "  -h  EC2 host (public IP or DNS)"
    echo "  -k  SSH key file path"
    exit 1
}

while getopts "h:k:" opt; do
    case $opt in
        h) EC2_HOST="$OPTARG" ;;
        k) KEY_FILE="$OPTARG" ;;
        *) usage ;;
    esac
done

if [ -z "$EC2_HOST" ] || [ -z "$KEY_FILE" ]; then
    usage
fi

SSH_OPTS="-i $KEY_FILE -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "Deploying to $EC2_HOST..."

# Create remote directory
ssh $SSH_OPTS $EC2_USER@$EC2_HOST "mkdir -p $SERVER_DIR"

# Copy server code
echo "Copying server code..."
rsync -avz -e "ssh $SSH_OPTS" \
    --exclude 'node_modules' \
    --exclude 'dist' \
    ../server/ \
    $EC2_USER@$EC2_HOST:$SERVER_DIR/

# Copy web UI build (if exists)
if [ -d "../web-ui/build" ]; then
    echo "Copying web UI..."
    rsync -avz -e "ssh $SSH_OPTS" \
        ../web-ui/build/ \
        $EC2_USER@$EC2_HOST:$SERVER_DIR/web-ui/build/
fi

# Install dependencies and build
echo "Installing dependencies and building..."
ssh $SSH_OPTS $EC2_USER@$EC2_HOST << 'EOF'
cd /home/lapcam/lapcam-server
npm install --production
npm run build
EOF

# Restart service
echo "Restarting service..."
ssh $SSH_OPTS $EC2_USER@$EC2_HOST "sudo systemctl restart lapcam-server"

# Check status
echo "Checking service status..."
ssh $SSH_OPTS $EC2_USER@$EC2_HOST "sudo systemctl status lapcam-server --no-pager"

echo "Deployment complete!"
echo "Access the web UI at: https://$EC2_HOST"
