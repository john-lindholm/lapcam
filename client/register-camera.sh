#!/bin/bash
# Register a new camera with the LapCam server
# Usage: ./register-camera.sh <camera_name>

set -e

CAMERA_NAME="${1:-living-room}"
SERVER_URL="https://sec.sigma-chat.biz"
USERNAME="admin"
PASSWORD="LapCam2026!SecurePass"

echo "=========================================="
echo "LapCam Camera Registration"
echo "=========================================="
echo ""

# Step 1: Login to get token
echo "Logging in to server..."
LOGIN_RESPONSE=$(curl -k -s -X POST "$SERVER_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed. Check username/password."
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✓ Login successful"
echo ""

# Step 2: Generate API key
API_KEY=$(openssl rand -hex 16)
echo "Generated API Key: $API_KEY"
echo ""

# Step 3: Register camera
echo "Registering camera '$CAMERA_NAME'..."
REGISTER_RESPONSE=$(curl -k -s -X POST "$SERVER_URL/api/cameras/register" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"camera_name\":\"$CAMERA_NAME\"}")

echo "Response: $REGISTER_RESPONSE"
echo ""

# Step 4: Create config file
CONFIG_FILE="config.$CAMERA_NAME.yaml"
cat > "$CONFIG_FILE" << YAML
# LapCam Client Configuration for $CAMERA_NAME
# Auto-generated on $(date)

server:
  url: "$SERVER_URL"
  api_key: "$API_KEY"

camera:
  device_index: 0
  width: 1280
  height: 720
  framerate: 30

stream:
  camera_name: "$CAMERA_NAME"
  video_bitrate: 1000
  motion_detection: true
  motion_sensitivity: 0.4
  motion_min_area: 500

logging:
  level: "INFO"
  file: "/tmp/lapcam/$CAMERA_NAME.log"
YAML

echo "✅ Camera registered successfully!"
echo ""
echo "Config file created: $CONFIG_FILE"
echo ""
echo "To start streaming:"
echo "  python3 main.py --config $CONFIG_FILE"
echo "  # or"
echo "  ./run.sh $CONFIG_FILE"
echo ""
echo "View cameras in web UI: $SERVER_URL"
