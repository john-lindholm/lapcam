#!/bin/bash
# Setup LapCam client on Ubuntu/Debian

set -e

INSTALL_DIR="${INSTALL_DIR:-/opt/lapcam-client}"
CONFIG_DIR="${CONFIG_DIR:-/etc/lapcam}"
LOG_DIR="${LOG_DIR:-/var/log/lapcam}"
USER="${USER:-lapcam}"

echo "Installing LapCam Client..."

# Install system dependencies
sudo apt-get update
sudo apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libavformat-dev \
    libavfilter-dev \
    libavdevice-dev \
    ffmpeg \
    libjpeg-dev \
    cmake

# Create directories
sudo mkdir -p $INSTALL_DIR $CONFIG_DIR $LOG_DIR
sudo chown -R $USER:$USER $INSTALL_DIR $CONFIG_DIR $LOG_DIR

# Copy client code
cp -r ../client/* $INSTALL_DIR/

# Create virtual environment
cd $INSTALL_DIR
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create config if not exists
if [ ! -f "$CONFIG_DIR/config.yaml" ]; then
    sudo cp config.example.yaml $CONFIG_DIR/config.yaml
    echo "Edit $CONFIG_DIR/config.yaml with your settings"
fi

# Create systemd service
sudo tee /etc/systemd/system/lapcam-client.service > /dev/null << EOF
[Unit]
Description=LapCam Client Daemon
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment=PATH=$INSTALL_DIR/venv/bin
ExecStart=$INSTALL_DIR/venv/bin/python main.py --config $CONFIG_DIR/config.yaml
Restart=always
RestartSec=10
StandardOutput=$LOG_DIR/client.log
StandardError=$LOG_DIR/client.error

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable lapcam-client

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit config: sudo nano $CONFIG_DIR/config.yaml"
echo "2. Start service: sudo systemctl start lapcam-client"
echo "3. Check status: sudo systemctl status lapcam-client"
echo "4. View logs: sudo journalctl -u lapcam-client -f"
