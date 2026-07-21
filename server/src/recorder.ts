import type { Producer, WebRtcTransport } from 'mediasoup/node/lib/types';
import type * as Database from 'better-sqlite3';
import AWS from 'aws-sdk';
import config from './config';

AWS.config.update({ region: config.awsRegion });
const s3 = new AWS.S3();

export class S3Recorder {
  private db: any;
  
  constructor(db: any) {
    this.db = db;
  }
  
  async start(transport: WebRtcTransport, producer: Producer): Promise<void> {
    // Stub - recording not implemented yet
  }
  
  async stop(): Promise<void> {
    // Stub
  }
}
