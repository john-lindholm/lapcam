# LapCam Deployment Guide

## Prerequisites

- AWS account with admin access
- Domain name (e.g., `sec.sigma-chat.biz`)
- SSH key pair in AWS

## Step 1: Deploy Infrastructure

```bash
cd terraform

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars  # Edit with your values

# Initialize and deploy
terraform init
terraform plan
terraform apply
```

**Important outputs:**
- Server public IP
- S3 bucket name
- SSH command

## Step 2: Configure DNS

Add an A record for your domain:

```
Type: A
Name: sec
Value: <server-public-ip>
TTL: 300
```

Wait for DNS propagation (5-10 minutes).

## Step 3: Deploy Server Code

```bash
# SSH into server
ssh -i your-key.pem ubuntu@<server-ip>

# Build and install server
cd /home/lapcam/lapcam-server

# Copy code from your local machine
# From your local machine:
scp -r ../server/* ubuntu@<server-ip>:/home/lapcam/lapcam-server/
scp -r ../web-ui/build ubuntu@<server-ip>:/home/lapcam/lapcam-server/web-ui/build

# Back on server:
npm install
npm run build

# Copy web UI build
cp -r /path/to/web-ui/build ./web-ui/

# Start server
sudo systemctl start lapcam-server
sudo systemctl status lapcam-server
```

## Step 4: Get SSL Certificate

If DNS is set up correctly:

```bash
sudo certbot --nginx -d sec.sigma-chat.biz --non-interactive --agree-tos --email your@email.com
sudo systemctl reload nginx
sudo systemctl restart lapcam-server
```

## Step 5: Setup Client Cameras

### Ubuntu Client

```bash
# Install dependencies
sudo apt update
sudo apt install -y python3 python3-pip python3-venv libavformat-dev libavfilter-dev libavdevice-dev ffmpeg

# Setup client
cd /path/to/lapcam/client
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure
cp config.example.yaml config.yaml
vim config.yaml  # Edit with server URL and camera name

# Generate API key (via web UI or API)
# Then add to config.yaml

# Run as daemon
nohup python main.py --config config.yaml > /var/log/lapcam.log 2>&1 &

# Or create systemd service (recommended)
```

### Windows Client

```powershell
# Install Python 3.9+
# Install Visual C++ Redistributable

cd lapcam\client
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Configure
copy config.example.yaml config.yaml
notepad config.yaml

# Run
python main.py --config config.yaml

# Or run as Windows service with NSSM
```

## Step 6: Access Web UI

Open browser: `https://sec.sigma-chat.biz`

Default credentials:
- Username: `admin`
- Password: (from terraform.tfvars)

## Step 7: Register Cameras

Via Web UI:
1. Login as admin
2. Go to Cameras section
3. Click "Add Camera"
4. Note the generated API key
5. Add API key to client config

Or via API:
```bash
curl -X POST https://sec.sigma-chat.biz/api/cameras/register \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"camera_name": "kitchen", "capabilities": {}}'
```

## Troubleshooting

### Server not starting
```bash
sudo journalctl -u lapcam-server -f
```

### WebRTC connection issues
- Check security group allows UDP 10000-10100
- Verify public IP in server config
- Check firewall settings

### SSL certificate issues
```bash
sudo certbot certificates
sudo certbot renew
```

### Camera offline
- Check client logs
- Verify network connectivity
- Confirm API key is correct

## Maintenance

### Update server code
```bash
cd /home/lapcam/lapcam-server
git pull  # if using git
npm install
npm run build
sudo systemctl restart lapcam-server
```

### View recordings in S3
```bash
aws s3 ls s3://lapcam-recordings-<account-id>/ --recursive
```

### Backup database
```bash
sudo cp /var/lib/lapcam/lapcam.db /backup/lapcam-$(date +%Y%m%d).db
```

## Cost Estimates

- EC2 t3.medium: ~$30/month
- S3 storage: ~$0.023/GB/month
- Data transfer: First 100GB free

Total estimated: $35-50/month for 2-4 cameras
