#!/bin/bash
# LapCam Client - Systemd Service Uninstaller

set -e

SERVICE_NAME="lapcam-client"

echo "📹 LapCam Client Service Uninstaller"
echo "====================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run with sudo: sudo ./uninstall-service.sh"
    exit 1
fi

# Stop service
echo "🛑 Stopping service..."
systemctl stop "$SERVICE_NAME" 2>/dev/null || true

# Disable service
echo "❌ Disabling service..."
systemctl disable "$SERVICE_NAME" 2>/dev/null || true

# Remove service file
echo "🗑️  Removing service file..."
rm -f "/etc/systemd/system/${SERVICE_NAME}.service"

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

echo ""
echo "✅ Service uninstalled successfully!"
