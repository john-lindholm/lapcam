import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = '';

function App() {
  const [token, setToken] = useState(localStorage.getItem('lapcam_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setToken(data.token);
      localStorage.setItem('lapcam_token', data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('lapcam_token');
    setCameras([]);
    setSelectedCamera(null);
  };

  const fetchCameras = async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_URL}/api/cameras`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        const now = Date.now();
        setCameras(data.map(cam => ({
          ...cam,
          isLive: (now - new Date(cam.last_seen).getTime()) < 15000
        })));
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchCameras();
    const interval = setInterval(fetchCameras, 3000);
    return () => clearInterval(interval);
  }, [token]);

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>📹 LapCam</h1>
          <form onSubmit={handleLogin}>
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={loading} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📹 LapCam Dashboard</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>
      <div className="dashboard">
        <div className="sidebar">
          <div className="camera-list">
            <h2>📷 Cameras</h2>
            {cameras.map(camera => (
              <div key={camera.id} className={`camera-item ${selectedCamera?.id === camera.id ? 'selected' : ''}`} onClick={() => setSelectedCamera(camera)}>
                <div className="camera-name">{camera.name}</div>
                <div className="camera-status">{camera.isLive ? '🟢 Live' : '⚪ Offline'}</div>
                <div className="camera-last-seen">{camera.last_seen ? new Date(camera.last_seen).toLocaleString() : 'Never'}</div>
              </div>
            ))}
          </div>
          {selectedCamera && (
            <>
              <div className="motion-panel">
                <h2>🔍 Recent Motion</h2>
                <MotionEvents cameraId={selectedCamera.id} token={token} />
              </div>
              <div className="recordings-panel">
                <h2>📁 Recordings</h2>
                <Recordings cameraName={selectedCamera.name} token={token} />
              </div>
            </>
          )}
        </div>
        <div className="main-content">
          {selectedCamera ? (
            <>
              <div className="stream-header">
                <h2>{selectedCamera.name}</h2>
                <span className={`live-badge ${selectedCamera.isLive ? 'live' : ''}`}>{selectedCamera.isLive ? '🔴 LIVE' : 'OFFLINE'}</span>
              </div>
              <StreamViewer cameraId={selectedCamera.id} token={token} />
            </>
          ) : (
            <div className="no-camera"><p>Select a camera to view</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

function StreamViewer({ cameraId, token }) {
  const [status, setStatus] = useState('Connecting...');
  const imgRef = useRef(null);
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const streamUrl = `${API_URL}/api/stream/${cameraId}/view?token=${token}`;
    img.onload = () => setStatus('✅ Streaming');
    img.onerror = () => {
      setStatus('❌ No signal');
      setTimeout(() => { img.src = streamUrl + '&t=' + Date.now(); }, 2000);
    };
    img.src = streamUrl;
    return () => { img.src = ''; };
  }, [cameraId, token]);
  return (
    <div className="stream-viewer">
      <div className={`status ${status === '✅ Streaming' ? 'live' : ''}`}>{status}</div>
      <img ref={imgRef} alt="Live stream" />
    </div>
  );
}

function MotionEvents({ cameraId, token }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const resp = await fetch(`${API_URL}/api/motion-events?cameraId=${cameraId}&limit=20`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) setEvents(await resp.json());
      } catch (err) {
        console.error('Failed to fetch motion events:', err);
      }
    };
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [cameraId, token]);
  if (events.length === 0) return <div className="no-events">No recent motion detected</div>;
  return (
    <div className="events-list">
      {events.slice(0, 15).map(event => (
        <div key={event.id} className="event-item">
          <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
          <span className="event-confidence">{Math.round(event.confidence)}%</span>
        </div>
      ))}
    </div>
  );
}

function Recordings({ cameraName, token }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    fetchRecordings();
  }, [cameraName, token]);
  
  const fetchRecordings = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/recordings/${cameraName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setRecordings(data.slice(0, 20));
      }
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div className="no-events">Loading...</div>;
  if (recordings.length === 0) return <div className="no-events">No recordings yet</div>;
  
  return (
    <div className="recordings-list">
      {recordings.map((rec, idx) => (
        <div key={idx} className="recording-item">
          <div className="recording-time">{new Date(rec.timestamp).toLocaleString()}</div>
          <div className="recording-info">{rec.size} KB</div>
        </div>
      ))}
    </div>
  );
}

export default App;
