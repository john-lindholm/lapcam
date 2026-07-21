import express from 'express';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import cors from 'cors';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import * as mediasoup from 'mediasoup';
import { Worker, Router, WebRtcTransport, Producer, Consumer } from 'mediasoup/node/lib/types';
import AWS from 'aws-sdk';
import path from 'path';
import { EventEmitter } from 'events';

import config from './config';
import { S3Recorder } from './recorder';

const app = express();
app.use(cors());
app.use(express.json());

// Database setup
const db = new Database(config.databasePath);
db.exec(`
  CREATE TABLE IF NOT EXISTS cameras (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    api_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME,
    capabilities TEXT
  );
  
  CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    camera_id TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    s3_key TEXT,
    motion_events TEXT,
    FOREIGN KEY (camera_id) REFERENCES cameras(id)
  );
  
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Initialize admin user
const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminUser) {
  const passwordHash = bcrypt.hashSync(config.adminPassword, 10);
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
    uuidv4(),
    'admin',
    passwordHash
  );
}

// Mediasoup workers
const mediasoupWorkers: Worker[] = [];
let nextWorkerIndex = 0;

async function createMediasoupWorkers() {
  for (let i = 0; i < config.numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: config.logLevel === 'debug' ? 'debug' : 'warn',
      appData: { workerIndex: i }
    });
    
    worker.on('died', () => {
      console.error(`Mediasoup worker ${i} died, exiting...`);
      process.exit(1);
    });
    
    mediasoupWorkers.push(worker);
  }
}

// Camera routers and transports
interface CameraSession {
  router: Router;
  webRtcTransport: WebRtcTransport;
  producer?: Producer;
  recorder?: S3Recorder;
}

const cameraSessions = new Map<string, CameraSession>();
const viewerConsumers = new Map<string, { consumer: Consumer; ws: WebSocket }>();

// Create router for a camera
async function createRouter(): Promise<Router> {
  const worker = mediasoupWorkers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % mediasoupWorkers.length;
  
  return worker.createRouter({
    mediaCodecs: [
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 }
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 }
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1
        }
      },
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      }
    ]
  });
}

// S3 setup
AWS.config.update({
  region: config.awsRegion
});
const s3 = new AWS.S3();

// Auth middleware
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  const camera = db.prepare('SELECT * FROM cameras WHERE api_key = ?').get(apiKey);
  if (!camera) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  (req as any).camera = camera;
  next();
}

function jwtMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// REST API Routes

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '24h' });
  res.json({ token, username: user.username });
});

// Register camera
app.post('/api/cameras/register', authMiddleware, async (req: express.Request, res: express.Response) => {
  // This endpoint is called by the client with its own API key
  const camera = (req as any).camera;
  const { capabilities } = req.body;
  
  db.prepare('UPDATE cameras SET last_seen = CURRENT_TIMESTAMP, capabilities = ? WHERE id = ?')
    .run(JSON.stringify(capabilities), camera.id);
  
  res.json({ success: true, cameraId: camera.id, name: camera.name });
});

// List cameras (protected)
app.get('/api/cameras', jwtMiddleware, (req, res) => {
  const cameras = db.prepare('SELECT id, name, created_at, last_seen, capabilities FROM cameras').all();
  res.json(cameras);
});

// Get camera info
app.get('/api/cameras/:cameraId', jwtMiddleware, (req, res) => {
  const camera = db.prepare('SELECT id, name, created_at, last_seen, capabilities FROM cameras WHERE id = ?')
    .get(req.params.cameraId);
  
  if (!camera) {
    return res.status(404).json({ error: 'Camera not found' });
  }
  
  res.json(camera);
});

// Delete camera
app.delete('/api/cameras/:cameraId', jwtMiddleware, (req, res) => {
  const cameraId = req.params.cameraId;
  
  // Remove from active sessions
  const session = cameraSessions.get(cameraId);
  if (session) {
    session.producer?.close();
    session.webRtcTransport.close();
    session.router.close();
    cameraSessions.delete(cameraId);
  }
  
  db.prepare('DELETE FROM cameras WHERE id = ?').run(cameraId);
  res.json({ success: true });
});

// Generate new API key for camera
app.post('/api/cameras/:cameraId/api-key', jwtMiddleware, (req, res) => {
  const newApiKey = uuidv4();
  db.prepare('UPDATE cameras SET api_key = ? WHERE id = ?').run(newApiKey, req.params.cameraId);
  res.json({ apiKey: newApiKey });
});

// List recordings
app.get('/api/recordings', jwtMiddleware, (req, res) => {
  const { cameraId, startTime, endTime, limit = 100 } = req.query;
  
  let query = `
    SELECT r.*, c.name as camera_name 
    FROM recordings r 
    JOIN cameras c ON r.camera_id = c.id 
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (cameraId) {
    query += ' AND r.camera_id = ?';
    params.push(cameraId);
  }
  
  if (startTime) {
    query += ' AND r.start_time >= ?';
    params.push(startTime);
  }
  
  if (endTime) {
    query += ' AND r.end_time <= ?';
    params.push(endTime);
  }
  
  query += ' ORDER BY r.start_time DESC LIMIT ?';
  params.push(parseInt(limit as string));
  
  const recordings = db.prepare(query).all(...params);
  res.json(recordings);
});

// Get recording URL (pre-signed S3 URL)
app.get('/api/recordings/:recordingId/url', jwtMiddleware, (req, res) => {
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?')
    .get(req.params.recordingId) as any;
  
  if (!recording || !recording.s3_key) {
    return res.status(404).json({ error: 'Recording not found' });
  }
  
  const url = s3.getSignedUrl('getObject', {
    Bucket: config.s3Bucket,
    Key: recording.s3_key,
    Expires: 3600 // 1 hour
  });
  
  res.json({ url, expiresAt: Date.now() + 3600 * 1000 });
});

// Delete recording
app.delete('/api/recordings/:recordingId', jwtMiddleware, (req, res) => {
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?')
    .get(req.params.recordingId) as any;
  
  if (!recording) {
    return res.status(404).json({ error: 'Recording not found' });
  }
  
  if (recording.s3_key) {
    s3.deleteObject({
      Bucket: config.s3Bucket,
      Key: recording.s3_key
    }).promise();
  }
  
  db.prepare('DELETE FROM recordings WHERE id = ?').run(recording.id);
  res.json({ success: true });
});

// WebSocket server for signaling
const wss = new WebSocket.Server({ 
  noServer: true,
  maxPayload: 10 * 1024 * 1024 // 10MB
});

wss.on('connection', async (ws: WebSocket, req: any) => {
  const cameraName = req.url?.split('/').pop();
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || !cameraName) {
    ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
    ws.close();
    return;
  }
  
  // Authenticate camera
  const camera = db.prepare('SELECT * FROM cameras WHERE api_key = ? AND name = ?').get(apiKey, cameraName) as any;
  if (!camera) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid credentials' }));
    ws.close();
    return;
  }
  
  console.log(`Camera connected: ${camera.name} (${camera.id})`);
  
  // Create mediasoup session for this camera
  try {
    const router = await createRouter();
    const webRtcTransport = await router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: config.publicIp }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000
    });
    
    const session: CameraSession = {
      router,
      webRtcTransport,
      recorder: config.recordingEnabled 
        ? new S3Recorder(camera.id, camera.name, config.s3Bucket, s3, db)
        : undefined
    };
    
    cameraSessions.set(camera.id, session);
    
    // Handle existing session (reconnection)
    const existingSession = Array.from(cameraSessions.entries())
      .find(([id, s]) => id !== camera.id && s.webRtcTransport.id === webRtcTransport.id);
      
    if (existingSession) {
      cameraSessions.delete(existingSession[0]);
    }
    
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'offer': {
            const { sdp } = message;
            
            // Handle offer from client
            const answer = await webRtcTransport.answer({ sdp });
            
            ws.send(JSON.stringify({
              type: 'answer',
              sdp: answer.sdp
            }));
            
            // Wait for producer to be created
            webRtcTransport.on('producer', async (producer) => {
              session.producer = producer;
              console.log(`Producer created for ${camera.name}: ${producer.kind}`);
              
              // Start recording if enabled
              if (false && session.recorder && producer.kind === 'video') {
                session.recorder?.start(webRtcTransport, producer as any);
              }
            });
            
            break;
          }
          
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
            db.prepare('UPDATE cameras SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(camera.id);
            break;
          }
          
          case 'motion': {
            console.log(`Motion detected on ${camera.name}`);
            // Notify connected viewers
            for (const [viewerId, { ws: viewerWs }] of viewerConsumers.entries()) {
              if (viewerWs.readyState === WebSocket.OPEN) {
                viewerWs.send(JSON.stringify({
                  type: 'motion',
                  cameraId: camera.id,
                  cameraName: camera.name,
                  timestamp: message.timestamp
                }));
              }
            }
            break;
          }
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });
    
    ws.on('close', () => {
      console.log(`Camera disconnected: ${camera.name}`);
      
      if (session.recorder) {
        // session.recorder.stop();
      }
      
      // Don't close immediately - allow reconnection
      setTimeout(() => {
        // @ts-ignore - WebSocket custom property
        if (!ws.isAlive) {
          session.producer?.close();
          session.webRtcTransport.close();
          session.router.close();
          cameraSessions.delete(camera.id);
        }
      }, 30000); // 30 second grace period
    });
    
    // @ts-ignore - WebSocket custom property
    ws.isAlive = true;
    ws.on('pong', () => {
      // @ts-ignore
      ws.isAlive = true;
    });
    
    // Send router RTP capabilities to client
    const rtpCapabilities = router.rtpCapabilities;
    ws.send(JSON.stringify({
      type: 'connected',
      rtpCapabilities
    }));
    
  } catch (err) {
    console.error('Error creating mediasoup session:', err);
    ws.send(JSON.stringify({ type: 'error', message: 'Server error' }));
    ws.close();
  }
});

// Viewer WebSocket endpoint
const viewerWss = new WebSocket.Server({ 
  noServer: true,
  path: '/ws/viewer'
});

viewerWss.on('connection', async (ws: WebSocket, req: any) => {
  const viewerId = uuidv4();
  console.log(`Viewer connected: ${viewerId}`);
  
  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'watch') {
        const { cameraId } = message;
        const session = cameraSessions.get(cameraId);
        
        if (!session || !session.producer) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Camera not available' 
          }));
          return;
        }
        
        // Create consumer for viewer
        const consumer = await session.webRtcTransport.consume({
          producerId: session.producer.id,
          rtpCapabilities: message.rtpCapabilities
        });
        
        viewerConsumers.set(viewerId, { consumer, ws });
        
        ws.send(JSON.stringify({
          type: 'consumer_created',
          consumerParameters: {
            consumerId: consumer.id,
            producerId: consumer.producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters
          }
        }));
        
        consumer.on('producerclose', () => {
          console.log(`Producer closed for viewer ${viewerId}`);
          ws.send(JSON.stringify({ type: 'producer_closed' }));
          viewerConsumers.delete(viewerId);
        });
      }
    } catch (err) {
      console.error('Error handling viewer message:', err);
    }
  });
  
  ws.on('close', () => {
    console.log(`Viewer disconnected: ${viewerId}`);
    const entry = viewerConsumers.get(viewerId);
    if (entry) {
      entry.consumer.close();
      viewerConsumers.delete(viewerId);
    }
  });
});

// HTTP upgrade handler for WebSockets
const server = createServer({
  key: readFileSync(config.sslKeyPath),
  cert: readFileSync(config.sslCertPath)
}, app);

server.on('upgrade', (request, socket, head) => {
  const url = request.url;
  
  if (url?.startsWith('/ws/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (url === '/ws/viewer') {
    viewerWss.handleUpgrade(request, socket, head, (ws) => {
      viewerWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Ping interval to detect dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!((ws as any).isAlive)) {
      return ws.terminate();
    }
    (ws as any).isAlive = false;
    // @ts-ignore
    ws.ping();
  });
}, 30000);

// Start server
async function startServer() {
  try {
    await createMediasoupWorkers();
    console.log(`Created ${mediasoupWorkers.length} mediasoup workers`);
    
    server.listen(config.port, () => {
      console.log(`Server listening on port ${config.port}`);
      console.log(`Domain: ${config.domain}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

export default app;
