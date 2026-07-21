# LapCam Client

## Quick Start

1. **Generate an API key** for your camera:
   ```bash
   openssl rand -hex 16
   ```

2. **Edit `config.yaml`**:
   ```yaml
   server:
     url: "https://sec.sigma-chat.biz"
     api_key: "<your-generated-key>"
   
   stream:
     camera_name: "living-room"  # Unique name for this camera
   ```

3. **Run the client**:
   ```bash
   ./run.sh
   # or
   python3 main.py --config config.yaml
   ```

## Configuration Options

### Server
- `url`: LapCam server URL (default: https://sec.sigma-chat.biz)
- `api_key`: Unique API key for this camera (required)

### Camera
- `device_index`: Camera device index (0 = default webcam)
- `width`: Video width (default: 1280)
- `height`: Video height (default: 720)
- `framerate`: Frames per second (default: 30)

### Stream
- `camera_name`: Unique name shown in web UI
- `video_bitrate`: Video quality in kbps (default: 1000)
- `motion_detection`: Enable motion detection (default: true)
- `motion_sensitivity`: 0.0-1.0 (default: 0.4)
- `motion_min_area`: Minimum motion area in pixels (default: 500)

## Docker Usage

```bash
docker build -t lapcam-client .
docker run --device /dev/video0:/dev/video0 lapcam-client
```

## Troubleshooting

### Camera not found
- Check `device_index` (try 0, 1, 2...)
- List available cameras: `ls -la /dev/video*`

### Connection failed
- Verify server URL is correct
- Check API key is valid
- Ensure server is running

### High CPU usage
- Lower `framerate` or `width`/`height`
- Reduce `video_bitrate`
- Disable motion detection if not needed
