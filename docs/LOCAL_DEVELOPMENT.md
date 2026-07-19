# Local Development Guide

## Quick Start with Docker Compose

### 1. Generate Self-Signed Certificate

```bash
cd scripts
chmod +x generate-selfsigned-cert.sh
./generate-selfsigned-cert.sh
```

This creates `certs/selfsigned.crt` and `certs/selfsigned.key`.

### 2. Start Services

**Basic (Server only):**
```bash
docker-compose up -d
```

**With LocalStack (S3 emulation):**
```bash
docker-compose --profile with-localstack up -d
```

**Full development mode (includes React dev server):**
```bash
docker-compose --profile with-localstack --profile dev up -d
```

### 3. Check Status

```bash
docker-compose ps
docker-compose logs -f lapcam-server
```

### 4. Access Web UI

- **Production build:** https://localhost:8443
- **Dev server (if using dev profile):** http://localhost:3000

**Login credentials:**
- Username: `admin`
- Password: `admin123`

**Note:** Browser will show SSL warning for self-signed certificate. Accept it to proceed.

### 5. Setup Client

**Option A: Run client locally (recommended for testing)**

```bash
cd client
python3 -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt

# Use local config
cp config.local.yaml config.yaml

# Edit config.yaml and get API key from server
# (Register via API or web UI first)

python main.py --config config.yaml
```

**Option B: Run client in Docker**

```bash
docker-compose -f docker-compose.client.yml up -d
```

### 6. Register a Test Camera

```bash
# Get an API key (via web UI or directly in database)
# Then register:

curl -k -X POST https://localhost:8443/api/cameras/register \
  -H "X-API-Key: local-test-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "camera_name": "test-camera",
    "capabilities": {
      "resolution": "1280x720",
      "framerate": 30,
      "motion_detection": true
    }
  }'
```

### 7. View Logs

```bash
# Server logs
docker-compose logs -f lapcam-server

# LocalStack logs (if running)
docker-compose logs -f localstack

# Client logs (if running locally)
tail -f /tmp/lapcam/client.log
```

## Manual Server Setup (Without Docker)

### Prerequisites

- Node.js 20+
- Python 3.9+
- OpenSSL (for certificates)

### 1. Install Dependencies

```bash
cd server
npm install
npm run build
```

### 2. Generate Certificate

```bash
mkdir -p certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certs/selfsigned.key \
    -out certs/selfsigned.crt \
    -subj "/CN=localhost"
```

### 3. Configure Environment

```bash
cp .env.local .env
# Edit .env with your settings
```

### 4. Run Server

```bash
npm start
```

### 5. Access

- Web UI: https://localhost:8080
- WebSocket: wss://localhost:8080/ws/:cameraName

## Using Real AWS S3 for Testing

If you want to test with real S3 instead of LocalStack:

1. Set AWS credentials in `.env`:
   ```bash
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   S3_BUCKET=your-lapcam-bucket
   ```

2. Ensure bucket exists and has proper CORS configuration

3. Start server without LocalStack profile:
   ```bash
   docker-compose up -d
   ```

## Troubleshooting

### WebRTC Connection Fails

1. Check firewall allows ports 10000-10100
2. Verify PUBLIC_IP is set correctly in .env
3. Check server logs for mediasoup errors

### Certificate Issues

```bash
# Regenerate certificate
rm -rf certs/
./scripts/generate-selfsigned-cert.sh

# Restart server
docker-compose restart lapcam-server
```

### LocalStack Not Starting

```bash
# Check logs
docker-compose logs localstack

# Remove volume and restart
docker-compose down -v
docker-compose --profile with-localstack up -d
```

### Can't Access Web UI

1. Check if server is running: `docker-compose ps`
2. Check logs: `docker-compose logs lapcam-server`
3. Verify port 8443 is not in use
4. Try http://localhost:8080 (non-SSL fallback)

## Development Tips

### Hot Reload

For automatic reload during development:

```bash
# In server directory (on host)
npm run dev

# Or with nodemon
npx nodemon --watch src --exec ts-node src/index.ts
```

### Database Inspection

```bash
# Access SQLite database
docker-compose exec lapcam-server sqlite3 /var/lib/lapcam/lapcam.db

# Useful queries
SELECT * FROM cameras;
SELECT * FROM recordings ORDER BY start_time DESC LIMIT 10;
```

### S3 Bucket Inspection (LocalStack)

```bash
# List buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# List objects
aws --endpoint-url=http://localhost:4566 s3 ls s3://lapcam-local-test --recursive

# Download a file
aws --endpoint-url=http://localhost:4566 s3 cp s3://lapcam-local-test/path/to/file.webm ./downloaded.webm
```

### Clean Slate

```bash
# Stop all services and remove volumes
docker-compose down -v

# Remove all containers
docker-compose rm -f

# Restart fresh
docker-compose --profile with-localstack up -d
```

## Performance Notes

- LocalStack uses more RAM (~500MB)
- Mediasoup requires compilation on first build
- WebRTC works best on same network (localhost is ideal)
- For multiple cameras, increase NUM_WORKERS in .env
