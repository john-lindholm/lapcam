import React, { useState, useEffect, useRef } from 'react';

const API_URL = window.location.origin;

interface Camera {
  id: string;
  name: string;
  created_at: string;
  last_seen: string;
  capabilities?: string;
}

interface Recording {
  id: string;
  camera_id: string;
  camera_name: string;
  start_time: string;
  end_time: string;
  s3_key: string;
  motion_events?: string;
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('lapcam_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [viewingMode, setViewingMode] = useState<'live' | 'playback'>('live');
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const viewerWsRef = useRef<WebSocket | null>(null);

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        localStorage.setItem('lapcam_token', data.token);
      } else {
        alert('Login failed');
      }
    } catch (err) {
      console.error(err);
      alert('Login failed');
    }
  };

  // Logout
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('lapcam_token');
    setCameras([]);
    setRecordings([]);
  };

  // Fetch cameras
  const fetchCameras = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/cameras`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCameras(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch recordings
  const fetchRecordings = async (cameraId?: string) => {
    if (!token) return;
    try {
      const url = new URL(`${API_URL}/api/recordings`);
      if (cameraId) url.searchParams.set('cameraId', cameraId);
      
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecordings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCameras();
      fetchRecordings();
    }
  }, [token]);

  // Connect to live stream
  const connectToStream = async (cameraId: string) => {
    setSelectedCamera(cameraId);
    setViewingMode('live');

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        if (videoElement && event.streams[0]) {
          videoElement.srcObject = event.streams[0];
        }
      };

      // Connect to viewer WebSocket
      const ws = new WebSocket(`wss://${window.location.host}/ws/viewer`);
      viewerWsRef.current = ws;

      ws.onopen = () => {
        console.log('Viewer WebSocket connected');
        
        // Send watch request with RTP capabilities
        ws.send(JSON.stringify({
          type: 'watch',
          cameraId,
          rtpCapabilities: pc.rtpCapabilities
        }));
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'consumer_created') {
          const { consumerParameters } = message;
          
          // Add transceiver for receiving
          pc.addTransceiver(consumerParameters.kind, {
            direction: 'recvonly'
          });

          // Create offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          // Note: In a full implementation, you would send the offer to the server
          // and receive an answer back. For simplicity, we're using a direct connection.
        }
      };

      // Create video element if not exists
      setTimeout(() => {
        const vid = document.getElementById('video-player') as HTMLVideoElement;
        if (vid) {
          setVideoElement(vid);
        }
      }, 100);

    } catch (err) {
      console.error('Failed to connect to stream:', err);
    }
  };

  // Play recording
  const playRecording = async (recording: Recording) => {
    setSelectedCamera(recording.camera_id);
    setViewingMode('playback');

    try {
      const res = await fetch(`${API_URL}/api/recordings/${recording.id}/url`, {
        headers: { Authorization: `Bearer ${token!}` }
      });
      
      if (res.ok) {
        const { url } = await res.json();
        const vid = document.getElementById('video-player') as HTMLVideoElement;
        if (vid) {
          vid.src = url;
          vid.play();
        }
      }
    } catch (err) {
      console.error('Failed to load recording:', err);
    }
  };

  // Disconnect from stream
  const disconnectStream = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (viewerWsRef.current) {
      viewerWsRef.current.close();
      viewerWsRef.current = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
      videoElement.src = '';
    }
    setSelectedCamera(null);
  };

  if (!token) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>LapCam</h1>
        <form onSubmit={handleLogin} style={styles.loginForm}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>LapCam</h1>
        <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
      </header>

      <div style={styles.main}>
        <div style={styles.sidebar}>
          <h2>Cameras</h2>
          <ul style={styles.list}>
            {cameras.map((camera) => (
              <li
                key={camera.id}
                style={{
                  ...styles.listItem,
                  backgroundColor: selectedCamera === camera.id ? '#e0e0e0' : 'transparent'
                }}
              >
                <div style={styles.cameraInfo}>
                  <strong>{camera.name}</strong>
                  <small style={styles.status}>
                    {camera.last_seen ? 'Online' : 'Offline'}
                  </small>
                </div>
                <button
                  onClick={() => connectToStream(camera.id)}
                  style={styles.smallButton}
                >
                  Watch Live
                </button>
              </li>
            ))}
          </ul>

          <h2 style={{ marginTop: 20 }}>Recordings</h2>
          <ul style={styles.list}>
            {recordings.map((recording) => (
              <li
                key={recording.id}
                style={{
                  ...styles.listItem,
                  backgroundColor: viewingMode === 'playback' && selectedCamera === recording.id ? '#e0e0e0' : 'transparent'
                }}
              >
                <div>
                  <strong>{recording.camera_name}</strong>
                  <br />
                  <small>
                    {new Date(recording.start_time).toLocaleString()}
                  </small>
                </div>
                <button
                  onClick={() => playRecording(recording)}
                  style={styles.smallButton}
                >
                  Play
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={styles.content}>
          {selectedCamera ? (
            <>
              <div style={styles.videoContainer}>
                <video
                  id="video-player"
                  ref={setVideoElement}
                  autoPlay
                  playsInline
                  controls={viewingMode === 'playback'}
                  style={styles.video}
                />
              </div>
              <div style={styles.videoInfo}>
                <h3>
                  {viewingMode === 'live' ? 'Live View' : 'Playback'}
                  {selectedCamera && ` - ${cameras.find(c => c.id === selectedCamera)?.name || ''}`}
                </h3>
                <button onClick={disconnectStream} style={styles.button}>
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <div style={styles.placeholder}>
              Select a camera to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #ddd',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  title: {
    margin: 0,
    fontSize: 24,
    color: '#333'
  },
  loginForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxWidth: 300,
    margin: '100px auto',
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  input: {
    padding: '10px 12px',
    fontSize: 16,
    border: '1px solid #ddd',
    borderRadius: 4
  },
  button: {
    padding: '10px 20px',
    fontSize: 16,
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer'
  },
  logoutButton: {
    padding: '8px 16px',
    fontSize: 14,
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer'
  },
  main: {
    display: 'flex',
    height: 'calc(100vh - 73px)'
  },
  sidebar: {
    width: 300,
    padding: 16,
    backgroundColor: '#fff',
    borderRight: '1px solid #ddd',
    overflowY: 'auto'
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 4,
    border: '1px solid #eee'
  },
  cameraInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  status: {
    color: '#28a745',
    fontSize: 12
  },
  smallButton: {
    padding: '6px 12px',
    fontSize: 12,
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer'
  },
  content: {
    flex: 1,
    padding: 24,
    overflowY: 'auto'
  },
  videoContainer: {
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16
  },
  video: {
    width: '100%',
    maxHeight: '70vh',
    display: 'block'
  },
  videoInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  placeholder: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#999',
    fontSize: 18
  }
};

export default App;
