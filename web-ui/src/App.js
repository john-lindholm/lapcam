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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [motionPanelOpen, setMotionPanelOpen] = useState(true);
  const [recordingsPanelOpen, setRecordingsPanelOpen] = useState(true);
  const [showCameraManager, setShowCameraManager] = useState(false);
  const [newCameraName, setNewCameraName] = useState('');
  const [generatedKey, setGeneratedKey] = useState(null);

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

  const handleCreateCamera = async (e) => {
    e.preventDefault();
    if (!newCameraName.trim()) return;
    try {
      const resp = await fetch(`${API_URL}/api/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newCameraName.trim() })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setGeneratedKey(data);
      setNewCameraName('');
      fetchCameras();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteCamera = async (cameraId) => {
    if (!window.confirm('Delete this camera?')) return;
    try {
      const resp = await fetch(`${API_URL}/api/cameras/${cameraId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error((await resp.json()).error);
      fetchCameras();
      if (selectedCamera?.id === cameraId) setSelectedCamera(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied!');
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
      {/* Top Menu Overlay */}
      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setShowCameraManager(true); setMenuOpen(false); }} className="menu-item">
              📷 Manage Cameras
            </button>
            <button onClick={() => { setSidebarOpen(true); setMenuOpen(false); }} className="menu-item">
              📺 Show Sidebar
            </button>
            <hr className="menu-divider" />
            <button onClick={handleLogout} className="menu-item logout">
              🚪 Logout
            </button>
          </div>
        </div>
      )}

      {/* Camera Manager Modal */}
      {showCameraManager && (
        <div className="modal-overlay" onClick={() => { setShowCameraManager(false); setGeneratedKey(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📷 Manage Cameras</h2>
              <button onClick={() => { setShowCameraManager(false); setGeneratedKey(null); }} className="close-modal">&times;</button>
            </div>
            {!generatedKey ? (
              <>
                <form onSubmit={handleCreateCamera} className="create-camera-form">
                  <input type="text" placeholder="Camera name (e.g., laptop, desktop)" value={newCameraName} onChange={(e) => setNewCameraName(e.target.value)} required />
                  <button type="submit" className="create-btn">Create</button>
                </form>
                <div className="camera-list-admin">
                  <h3>Existing Cameras</h3>
                  {cameras.map(cam => (
                    <div key={cam.id} className="camera-item-admin">
                      <div>
                        <strong>{cam.name}</strong>
                        <div className="camera-meta">
                          <small>ID: {cam.id.slice(0,8)}...</small>
                          {cam.last_seen && <small>Last: {new Date(cam.last_seen).toLocaleString()}</small>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteCamera(cam.id)} className="delete-btn">Delete</button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="api-key-result">
                <h3>✅ Camera Created!</h3>
                <p><strong>API Key:</strong></p>
                <div className="api-key-box">
                  <code>{generatedKey.api_key}</code>
                  <button onClick={() => copyToClipboard(generatedKey.api_key)} className="copy-btn">Copy</button>
                </div>
                <p className="warning">⚠️ Save this! Cannot be retrieved later.</p>
                <button onClick={() => setGeneratedKey(null)} className="done-btn">Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="header">
        <div className="header-left">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="menu-toggle sidebar-toggle">
            {sidebarOpen ? '◀' : '▶'}
          </button>
          <h1>📹 LapCam</h1>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="menu-button">
          ☰
        </button>
      </header>
      
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      
      <div className="dashboard">
        <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
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
                <div className="panel-header" onClick={() => setMotionPanelOpen(!motionPanelOpen)}>
                  <h2>🔍 Recent Motion</h2>
                  <span className="toggle-icon">{motionPanelOpen ? '▼' : '▶'}</span>
                </div>
                {motionPanelOpen && <MotionEvents cameraId={selectedCamera.id} token={token} />}
              </div>
              <div className="recordings-panel">
                <div className="panel-header" onClick={() => setRecordingsPanelOpen(!recordingsPanelOpen)}>
                  <h2>📁 Recordings</h2>
                  <span className="toggle-icon">{recordingsPanelOpen ? '▼' : '▶'}</span>
                </div>
                {recordingsPanelOpen && <Recordings cameraName={selectedCamera.name} token={token} />}
              </div>
            </>
          )}
        </div>
        <div className={`main-content ${!sidebarOpen ? 'full-width' : ''}`}>
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
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  if (events.length === 0) return <div className="no-events">No recent motion detected</div>;
  
  if (selectedEvent) {
    const filename = selectedEvent.screenshot ? selectedEvent.screenshot.split('/').pop() : null;
    
    return (
      <div className="motion-event-detail">
        {filename && (
          <img 
            src={`${API_URL}/api/snapshots/${selectedEvent.cameraName}/${filename}?token=${token}`} 
            alt="Motion snapshot" 
            className="motion-snapshot"
          />
        )}
        {selectedEvent.video && (
          <video controls className="motion-video">
            <source src={`${API_URL}/api/videos/${selectedEvent.cameraName}/${selectedEvent.video.split('/').pop()}?token=${token}`} type="video/mp4" />
            Your browser does not support video playback.
          </video>
        )}
        <div className="event-info">
          <strong>{new Date(selectedEvent.timestamp).toLocaleString()}</strong>
          <span>{Math.round(selectedEvent.confidence)}% confidence</span>
        </div>
        <button onClick={() => setSelectedEvent(null)} className="close-btn">Back to list</button>
      </div>
    );
  }
  
  return (
    <div className="events-list">
      {events.slice(0, 15).map(event => (
        <div 
          key={event.id} 
          className={`event-item ${(event.screenshot || event.video) ? 'has-media' : ''}`}
          onClick={() => (event.screenshot || event.video) && setSelectedEvent(event)}
        >
          {event.screenshot && (
            <img 
              src={`${API_URL}/api/snapshots/${event.cameraName}/${event.screenshot.split('/').pop()}?token=${token}`} 
              alt="Snapshot" 
              className="event-thumbnail"
            />
          )}
          <div className="event-details">
            <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
            <span className="event-confidence">{Math.round(event.confidence)}%</span>
            {event.screenshot && <span className="media-badge">📸</span>}
            {event.video && <span className="media-badge">🎥</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Recordings({ cameraName, token }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState(null);
  
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
  
  const playRecording = (rec) => {
    setSelectedRecording(rec);
  };
  
  const closePlayer = () => {
    setSelectedRecording(null);
  };
  
  if (loading) return <div className="no-events">Loading...</div>;
  if (recordings.length === 0) return <div className="no-events">No recordings yet</div>;
  
  if (selectedRecording) {
    const imageUrl = `${API_URL}/api/recordings/${cameraName}/${encodeURIComponent(selectedRecording.key.split('/').pop())}?token=${token}`;
    return (
      <div className="video-player">
        <img src={imageUrl} alt="Recording" style={{maxWidth: '100%', maxHeight: '400px'}} />
        <div className="recording-info" style={{marginTop: '10px'}}>
          {new Date(selectedRecording.timestamp).toLocaleString()} - {selectedRecording.size} KB
        </div>
        <button onClick={closePlayer} className="close-player">Close</button>
      </div>
    );
  }
  
  return (
    <div className="recordings-list">
      {recordings.map((rec, idx) => (
        <div key={idx} className="recording-item clickable" onClick={() => playRecording(rec)}>
          <div className="recording-time">{new Date(rec.timestamp).toLocaleString()}</div>
          <div className="recording-info">{rec.size} KB</div>
        </div>
      ))}
    </div>
  );
}

export default App;
