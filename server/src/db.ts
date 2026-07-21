import { readFileSync, writeFileSync } from 'fs';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DATABASE_PATH || '/var/lib/lapcam/lapcam.db';

interface Camera {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
  last_seen?: string;
  capabilities?: any;
}

interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

interface Database {
  cameras: Camera[];
  users: User[];
}

let database: Database = { cameras: [], users: [] };

function load() {
  try {
    const data = readFileSync(DB_PATH, 'utf-8');
    database = JSON.parse(data);
  } catch (e) {
    database = {
      cameras: [],
      users: [{
        id: 'admin-001',
        username: 'admin',
        password_hash: bcrypt.hashSync('LapCam2026!SecurePass', 10),
        created_at: new Date().toISOString()
      }]
    };
    save();
  }
}

function save() {
  try {
    writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

export const db = {
  init: load,
  
  getUserByUsername: (username: string) => database.users.find(u => u.username === username),
  
  getCameraByApiKey: (apiKey: string) => database.cameras.find(c => c.api_key === apiKey),
  
  getCameraById: (id: string) => database.cameras.find(c => c.id === id),
  
  getCameraByName: (name: string) => database.cameras.find(c => c.name === name),
  
  getAllCameras: () => database.cameras.map(({ api_key, ...c }) => c),
  
  deleteCamera: (id: string) => {
    const idx = database.cameras.findIndex(c => c.id === id);
    if (idx !== -1) {
      database.cameras.splice(idx, 1);
      save();
      return true;
    }
    return false;
  },
  
  updateCamera: (id: string, data: Partial<Camera>) => {
    const idx = database.cameras.findIndex(c => c.id === id);
    if (idx !== -1) {
      database.cameras[idx] = { ...database.cameras[idx], ...data };
      save();
    }
  },
  
  createCameraIfNotExists: (name: string, apiKey: string, capabilities: any) => {
    let camera = database.cameras.find(c => c.name === name);
    if (!camera) {
      camera = {
        id: `cam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        api_key: apiKey,
        created_at: new Date().toISOString(),
        capabilities
      };
      database.cameras.push(camera);
      save();
    }
    return camera;
  }
};

load();
