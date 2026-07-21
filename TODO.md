# LapCam TODO List

## ✅ COMPLETED

### Server (AWS)
- [x] HTTP server on port 8080
- [x] JWT authentication
- [x] Camera registration API
- [x] Frame ingestion endpoint
- [x] MJPEG streaming to viewers
- [x] Motion events API
- [x] S3 recording (JPG frames)
- [x] JSON database layer
- [x] Static file serving for React UI

### Client (Local)
- [x] Python client with motion detection
- [x] HTTP POST frame streaming
- [x] Configurable settings (resolution, framerate, sensitivity)
- [x] Auto-reconnect logic

### Web UI
- [x] Login page with JWT
- [x] Camera list with live status
- [x] Live MJPEG stream viewer
- [x] Motion events timeline
- [x] Responsive design

### Infrastructure
- [x] ALB SSL termination
- [x] EC2 systemd service
- [x] S3 bucket for recordings
- [x] Route53 DNS (sec.sigma-chat.biz)

## 🔄 IN PROGRESS

- [ ] End-to-end testing with live camera
- [ ] Verify motion events appear in UI in real-time

## ❌ TODO - Post Deadline

### High Priority
- [ ] Video playback from S3 (generate signed URLs for recorded JPGs)
- [ ] Add timestamp overlay on video frames
- [ ] Camera management UI (add/delete/rename cameras)
- [ ] Better error handling and reconnection logic

### Medium Priority
- [ ] Motion detection sensitivity tuning UI
- [ ] Email/push notifications on motion
- [ ] Multiple simultaneous viewers support
- [ ] Recording retention policy (auto-delete old footage)

### Low Priority
- [ ] Audio support
- [ ] PTZ camera control
- [ ] Multi-camera grid view
- [ ] Export recordings (compile JPGs to MP4)
- [ ] User management (multiple users)
- [ ] Two-factor authentication

## Known Issues

1. **Motion confidence** - Currently shows raw values, needs calibration
2. **Frame rate** - ~5-6 FPS at 640x480, could optimize
3. **Storage** - S3 costs will add up, need lifecycle policies
4. **No HTTPS between client and server** - Frames sent over HTTP (API is HTTPS)

## Testing Checklist

- [ ] Start client on laptop
- [ ] Verify frames received by server (check logs)
- [ ] Open web UI in browser
- [ ] Login with admin credentials
- [ ] See camera as "Live" (green indicator)
- [ ] View live stream
- [ ] Wave hand in front of camera
- [ ] Verify motion event appears within 5 seconds
- [ ] Check S3 for recorded frames

## Credentials (AWS)

- **URL**: https://sec.sigma-chat.biz/
- **Username**: admin
- **Password**: LapCam2026!SecurePass
- **Camera API Key**: 0091e17b54c9d9f164b3eb9d684474b3

## Quick Commands

```bash
# Start client
cd ~/git/lapcam/client
python3 main.py --config config.aws.yaml

# Check server status
ssh -i ~/.ssh/lapcam-key.pem ubuntu@100.31.194.92 \
  "sudo systemctl status lapcam-server --no-pager"

# View server logs
ssh -i ~/.ssh/lapcam-key.pem ubuntu@100.31.194.92 \
  "sudo journalctl -u lapcam-server -f"

# Restart server
ssh -i ~/.ssh/lapcam-key.pem ubuntu@100.31.194.92 \
  "sudo systemctl restart lapcam-server"
```
