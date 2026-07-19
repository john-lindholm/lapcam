import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const config = {
  // Server
  port: parseInt(process.env.PORT || '8080'),
  wssPort: parseInt(process.env.WSS_PORT || '8443'),
  domain: process.env.DOMAIN || 'localhost',
  publicIp: process.env.PUBLIC_IP || '0.0.0.0',
  
  // SSL
  sslCertPath: process.env.SSL_CERT_PATH || '/etc/ssl/certs/lapcam.crt',
  sslKeyPath: process.env.SSL_KEY_PATH || '/etc/ssl/private/lapcam.key',
  
  // Auth
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
  
  // AWS
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  s3Bucket: process.env.S3_BUCKET || '',
  
  // Database
  databasePath: process.env.DATABASE_PATH || '/var/lib/lapcam/lapcam.db',
  
  // Recording
  recordingEnabled: process.env.RECORDING_ENABLED !== 'false',
  recordingSegmentDuration: parseInt(process.env.RECORDING_SEGMENT_DURATION || '10'),
  bufferDir: process.env.BUFFER_DIR || '/tmp/lapcam-server-buffer',
  
  // Mediasoup
  numWorkers: parseInt(process.env.NUM_WORKERS || '1'),
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Web UI
  webUiPath: process.env.WEB_UI_PATH || path.join(__dirname, '../../web-ui/build')
};

export default config;
