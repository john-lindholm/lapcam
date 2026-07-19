import { WebRtcTransport, Producer } from 'mediasoup/lib/types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import AWS from 'aws-sdk';
import Database from 'better-sqlite3';

interface MotionEvent {
  timestamp: number;
  duration: number;
}

export class S3Recorder {
  private cameraId: string;
  private cameraName: string;
  private s3Bucket: string;
  private s3: AWS.S3;
  private db: Database;
  
  private currentSegment: Buffer[] = [];
  private segmentStartTime: Date | null = null;
  private motionEvents: MotionEvent[] = [];
  private currentMotionStart: number | null = null;
  
  private segmentDuration: number = 10; // seconds
  private uploadQueue: Array<{ data: Buffer; key: string }> = [];
  private isUploading = false;
  
  constructor(
    cameraId: string,
    cameraName: string,
    s3Bucket: string,
    s3: AWS.S3,
    db: Database
  ) {
    this.cameraId = cameraId;
    this.cameraName = cameraName;
    this.s3Bucket = s3Bucket;
    this.s3 = s3;
    this.db = db;
  }
  
  start(transport: WebRtcTransport, producer: Producer) {
    console.log(`Starting recorder for ${this.cameraName}`);
    
    // Note: In a production implementation, you would use mediasoup's
    // RTP stream observers or a separate recording service.
    // For this simple version, we'll create segment metadata
    // and rely on the client to send actual video segments.
    
    this.startNewSegment();
    
    // Process upload queue
    this.processUploadQueue();
  }
  
  private startNewSegment() {
    this.currentSegment = [];
    this.segmentStartTime = new Date();
    this.motionEvents = [];
    
    console.log(`New recording segment started for ${this.cameraName}`);
    
    // Schedule next segment
    setTimeout(() => this.finalizeSegment(), this.segmentDuration * 1000);
  }
  
  recordMotion(timestamp: number) {
    if (this.currentMotionStart === null) {
      this.currentMotionStart = timestamp;
    }
  }
  
  recordMotionEnd(timestamp: number) {
    if (this.currentMotionStart !== null) {
      this.motionEvents.push({
        timestamp: this.currentMotionStart,
        duration: timestamp - this.currentMotionStart
      });
      this.currentMotionStart = null;
    }
  }
  
  private async finalizeSegment() {
    if (!this.segmentStartTime || this.currentSegment.length === 0) {
      this.startNewSegment();
      return;
    }
    
    const endTime = new Date();
    const segmentId = uuidv4();
    const dateStr = this.segmentStartTime.toISOString().split('T')[0];
    const key = `${this.cameraName}/${dateStr}/${segmentId}.webm`;
    
    // In production, you would mux the recorded frames here
    // For now, we'll just store metadata
    const recordingData = {
      id: segmentId,
      camera_id: this.cameraId,
      start_time: this.segmentStartTime.toISOString(),
      end_time: endTime.toISOString(),
      s3_key: key,
      motion_events: JSON.stringify(this.motionEvents)
    };
    
    // Save to database
    this.db.prepare(`
      INSERT INTO recordings (id, camera_id, start_time, end_time, s3_key, motion_events)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      segmentId,
      this.cameraId,
      recordingData.start_time,
      recordingData.end_time,
      key,
      recordingData.motion_events
    );
    
    console.log(`Recording segment saved: ${key}`);
    
    this.startNewSegment();
  }
  
  private async processUploadQueue() {
    while (true) {
      if (this.uploadQueue.length > 0 && !this.isUploading) {
        const item = this.uploadQueue.shift();
        if (item) {
          this.isUploading = true;
          try {
            await this.s3.putObject({
              Bucket: this.s3Bucket,
              Key: item.key,
              Body: item.data
            }).promise();
            console.log(`Uploaded segment: ${item.key}`);
          } catch (err) {
            console.error('Failed to upload segment:', err);
            // Re-queue for retry
            this.uploadQueue.unshift(item);
          } finally {
            this.isUploading = false;
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  stop() {
    console.log(`Stopping recorder for ${this.cameraName}`);
    if (this.currentSegment.length > 0) {
      this.finalizeSegment();
    }
  }
}
