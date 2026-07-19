# Local Testing Quick Start

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local server dev)
- Python 3.9+ (for client)
- OpenSSL (certificate generated automatically)

## Option 1: Full Stack with Docker Compose (Recommended)

### Start Everything

```bash
# Start server + LocalStack (S3 emulator)
docker-compose --profile with-localstack up -d

# View logs
docker-compose logs -f
```

### Access

- **Web UI:** https://localhost:8443
  - Username: `admin`
  - Password: `admin123`
- **API:** https://localhost:8443/api

### Register Test Camera

```bash
curl -k -X POST https://localhost:8443/api/cameras/register \
  -H "X-API-Key: local-test-api-key" \
  -H "Content-Type: application/json" \
  -d '{"camera_name": "test-camera", "capabilities": {}}'
```

### Run Client Locally

```bash
cd client
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp config.local.yaml config.yaml
# Edit config.yaml if needed (API key, camera name)

python main.py --config config.yaml
```

## Option 2: Manual Server Setup

```bash
cd server
npm install
npm run build

# Copy and edit .env
cp .env.local .env

npm start
```

Access: https://localhost:8080

## Option 3: Test Client Without Server

For testing client dependencies only:

```bash
cd client
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Test camera access
python3 -c "import cv2; cap = cv2.VideoCapture(0); print('Camera OK' if cap.isOpened() else 'Camera NOT found')"
```

## Verify Services

```bash
# Check containers
docker-compose ps

# Server health check
curl -k https://localhost:8443/api/health

# View server logs
docker-compose logs lapcam-server

# Access database
docker-compose exec lapcam-server sqlite3 /var/lib/lapcam/lapcam.db "SELECT * FROM cameras;"
```

## Common Issues

**SSL Certificate Warning:** Normal for self-signed cert. Accept in browser.

**Port Already in Use:** Change ports in docker-compose.yml

**WebRTC Fails:** Ensure ports 10000-10100 are available

**Camera Not Found (Client):** 
- Linux: `ls -l /dev/video*`
- Windows: Check Device Manager
- Try `device_index: 1` or higher in config

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (deletes all data)
docker-compose down -v
```
