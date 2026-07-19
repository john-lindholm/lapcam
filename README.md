# LapCam - Home Surveillance System

A self-hosted home surveillance system using WebRTC for real-time streaming to AWS.

## Architecture

```
┌─────────────────┐      ┌─────────────────┐
│  Client Daemon  │      │  Client Daemon  │
│  (Ubuntu/Win)   │      │  (Ubuntu/Win)   │
│   Webcam        │      │   Webcam        │
└────────┬────────┘      └────────┬────────┘
         │      WebRTC            │
         └───────────┬────────────┘
                     │
            ┌────────▼────────┐
            │   AWS EC2       │
            │   - Signaling   │
            │   - Web UI      │
            │   - SFU/Media   │
            └────────┬────────┘
                     │
            ┌────────▼────────┐
            │   AWS S3        │
            │   - Recordings  │
            └─────────────────┘
```

## Components

- **client/** - Python daemon for capturing and streaming webcam footage
- **server/** - Node.js server with WebRTC SFU, signaling, and recording
- **web-ui/** - React web interface for live viewing and playback
- **terraform/** - Infrastructure as Code for AWS deployment

## Quick Start

### Local Testing (Recommended for Development)

```bash
# Generate SSL certificate
./scripts/generate-selfsigned-cert.sh

# Start server with Docker Compose
docker-compose --profile with-localstack up -d

# Access Web UI
# https://localhost:8443 (admin/admin123)

# Run client locally
cd client
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp config.local.yaml config.yaml
python main.py --config config.yaml
```

See [docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md) for details.

### AWS Deployment

```bash
cd terraform
terraform init
terraform apply
```

### 2. Setup Server

```bash
# SSH into EC2 instance
ssh -i your-key.pem ubuntu@<ec2-ip>

# Install dependencies
sudo apt update && sudo apt install -y nodejs npm coturn

# Deploy server
scp -r ../server ubuntu@<ec2-ip>:~/lapcam-server
cd ~/lapcam-server
npm install
npm run build

# Start server
sudo systemctl start lapcam-server
```

### 3. Setup Clients

**Ubuntu:**
```bash
cd client
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py --config config.yaml
```

**Windows:**
```powershell
cd client
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python main.py --config config.yaml
```

## Configuration

See `docs/` for detailed setup instructions.

## License

MIT
