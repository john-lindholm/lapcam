#!/bin/bash
# User data script for LapCam server setup

set -e

DOMAIN="${domain}"
S3_BUCKET="${s3_bucket}"
AWS_REGION="${aws_region}"

# Update system
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# Install dependencies
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    nodejs \
    npm \
    python3 \
    python3-pip \
    git \
    curl \
    wget \
    nginx \
    certbot \
    python3-certbot-nginx \
    build-essential \
    libsqlite3-dev \
    pkg-config \
    libssl-dev

# Install Node.js (newer version)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Create lapcam user
useradd -m -s /bin/bash lapcam
mkdir -p /var/lib/lapcam
mkdir -p /tmp/lapcam-server-buffer
chown -R lapcam:lapcam /var/lib/lapcam
chown -R lapcam:lapcam /tmp/lapcam-server-buffer

# Copy server code (will be done manually or via S3)
sudo -u lapcam mkdir -p /home/lapcam/lapcam-server

# Create environment file
cat > /home/lapcam/lapcam-server/.env << EOF
PORT=8080
DOMAIN=${DOMAIN}
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
SSL_CERT_PATH=/etc/letsencrypt/live/${DOMAIN}/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/${DOMAIN}/privkey.pem
ADMIN_PASSWORD=${admin_password}
JWT_SECRET=$(openssl rand -hex 32)
AWS_REGION=${AWS_REGION}
S3_BUCKET=${S3_BUCKET}
DATABASE_PATH=/var/lib/lapcam/lapcam.db
RECORDING_ENABLED=true
RECORDING_SEGMENT_DURATION=10
BUFFER_DIR=/tmp/lapcam-server-buffer
LOG_LEVEL=info
NUM_WORKERS=1
EOF

chown -R lapcam:lapcam /home/lapcam/lapcam-server/.env
chmod 600 /home/lapcam/lapcam-server/.env

# Create systemd service
cat > /etc/systemd/system/lapcam-server.service << 'EOF'
[Unit]
Description=LapCam Surveillance Server
After=network.target

[Service]
Type=simple
User=lapcam
WorkingDirectory=/home/lapcam/lapcam-server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=lapcam-server

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable lapcam-server

# Nginx configuration
cat > /etc/nginx/sites-available/lapcam << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};
    
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # WebRTC needs large headers
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    location /ws/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/lapcam /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Create certbot directory
mkdir -p /var/www/certbot

# Start nginx
systemctl start nginx
systemctl enable nginx

# Get SSL certificate (this will fail if DNS not set up yet)
certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} || true

# Reload nginx with SSL
systemctl reload nginx

# Log rotation
cat > /etc/logrotate.d/lapcam << 'EOF'
/var/log/lapcam/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 lapcam lapcam
}
EOF

echo "LapCam server setup complete!"
echo "Next steps:"
echo "1. Copy server code to /home/lapcam/lapcam-server"
echo "2. Run: cd /home/lapcam/lapcam-server && npm install && npm run build"
echo "3. Run: sudo systemctl start lapcam-server"
echo "4. Check status: sudo systemctl status lapcam-server"
