# LapCam Client Configuration Guide

## Ubuntu/Debian

### Quick Install

```bash
cd scripts
chmod +x install-client-linux.sh
./install-client-linux.sh
```

### Manual Install

1. **Install dependencies:**
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv \
    libavformat-dev libavfilter-dev libavdevice-dev ffmpeg
```

2. **Setup client:**
```bash
cd client
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. **Configure:**
```bash
cp config.example.yaml ~/.lapcam-config.yaml
nano ~/.lapcam-config.yaml
```

4. **Run:**
```bash
python main.py --config ~/.lapcam-config.yaml
```

### Run as Systemd Service

```bash
sudo systemctl enable lapcam-client
sudo systemctl start lapcam-client
sudo systemctl status lapcam-client
```

## Windows

### Install

1. **Install Python 3.9+** from python.org
2. **Install Visual C++ Redistributable** (required for aiortc)
3. **Setup:**

```powershell
cd lapcam\client
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

4. **Configure:**
```powershell
Copy-Item config.example.yaml config.yaml
notepad config.yaml
```

5. **Run:**
```powershell
python main.py --config config.yaml
```

### Run as Windows Service

Use NSSM (Non-Sucking Service Manager):

```powershell
# Download nssm.exe and add to PATH
nssm install LapCamClient
# Set Path: C:\path\to\python.exe
# Set Arguments: main.py --config C:\path\to\config.yaml
# Set Startup directory: C:\path\to\lapcam\client

nssm start LapCamClient
```

## Configuration Options

```yaml
server:
  url: "wss://sec.sigma-chat.biz"  # Your server URL
  api_key: "your-api-key-here"      # From web UI

camera:
  device_index: 0    # Camera device (0 = default)
  width: 1280        # Resolution
  height: 720
  framerate: 30

stream:
  camera_name: "kitchen"  # Unique identifier
  video_bitrate: 500      # kbps
  motion_detection: true  # Enable motion detection
  motion_sensitivity: 0.3 # 0-1, lower = more sensitive
  motion_min_area: 500    # Minimum motion area in pixels

recording:
  continuous: true        # Always record
  segment_duration: 10    # Seconds per segment
  buffer_dir: "/tmp/lapcam-buffer"

logging:
  level: "INFO"          # DEBUG, INFO, WARNING, ERROR
  file: "/var/log/lapcam/client.log"
```

## Multiple Cameras

Run multiple instances with different configs:

```bash
# Camera 1
python main.py --config kitchen.yaml &

# Camera 2
python main.py --config living-room.yaml &
```

Or use systemd services:
```bash
sudo systemctl enable lapcam-client@kitchen
sudo systemctl enable lapcam-client@living-room
```

## Troubleshooting

### Camera not found
```bash
# List available cameras
ls -l /dev/video*
# or
ffprobe -f v4l2 -list_formats all -i /dev/video0
```

### Connection refused
- Check server is running
- Verify firewall allows outbound HTTPS
- Confirm API key is correct

### High CPU usage
- Reduce resolution or framerate
- Lower video_bitrate
- Disable motion detection if not needed

### Motion detection too sensitive
- Increase `motion_sensitivity` (0.5-0.7)
- Increase `motion_min_area`
