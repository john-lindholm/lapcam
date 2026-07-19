# Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Home Locations                          │
│  ┌──────────────┐                    ┌──────────────┐          │
│  │   Ubuntu     │                    │   Windows    │          │
│  │   Laptop     │                    │      PC      │          │
│  │  (Kitchen)   │                    │(Living Room) │          │
│  │              │                    │              │          │
│  │  ┌────────┐  │                    │  ┌────────┐  │          │
│  │  │ Camera │  │                    │  │ Camera │  │          │
│  │  └───┬────┘  │                    │  └───┬────┘  │          │
│  │      │       │                    │      │       │          │
│  │  ┌───▼────┐  │                    │  ┌───▼────┐  │          │
│  │  │ Client │  │                    │  │ Client │  │          │
│  │  │ Daemon │  │                    │  │ Daemon │  │          │
│  │  │ Python │  │                    │  │ Python │  │          │
│  │  └───┬────┘  │                    │  └───┬────┘  │          │
│  └──────┼───────┘                    └──────┼───────┘          │
│         │                                   │                   │
└─────────┼───────────────────────────────────┼───────────────────┘
          │         WebRTC (VP8/H264)         │
          │         Encrypted (DTLS)          │
          └─────────────────┬─────────────────┘
                            │
                            ▼
                 ┌──────────────────┐
                 │   AWS EC2        │
                 │   Ubuntu 22.04   │
                 │                  │
                 │  ┌────────────┐  │
                 │  │   Nginx    │  │
                 │  │  (Reverse  │  │
                 │  │   Proxy +  │  │
                 │  │   SSL)     │  │
                 │  └─────┬──────┘  │
                 │        │         │
                 │  ┌─────▼──────┐  │
                 │  │ Node.js    │  │
                 │  │ Server     │  │
                 │  │            │  │
                 │  │ - Express  │  │
                 │  │ - Mediasoup│  │
                 │  │ - WebSocket│  │
                 │  └─────┬──────┘  │
                 │        │         │
                 └────────┼─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │   AWS S3         │
                 │   Recordings     │
                 │                  │
                 │ /kitchen/        │
                 │   2024-01-01/    │
                 │     segment.webm │
                 │ /living-room/    │
                 │   2024-01-01/    │
                 │     segment.webm │
                 └──────────────────┘
```

## Data Flow

### Live Streaming

1. **Client** captures video from webcam using OpenCV
2. **Client** encodes frames and sends via WebRTC (aiortc)
3. **Server** receives stream via Mediasoup SFU
4. **Server** forwards stream to connected viewers
5. **Web UI** displays live video using WebRTC player

### Recording

1. **Server** receives video stream
2. **Server** segments video into 10-second chunks
3. **Server** uploads segments to S3
4. **Server** records metadata in SQLite database
5. **S3 Lifecycle** policy deletes old recordings after 7 days

### Motion Detection

1. **Client** analyzes frames using background subtraction
2. **Client** detects motion when area > threshold
3. **Client** sends motion event to server via WebSocket
4. **Server** marks recording segments with motion events
5. **Web UI** shows motion indicators on timeline

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Client** | Python 3.9+ | Cross-platform daemon |
| **Video Capture** | OpenCV | Camera access, motion detection |
| **WebRTC (Client)** | aiortc | WebRTC implementation |
| **Server Runtime** | Node.js 20+ | High-performance I/O |
| **WebRTC (Server)** | mediasoup | SFU, multiplexing |
| **Web Framework** | Express.js | REST API, static files |
| **Signaling** | WebSocket | Real-time communication |
| **Database** | SQLite | Metadata, auth, config |
| **Storage** | AWS S3 | Video recordings |
| **Web UI** | React 18 | Modern, responsive UI |
| **Infrastructure** | Terraform | IaC for AWS |
| **Web Server** | Nginx | Reverse proxy, SSL |

## Security

- **WebRTC**: DTLS-SRTP encryption for all media
- **HTTPS**: TLS 1.2+ for signaling and web UI
- **API Keys**: Per-camera authentication
- **JWT**: Time-limited user sessions (24h)
- **S3**: Private bucket, pre-signed URLs only
- **EC2**: Security groups restrict ports
- **IAM**: Minimal permissions for S3 access

## Network Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 443 | TCP | HTTPS, WebSocket signaling |
| 10000-10100 | UDP | WebRTC media (primary) |
| 10000-10100 | TCP | WebRTC media (fallback) |
| 22 | TCP | SSH (restrict to your IP) |

## Performance Considerations

### Bandwidth (per camera)
- 720p @ 30fps: ~500-800 kbps
- 720p @ 15fps: ~300-500 kbps
- Upload speed requirement: 1 Mbps per camera

### Server Resources (t3.medium)
- CPU: 2 vCPU (sufficient for 4-6 cameras)
- RAM: 4 GB (mediasoup + Node.js ~1GB)
- Storage: 50 GB (OS + logs + buffer)

### Client Resources
- CPU: ~10-20% per camera (with motion detection)
- RAM: ~200-300 MB
- Upload: 1 Mbps stable connection

## Scaling Options

### Vertical Scaling
- Upgrade EC2 instance (t3.large, t3.xlarge)
- More mediasoup workers

### Horizontal Scaling (Future)
- Multiple EC2 instances with load balancer
- Separate signaling and media servers
- Redis for session management

### Storage Optimization
- S3 Intelligent Tiering for cost savings
- Transcode to HLS for adaptive streaming
- CloudFront for global distribution
