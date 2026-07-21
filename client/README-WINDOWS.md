# LapCam Client for Windows

## Quick Start

### Option 1: Download Pre-built Executable (Recommended)
1. Download `LapCamClient.zip` from releases
2. Extract to a folder (e.g., `C:\LapCam`)
3. Copy your `config.aws.yaml` to the same folder
4. Run `LapCamClient.exe --config config.aws.yaml`

### Option 2: Build Yourself

#### Prerequisites
- Python 3.10 or higher ([Download](https://www.python.org/downloads/))
- Microsoft Visual C++ Redistributable ([Download](https://aka.ms/vs/17/release/vc_redist.x64.exe))

#### Build Steps
1. Open Command Prompt as Administrator
2. Navigate to the client folder:
   ```cmd
   cd C:\path\to\lapcam\client
   ```

3. Run the build script:
   ```cmd
   build-windows.bat
   ```

4. Wait for the build to complete (~5-10 minutes)

5. Find the executable in:
   ```
   dist\LapCamClient\LapCamClient.exe
   ```

## Usage

### Running the Client
```cmd
LapCamClient.exe --config config.aws.yaml
```

### Run as Background Service (Windows)

1. Download [NSSM](https://nssm.cc/download)

2. Install service:
   ```cmd
   nssm install LapCamClient "C:\path\to\LapCamClient.exe" "--config" "config.aws.yaml"
   ```

3. Start service:
   ```cmd
   nssm start LapCamClient
   ```

4. Service will auto-start on boot

### Configuration

Edit `config.aws.yaml`:
```yaml
server:
  url: "https://sec.sigma-chat.biz"
  api_key: "your-api-key-here"

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
```

## Troubleshooting

### Camera Not Found
- Check `device_index` in config (try 0, 1, 2...)
- Ensure camera is not used by another app (Zoom, Teams, etc.)

### Build Fails
- Make sure you're running as Administrator
- Install Visual C++ Redistributable
- Try: `pip install --upgrade pip setuptools wheel`

### High CPU Usage
- Lower framerate in config (try 10 instead of 15)
- Reduce resolution (try 320x240)

## File Structure
```
LapCamClient/
├── LapCamClient.exe      # Main executable
├── config.aws.yaml       # Configuration file
└── logs/                 # Log files (created automatically)
```

## Support
For issues, check server logs at: https://sec.sigma-chat.biz/

## Preventing Sleep Mode (IMPORTANT!)

Your Windows PC will go to sleep when idle, which stops camera monitoring.

### Option 1: Run the Disable Sleep Script (Recommended)

1. Right-click `disable-sleep-windows.bat`
2. Select **"Run as administrator"**
3. Click "Yes" on the UAC prompt
4. Wait for "Done!" message

This sets your power plan to **High Performance** and disables sleep entirely.

### Option 2: Manual Settings

1. Open **Settings** → **System** → **Power & sleep**
2. Set these to **"Never"**:
   - Screen → When plugged in, turn off after: **Never**
   - Sleep → When plugged in, PC goes to sleep after: **Never**

### Option 3: Control Panel

1. Open **Control Panel** → **Power Options**
2. Select **"High performance"** plan
3. Click **"Change plan settings"**
4. Set both options to **"Never"**
5. Click **"Save changes"**

---

## Quick Checklist Before Vacation

- [ ] Run `disable-sleep-windows.bat` as Administrator
- [ ] Verify camera is streaming (green light on camera)
- [ ] Test web UI shows 🟢 Live status
- [ ] Wave hand in front of camera - verify motion detected
- [ ] Check screenshot appears in UI
- [ ] Plug in laptop charger (don't run on battery!)
- [ ] Close other applications (free up resources)
- [ ] Test remote access from phone (use mobile data, not WiFi)

---

## Reverting After Vacation

When you return, re-enable normal power saving:

```cmd
powercfg -restoredefaultschemes
```

Or manually set your preferred power plan back.
