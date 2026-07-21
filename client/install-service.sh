#!/bin/bash
# LapCam Client - Systemd Service Installer

set -e

SERVICE_NAME="lapcam-client"
SERVICE_FILE="$(dirname "$0")/${SERVICE_NAME}.service"
SYSTEMD_DIR="/etc/systemd/system"

echo "📹 LapCam Client Service Installer"
echo "=================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run with sudo: sudo ./install-service.sh"
    exit 1
fi

# Check if service file exists
if [ ! -f "$SERVICE_FILE" ]; then
    echo "❌ Service file not found: $SERVICE_FILE"
    exit 1
fi

# Install service
echo "📋 Installing service..."
cp "$SERVICE_FILE" "${SYSTEMD_DIR}/${SERVICE_NAME}.service"

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Enable service (start on boot)
echo "✅ Enabling service..."
systemctl enable "$SERVICE_NAME"

echo ""
echo "✅ Installation complete!"
echo ""
echo "Commands:"
echo "  sudo systemctl start ${SERVICE_NAME}     # Start now"
echo "  sudo systemctl stop ${SERVICE_NAME}      # Stop"
echo "  sudo systemctl status ${SERVICE_NAME}    # Check status"
echo "  journalctl -u ${SERVICE_NAME} -f         # View logs"
echo ""
echo "Uninstall: sudo $(dirname "$0")/uninstall-service.sh"
