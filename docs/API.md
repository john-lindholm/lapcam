# API Reference

## Authentication

### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}

Response:
{
  "token": "jwt-token-here",
  "username": "admin"
}
```

Use the token in subsequent requests:
```http
Authorization: Bearer <token>
```

## Cameras

### List Cameras
```http
GET /api/cameras
Authorization: Bearer <token>

Response:
[
  {
    "id": "uuid",
    "name": "kitchen",
    "created_at": "2024-01-01T00:00:00Z",
    "last_seen": "2024-01-01T12:00:00Z",
    "capabilities": "{\"resolution\": \"1280x720\", ...}"
  }
]
```

### Get Camera
```http
GET /api/cameras/:cameraId
Authorization: Bearer <token>
```

### Register Camera (Client)
```http
POST /api/cameras/register
X-API-Key: <camera-api-key>
Content-Type: application/json

{
  "camera_name": "kitchen",
  "capabilities": {
    "resolution": "1280x720",
    "framerate": 30,
    "motion_detection": true
  }
}
```

### Delete Camera
```http
DELETE /api/cameras/:cameraId
Authorization: Bearer <token>
```

### Generate New API Key
```http
POST /api/cameras/:cameraId/api-key
Authorization: Bearer <token>

Response:
{
  "apiKey": "new-api-key"
}
```

## Recordings

### List Recordings
```http
GET /api/recordings?cameraId=xxx&startTime=2024-01-01&endTime=2024-01-02&limit=100
Authorization: Bearer <token>

Response:
[
  {
    "id": "uuid",
    "camera_id": "xxx",
    "camera_name": "kitchen",
    "start_time": "2024-01-01T12:00:00Z",
    "end_time": "2024-01-01T12:01:00Z",
    "s3_key": "kitchen/2024-01-01/uuid.webm",
    "motion_events": "[{\"timestamp\": 1234567890, \"duration\": 5}]"
  }
]
```

### Get Recording URL
```http
GET /api/recordings/:recordingId/url
Authorization: Bearer <token>

Response:
{
  "url": "https://s3.amazonaws.com/...?X-Amz-Signature=...",
  "expiresAt": 1704123456789
}
```

### Delete Recording
```http
DELETE /api/recordings/:recordingId
Authorization: Bearer <token>
```

## WebSocket APIs

### Camera Connection
```
URL: wss://your-domain/ws/:cameraName
Headers: X-API-Key: <camera-api-key>
```

**Messages from Camera:**
```json
{
  "type": "offer",
  "sdp": "...",
  "camera_name": "kitchen"
}
```

```json
{
  "type": "ping"
}
```

```json
{
  "type": "motion",
  "camera_name": "kitchen",
  "timestamp": 1704123456
}
```

**Messages to Camera:**
```json
{
  "type": "answer",
  "sdp": "..."
}
```

```json
{
  "type": "pong"
}
```

### Viewer Connection
```
URL: wss://your-domain/ws/viewer
```

**Messages from Viewer:**
```json
{
  "type": "watch",
  "cameraId": "uuid",
  "rtpCapabilities": { ... }
}
```

**Messages to Viewer:**
```json
{
  "type": "consumer_created",
  "consumerParameters": {
    "consumerId": "...",
    "producerId": "...",
    "kind": "video",
    "rtpParameters": { ... }
  }
}
```

```json
{
  "type": "motion",
  "cameraId": "uuid",
  "cameraName": "kitchen",
  "timestamp": 1704123456
}
```

```json
{
  "type": "producer_closed"
}
```
