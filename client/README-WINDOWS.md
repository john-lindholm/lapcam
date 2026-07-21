# LapCam Client for Windows

## Quick Start

### Option 1: Run from Source (Development)

```powershell
# 1. Install Python 3.10+ from https://www.python.org/downloads/
#    ☑ Check "Add Python to PATH" during install

# 2. Open Command Prompt in this folder
cd C:\path\to\lapcam\client

# 3. Create virtual environment
python -m venv venv
venv\Scripts\activate

# 4. Install dependencies
pip install --upgrade pip
pip install -r requirements-windows.txt

# 5. Run the client
python main.py --config config.aws.yaml
```

### Option 2: Build Executable (Production)

```powershell
# 1. Open Command Prompt as Administrator
cd C:\path\to\lapcam\client

# 2. Run build script
.\build-windows.bat

# 3. Wait 5-10 minutes for build to complete

# 4. Executable will be in: dist\LapCamClient\LapCamClient.exe
```

---

## Installation Methods

### Method A: Install as Windows Service (Recommended for 24/7)

**Runs automatically on boot, even before login**

```powershell
# 1. Open PowerShell as Administrator
cd C:\path\to\lapcam\client

# 2. Run installer script
.\install-windows-service.ps1

# 3. That's it! Service will auto-start on every boot
```

**Management Commands:**
```powershell
# Check status
schtasks /Query /TN "LapCam Client"

# Stop temporarily
schtasks /End /TN "LapCam Client"

# Start manually
schtasks /Run /TN "LapCam Client"

# Uninstall service
.\install-windows-service.ps1 -Uninstall
```

**Features:**
- ✅ Starts at Windows boot (no login required)
- ✅ Runs as SYSTEM (highest privileges)
- ✅ Auto-restarts on crash (unlimited retries)
- ✅ Works on battery or AC power
- ✅ Uses built-in Windows Task Scheduler (no third-party tools)

---

### Method B: Manual Startup (Simple)

**Only works when user is logged in**

```powershell
# Just run it directly
python main.py --config config.aws.yaml

# Or if you built the .exe:
.\dist\LapCamClient\LapCamClient.exe --config config.aws.yaml
```

**To auto-start on login:**
1. Press `Win + R`
2. Type: `shell:startup`
3. Create shortcut to `LapCamClient.exe` or a batch file

---

## Preventing Sleep Mode (CRITICAL!)

Your PC will go to sleep when idle, stopping camera monitoring.

### Quick Fix: Run the Disable Sleep Script

```powershell
# Right-click this file → Run as Administrator
.\disable-sleep-windows.bat
```

This sets your power plan to **High Performance** and disables:
- Monitor timeout (keeps screen on)
- Hard disk timeout
- Standby/sleep mode

### Manual Alternative

1. Open **Settings** → **System** → **Power & sleep**
2. Set these to **"Never"** (when plugged in):
   - Screen → turn off after: **Never**
   - Sleep → PC goes to sleep after: **Never**

---

## Configuration

Edit `config.aws.yaml`:

```yaml
server:
  url: "https://sec.sigma-chat.biz"
  api_key: "your-api-key-here"  # Get from web UI

camera:
  device_index: 0  # Change if you have multiple cameras
  width: 640
  height: 480
  framerate: 15

stream:
  camera_name: "living-room"
  motion_detection: true
  motion_sensitivity: 0.4
  motion_min_area: 500

jpeg_quality: 75
logging:
  level: "INFO"
```

---

## Troubleshooting

### Camera Not Found
- Check `device_index` in config (try 0, 1, 2...)
- Ensure camera is not used by another app (Zoom, Teams, etc.)
- Test camera in Windows Camera app first

### Service Won't Start
```powershell
# Check if task exists
schtasks /Query /TN "LapCam Client"

# View last run result
Get-ScheduledTaskInfo -TaskName "LapCam Client"

# Run manually to see errors
python main.py --config config.aws.yaml
```

### High CPU Usage
- Lower framerate in config (try 10 instead of 15)
- Reduce resolution (try 320x240)
- Disable motion detection if not needed

### Build Fails
- Make sure you're running as Administrator
- Try: `pip install --upgrade pip setuptools wheel`
- Delete `venv` folder and rebuild: `rmdir /s venv` then `.\build-windows.bat`

---

## File Structure

```
LapCamClient/
├── LapCamClient.exe          # Main executable (after build)
├── main.py                   # Source code (if running from source)
├── config.aws.yaml           # Configuration file
├── requirements-windows.txt  # Python dependencies
├── install-windows-service.ps1  # Service installer
├── disable-sleep-windows.bat    # Prevent sleep mode
└── logs/                     # Log files (created automatically)
```

---

## Quick Checklist Before Vacation

- [ ] Run `disable-sleep-windows.bat` as Administrator
- [ ] Install service: `.\install-windows-service.ps1`
- [ ] Verify service status: `schtasks /Query /TN "LapCam Client"`
- [ ] Test camera is streaming (green light on camera)
- [ ] Test web UI shows 🟢 Live status
- [ ] Wave hand in front of camera - verify motion detected
- [ ] Check screenshot appears in UI
- [ ] Plug in laptop charger (don't run on battery!)
- [ ] Close other applications (free up resources)
- [ ] Test remote access from phone (use mobile data, not WiFi)

---

## Support

For issues, check:
- Server logs: https://sec.sigma-chat.biz/
- Local logs: Check `logs/` folder or Windows Event Viewer
- Motion events: View in web UI under selected camera

