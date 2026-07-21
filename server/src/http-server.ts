import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import AWS from 'aws-sdk';
import config from './config';
import { db } from './db';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.raw({ limit: '50mb', type: 'application/octet-stream' })); // Increased for video uploads
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

// Motion event with optional screenshot URL
app.post('/api/motion-events', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;
  const { cameraId, cameraName, confidence, timestamp, screenshotUrl } = req.body;
  
  if (!apiKey || !cameraId) return res.status(400).json({ error: 'API key and camera ID required' });
  
  const camera = db.getCameraByApiKey(apiKey);
  if (!camera) return res.status(401).json({ error: 'Invalid API key' });
  
  const event = {
    id: `motion-${Date.now()}`,
    cameraId: camera.id,
    cameraName: camera.name,
    timestamp: timestamp || new Date().toISOString(),
    confidence: parseFloat(confidence) || 0,
    screenshot: screenshotUrl || null
  };
  
  motionEvents.unshift(event);
  if (motionEvents.length > 100) motionEvents.pop();
  
  console.log(`Motion on ${event.cameraName}: ${event.confidence}%${screenshotUrl ? ' 📸' : ''}`);
  res.json({ success: true });
});

// Upload screenshot separately
app.post('/api/snapshots', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) return res.status(400).json({ error: 'API key required' });
  
  const camera = db.getCameraByApiKey(apiKey);
  if (!camera) return res.status(401).json({ error: 'Invalid API key' });
  
  const frameBuffer = req.body as Buffer;
  if (!frameBuffer || !(frameBuffer instanceof Buffer)) {
    return res.status(400).json({ error: 'Image data required' });
  }
  
  const timestamp = Date.now();
  const s3Key = `snapshots/${camera.name}/${timestamp}.jpg`;
  
  try {
    await s3.putObject({
      Bucket: config.s3Bucket,
      Key: s3Key,
      Body: frameBuffer,
      ContentType: 'image/jpeg'
    }).promise();
    
    const screenshotUrl = `https://${config.s3Bucket}.s3.amazonaws.com/${s3Key}`;
    console.log(`Screenshot uploaded: ${s3Key}`);
    res.json({ success: true, url: screenshotUrl, key: s3Key });
  } catch (err: any) {
    console.error('S3 screenshot error:', err.message);
    res.status(500).json({ error: 'Failed to upload screenshot' });
  }
});

// Upload video separately
app.post('/api/videos', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) return res.status(400).json({ error: 'API key required' });
  
  const camera = db.getCameraByApiKey(apiKey);
  if (!camera) return res.status(401).json({ error: 'Invalid API key' });
  
  const videoBuffer = req.body as Buffer;
  if (!videoBuffer || !(videoBuffer instanceof Buffer)) {
    return res.status(400).json({ error: 'Video data required' });
  }
  
  const timestamp = Date.now();
  const s3Key = `videos/${camera.name}/${timestamp}.mp4`;
  
  try {
    await s3.putObject({
      Bucket: config.s3Bucket,
      Key: s3Key,
      Body: videoBuffer,
      ContentType: 'video/mp4'
    }).promise();
    
    const videoUrl = `https://${config.s3Bucket}.s3.amazonaws.com/${s3Key}`;
    console.log(`Video uploaded: ${s3Key} (${Math.round(videoBuffer.length / 1024)} KB)`);
    res.json({ success: true, url: videoUrl, key: s3Key });
  } catch (err: any) {
    console.error('S3 video error:', err.message);
    res.status(500).json({ error: 'Failed to upload video' });
  }
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

// Serve motion snapshot
app.get('/api/snapshots/:cameraName/:filename', async (req, res) => {
  const token = req.query.token as string;
  const cameraName = req.params.cameraName;
  const filename = req.params.filename;
  
  try {
    if (token) jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const key = `snapshots/${cameraName}/${filename}`;
  
  try {
    const obj = await s3.getObject({
      Bucket: config.s3Bucket,
      Key: key
    }).promise();
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', obj.ContentLength || 0);
    res.send(obj.Body);
  } catch (err: any) {
    console.error('S3 snapshot error:', err.message);
    res.status(404).json({ error: 'Snapshot not found' });
  }
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

// Serve snapshot from S3
app.get('/api/snapshots/:cameraName/:filename', async (req, res) => {
  const token = req.query.token as string;
  const cameraName = req.params.cameraName;
  const filename = req.params.filename;
  
  try {
    if (token) jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const key = `snapshots/${cameraName}/${filename}`;
  
  try {
    const obj = await s3.getObject({
      Bucket: config.s3Bucket,
      Key: key
    }).promise();
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', obj.ContentLength || 0);
    res.send(obj.Body);
  } catch (err: any) {
    console.error('S3 snapshot error:', err.message);
    res.status(404).json({ error: 'Snapshot not found' });
  }
});

// Serve video from S3
app.get('/api/videos/:cameraName/:filename', async (req, res) => {
  const token = req.query.token as string;
  const cameraName = req.params.cameraName;
  const filename = req.params.filename;
  
  try {
    if (token) jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const key = `videos/${cameraName}/${filename}`;
  
  try {
    const obj = await s3.getObject({
      Bucket: config.s3Bucket,
      Key: key
    }).promise();
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', obj.ContentLength || 0);
    res.setHeader('Accept-Ranges', 'bytes');
    res.send(obj.Body);
  } catch (err: any) {
    console.error('S3 video error:', err.message);
    res.status(404).json({ error: 'Video not found' });
  }
});

// Create new camera (admin only)
app.post('/api/cameras', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    jwt.verify(authHeader.replace('Bearer ', ''), config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Camera name required' });
  }
  
  // Check if camera already exists
  const existingCamera = db.getCameraByName(name);
  if (existingCamera) {
    return res.status(409).json({ error: 'Camera already exists' });
  }
  
  // Generate secure API key
  const apiKey = require('crypto').randomBytes(16).toString('hex');
  
  const camera = db.createCameraIfNotExists(name, apiKey, {
    resolution: 'pending',
    framerate: 0,
    motion_detection: false
  });
  
  console.log(`Camera created: ${name} with API key: ${apiKey}`);
  res.json({ 
    id: camera.id, 
    name: camera.name, 
    api_key: apiKey,
    message: 'Save this API key securely - it cannot be retrieved later!'
  });
});

// Delete camera (admin only)
app.delete('/api/cameras/:cameraId', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    jwt.verify(authHeader.replace('Bearer ', ''), config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const cameraId = req.params.cameraId;
  const success = db.deleteCamera(cameraId);
  
  if (success) {
    res.json({ success: true, message: 'Camera deleted' });
  } else {
    res.status(404).json({ error: 'Camera not found' });
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
