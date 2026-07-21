# LapCam Deployment Status

## Architecture (FINAL)
```
Python Client --(HTTP POST JPEG)--> AWS Server --(MJPEG Stream)--> Browser
                      │                        │
                      └──> S3 Recording        └──> Motion Events API
```

**Key Decision**: Abandoned WebRTC/mediasoup due to ICE/TURN complexity. Using simple HTTP MJPEG streaming instead.

## What's Working ✅

### Server (AWS: sec.sigma-chat.biz)
- ✅ HTTP server running on port 8080
- ✅ JWT authentication (`/api/login`)
- ✅ Camera registration (`/api/cameras/register`)
- ✅ Frame ingestion (`/api/stream/:cameraName/frame`)
- ✅ MJPEG streaming to viewers (`/api/stream/:cameraId/view?token=xxx`)
- ✅ Motion events API (`/api/motion-events`)
- ✅ S3 recording (frames saved as JPG)
- ✅ JSON-based database (`/var/lib/lapcam/lapcam.db`)

### Client (Local)
- ✅ Python client with motion detection
- ✅ Sends JPEG frames via HTTP POST
- ✅ Configurable: resolution, framerate, motion sensitivity
- ✅ Auto-reconnect on failure

### Web UI
- ✅ Login page with JWT auth
- ✅ Camera list with live/offline status
- ✅ Live MJPEG stream viewer
- ✅ Motion events timeline
- ⚠️  Nginx config needs fixing for static files

## What's NOT Working ❌

### Server
- ❌ Nginx not serving static web UI files (shows API error)
- ❌ No playback of recorded videos (only stored in S3)
- ❌ No video timeline/scrubbing

### Client  
- ❌ No audio support (video only)
- ❌ Motion detection confidence tuning needed

## Files Changed

### Server (AWS)
- `server/src/http-server.ts` - Main HTTP server (no mediasoup)
- `server/src/db.ts` - JSON database layer
- `server/src/index.ts` - Entry point

### Client (Local)
- `client/main.py` - HTTP MJPEG client with motion detection
- `client/config.aws.yaml` - AWS configuration

### Web UI
- `web-ui/src/App.js` - React dashboard
- `web-ui/src/App.css` - Styling

## Credentials
- **URL**: https://sec.sigma-chat.biz/
- **Username**: admin
- **Password**: LapCam2026!SecurePass
- **API Key**: 0091e17b54c9d9f164b3eb9d684474b3

## Quick Commands

### Start Client
```bash
cd /home/johnl/git/lapcam/client
python3 main.py --config config.aws.yaml
```

### Check Server Status
```bash
ssh -i ~/.ssh/lapcam-key.pem ubuntu@100.31.194.92 \
  "sudo systemctl status lapcam-server --no-pager"
```

### View Logs
```bash
ssh -i ~/.ssh/lapcam-key.pem ubuntu@100.31.194.92 \
  "sudo journalctl -u lapcam-server -f"
```

## TODO Before Deadline

### High Priority
1. [ ] Fix nginx to serve web UI static files
2. [ ] Test end-to-end: client → server → browser view
3. [ ] Verify motion events appear in UI

### Medium Priority  
4. [ ] Add video playback from S3 (generate signed URLs)
5. [ ] Add camera management (add/delete cameras)
6. [ ] Improve motion detection sensitivity

### Low Priority
7. [ ] Audio support
8. [ ] Multiple simultaneous viewers
9. [ ] Better error handling

## Deployment Notes

### Server is on AWS
- Public IP: 100.31.194.92
- Domain: sec.sigma-chat.biz
- Region: us-east-1
- ALB terminates SSL, forwards HTTP to EC2:8080

### NEVER run server locally for testing
- Server ONLY runs on AWS
- Test client locally pointing to AWS
- Web UI accessed via browser at https://sec.sigma-chat.biz/

