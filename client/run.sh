#!/bin/bash
# LapCam Client Runner
# Usage: ./run.sh [config_file]

set -e

CONFIG_FILE="${1:-config.yaml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "LapCam Client"
echo "=========================================="
echo ""

# Check if config exists
if [ ! -f "$SCRIPT_DIR/$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $SCRIPT_DIR/$CONFIG_FILE"
    echo ""
    echo "Available configs:"
    ls -la "$SCRIPT_DIR"/*.yaml 2>/dev/null || echo "  No YAML files found"
    exit 1
fi

# Check if virtualenv exists
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo "Creating virtual environment..."
    cd "$SCRIPT_DIR"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt >/dev/null 2>&1
    echo "✓ Virtual environment created"
else
    source "$SCRIPT_DIR/venv/bin/activate"
fi

echo "Config: $CONFIG_FILE"
echo ""

# Show config summary
echo "Configuration:"
python3 -c "
import yaml
with open('$SCRIPT_DIR/$CONFIG_FILE') as f:
    config = yaml.safe_load(f)
    print(f\"  Server: {config['server']['url']}\")
    print(f\"  Camera: {config['camera']['device_index']}\")
    print(f\"  Name: {config['stream']['camera_name']}\")
    print(f\"  Resolution: {config['camera']['width']}x{config['camera']['height']}@{config['camera']['framerate']}fps\")
"
echo ""

# Run the client
echo "Starting client..."
echo "Press Ctrl+C to stop"
echo ""

cd "$SCRIPT_DIR"
python3 main.py --config "$CONFIG_FILE"
