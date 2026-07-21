import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import AWS from 'aws-sdk';
import config from './config';
import { db } from './db';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.raw({ limit: '1mb', type: 'application/octet-stream' }));
import path from 'path';
app.use(express.static(path.join(__dirname, '../web-ui/build')));

AWS.config.update({ region: config.awsRegion });
const s3 = new AWS.S3();

// Active streams and viewers
const activeCameras = new Map<string, number>(); // cameraId -> lastFrameTime
const viewers = new Map<string, Set<any>>(); // cameraId -> viewer responses

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.getUserByUsername(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '24h' });
  res.json({ token, username: user.username });
});

// Get cameras
app.get('/api/cameras', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    jwt.verify(authHeader.replace('Bearer ', ''), config.jwtSecret);
    const cameras = db.getAllCameras();
    res.json(cameras);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Camera sends frame
app.post('/api/stream/:cameraName/frame', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;
  const cameraName = req.params.cameraName;
  
  if (!apiKey || !cameraName) {
    return res.status(400).json({ error: 'API key and camera name required' });
  }
  
  const camera = db.getCameraByApiKey(apiKey);
  if (!camera || camera.name !== cameraName) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const frameBuffer = req.body as Buffer;
  if (!frameBuffer || !(frameBuffer instanceof Buffer)) {
    return res.status(400).json({ error: 'Frame data required' });
  }
  
  // Mark camera as active
  activeCameras.set(camera.id, Date.now());
  db.updateCamera(camera.id, { last_seen: new Date().toISOString() });
  
  // Save to S3 (batch frames - simplified: save each frame)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `recordings/${camera.name}/${timestamp}.jpg`;
  
  s3.putObject({
    Bucket: config.s3Bucket,
    Key: key,
    Body: frameBuffer
  }).promise().catch(err => console.error('S3 error:', err.message));
  
  // Broadcast to viewers
  const cameraViewers = viewers.get(camera.id);
  if (cameraViewers) {
    let jpegStart = -1, jpegEnd = -1;
    for (let i = 0; i < frameBuffer.length - 2; i++) {
      if (frameBuffer[i] === 0xFF && frameBuffer[i + 1] === 0xD8) jpegStart = i;
      if (frameBuffer[i] === 0xFF && frameBuffer[i + 1] === 0xD9 && jpegStart !== -1) {
        jpegEnd = i + 2;
        break;
      }
    }
    const jpegData = (jpegStart !== -1 && jpegEnd !== -1) ? frameBuffer.subarray(jpegStart, jpegEnd) : frameBuffer;
    const header = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpegData.length}\r\n\r\n`;
    
    cameraViewers.forEach(viewerRes => {
      try {
        viewerRes.write(header);
        viewerRes.write(jpegData);
        viewerRes.write('\r\n');
      } catch (e) { /* viewer disconnected */ }
    });
  }
  
  res.json({ success: true, viewers: cameraViewers?.size || 0 });
});

// Viewer connects
app.get('/api/stream/:cameraId/view', async (req, res) => {
  const token = req.query.token as string;
  const cameraId = req.params.cameraId;
  
  if (!token) return res.status(401).json({ error: 'Token required' });
  
  try {
    jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const camera = db.getCameraById(cameraId);
  if (!camera) return res.status(404).json({ error: 'Camera not found' });
  
  // Setup MJPEG stream
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  if (!viewers.has(cameraId)) viewers.set(cameraId, new Set());
  viewers.get(cameraId)!.add(res);
  
  console.log(`Viewer connected to ${camera.name}`);
  
  res.on('close', () => {
    viewers.get(cameraId)?.delete(res);
    console.log(`Viewer disconnected from ${camera.name}`);
  });
});

// Motion events (simple in-memory store)
const motionEvents: any[] = [];
app.post('/api/motion-events', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;
  const { cameraId, cameraName, confidence, timestamp } = req.body;
  
  if (!apiKey || !cameraId) return res.status(400).json({ error: 'API key and camera ID required' });
  
  const camera = db.getCameraByApiKey(apiKey);
  if (!camera) return res.status(401).json({ error: 'Invalid API key' });
  
  const event = {
    id: `motion-${Date.now()}`,
    cameraId: camera.id,
    cameraName: camera.name,
    timestamp: timestamp || new Date().toISOString(),
    confidence: confidence || 0
  };
  
  motionEvents.unshift(event);
  if (motionEvents.length > 100) motionEvents.pop();
  
  console.log(`Motion on ${event.cameraName}: ${event.confidence}%`);
  res.json({ success: true });
});

app.get('/api/motion-events', async (req, res) => {
  const cameraId = req.query.cameraId as string;
  if (!cameraId) {
    return res.json(motionEvents.slice(0, 50));
  }
  // Filter by either camera ID (UUID) or camera name
  const events = motionEvents.filter(e => e.cameraId === cameraId || e.cameraName === cameraId).slice(0, 50);
  res.json(events);
});

// Get recordings from S3
app.get('/api/recordings/:cameraName', async (req, res) => {
  const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '');
  const cameraName = req.params.cameraName;
  
  try {
    if (token) jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  try {
    const prefix = `recordings/${cameraName}/`;
    const data = await s3.listObjectsV2({
      Bucket: config.s3Bucket,
      Prefix: prefix,
      MaxKeys: 50
    }).promise();
    
    const recordings = data.Contents?.map(obj => ({
      key: obj.Key,
      timestamp: obj.LastModified?.toISOString() || '',
      size: Math.round((obj.Size || 0) / 1024)
    })).reverse().slice(0, 50) || [];
    
    res.json(recordings);
  } catch (err: any) {
    console.error('S3 error:', err.message);
    res.json([]);
  }
});

// Serve individual recording from S3
app.get('/api/recordings/:cameraName/:filename', async (req, res) => {
  const token = req.query.token as string;
  const cameraName = req.params.cameraName;
  const filename = req.params.filename;
  
  try {
    if (token) jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const key = `recordings/${cameraName}/${filename}`;
  
  try {
    const obj = await s3.getObject({
      Bucket: config.s3Bucket,
      Key: key
    }).promise();
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', obj.ContentLength || 0);
    res.send(obj.Body);
  } catch (err: any) {
    console.error('S3 get error:', err.message);
    res.status(404).json({ error: 'Recording not found' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.BEHIND_ALB === 'true' ? 8080 : 3001;
app.listen(PORT, () => {
  console.log(`LapCam HTTP Server listening on port ${PORT}`);
  console.log(`Domain: ${config.domain}`);
});
