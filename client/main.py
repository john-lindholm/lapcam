#!/usr/bin/env python3
"""
LapCam Client - WebRTC streaming client for home surveillance
Supports Ubuntu and Windows with motion detection
"""

import asyncio
import argparse
import yaml
import logging
import sys
import os
import signal
import uuid
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

import cv2
import numpy as np
from aiohttp import ClientSession, ClientWebSocketResponse, WSMsgType
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaBlackhole
from av import VideoFrame


logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("lapcam-client")


class MotionDetector:
    """Simple motion detection using frame differencing"""

    def __init__(self, sensitivity: float = 0.3, min_area: int = 500):
        self.sensitivity = sensitivity
        self.min_area = min_area
        self.prev_frame: Optional[np.ndarray] = None
        self.motion_detected = False

    def detect(self, frame: np.ndarray) -> bool:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        if self.prev_frame is None:
            self.prev_frame = gray
            return False

        frame_delta = cv2.absdiff(self.prev_frame, gray)
        thresh = cv2.threshold(
            frame_delta, int(255 * self.sensitivity), 255, cv2.THRESH_BINARY
        )[1]
        thresh = cv2.dilate(thresh, None, iterations=2)
        contours = cv2.findContours(
            thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        contours = contours[0] if len(contours) == 2 else contours[1]

        motion_found = False
        for contour in contours:
            if cv2.contourArea(contour) > self.min_area:
                motion_found = True
                break

        self.prev_frame = gray
        self.motion_detected = motion_found
        return motion_found


class CameraCapture:
    """Camera capture with OpenCV"""

    def __init__(
        self,
        device_index: int = 0,
        width: int = 1280,
        height: int = 720,
        framerate: int = 30,
    ):
        self.device_index = device_index
        self.width = width
        self.height = height
        self.framerate = framerate
        self.cap: Optional[cv2.VideoCapture] = None
        self.running = False

    def start(self) -> bool:
        self.cap = cv2.VideoCapture(self.device_index)
        if not self.cap.isOpened():
            logger.error(f"Failed to open camera {self.device_index}")
            return False

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.cap.set(cv2.CAP_PROP_FPS, self.framerate)
        self.running = True
        logger.info(f"Camera started: {self.width}x{self.height}@{self.framerate}fps")
        return True

    def read(self) -> Optional[np.ndarray]:
        if not self.running or self.cap is None:
            return None
        ret, frame = self.cap.read()
        return frame if ret else None

    def stop(self):
        self.running = False
        if self.cap is not None:
            self.cap.release()
            self.cap = None


class WebcamStreamTrack(VideoStreamTrack):
    """WebRTC video track from webcam"""

    def __init__(self, capture: CameraCapture):
        super().__init__()
        self.capture = capture
        self.frame_count = 0

    async def recv(self) -> VideoFrame:
        frame = await asyncio.get_event_loop().run_in_executor(None, self.capture.read)
        if frame is None:
            raise Exception("Camera read failed")

        pts, time_base = await self.next_timestamp()

        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        video_frame = VideoFrame.from_ndarray(frame_rgb, format="rgb24")
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame


class LapCamClient:
    """Main client application"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.camera_name = config["stream"]["camera_name"]
        self.session_id = str(uuid.uuid4())[:8]

        self.capture = CameraCapture(
            device_index=config["camera"]["device_index"],
            width=config["camera"]["width"],
            height=config["camera"]["height"],
            framerate=config["camera"]["framerate"],
        )

        self.motion_detector = (
            MotionDetector(
                sensitivity=config["stream"].get("motion_sensitivity", 0.3),
                min_area=config["stream"].get("motion_min_area", 500),
            )
            if config["stream"].get("motion_detection", False)
            else None
        )

        self.ws: Optional[ClientWebSocketResponse] = None
        self.pc: Optional[RTCPeerConnection] = None
        self.video_track: Optional[WebcamStreamTrack] = None
        self.running = False
        self.connected = False

    async def connect_signaling(self, session: ClientSession) -> bool:
        """Connect to signaling server"""
        server_url = self.config["server"]["url"]
        ws_url = f"{server_url}/ws/{self.camera_name}"

        headers = {"X-API-Key": self.config["server"]["api_key"]}

        try:
            self.ws = await session.ws_connect(ws_url, headers=headers)
            logger.info(f"Connected to signaling server: {ws_url}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to signaling: {e}")
            return False

    async def register_camera(self, session: ClientSession) -> bool:
        """Register camera with server"""
        server_url = self.config["server"]["url"]
        url = f"{server_url}/api/cameras/register"

        payload = {
            "camera_name": self.camera_name,
            "capabilities": {
                "resolution": f"{self.config['camera']['width']}x{self.config['camera']['height']}",
                "framerate": self.config["camera"]["framerate"],
                "motion_detection": self.motion_detector is not None,
            },
        }

        headers = {"X-API-Key": self.config["server"]["api_key"]}

        try:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info(f"Camera registered: {data}")
                    return True
                else:
                    logger.error(f"Registration failed: {resp.status}")
                    return False
        except Exception as e:
            logger.error(f"Registration error: {e}")
            return False

    async def setup_webrtc(self) -> bool:
        """Setup WebRTC peer connection"""
        self.pc = RTCPeerConnection()

        @self.pc.on("connectionstatechange")
        async def on_connection_state_change():
            logger.info(f"Connection state: {self.pc.connectionState}")
            if self.pc.connectionState == "failed":
                await self.pc.close()
                self.connected = False
            elif self.pc.connectionState == "connected":
                self.connected = True

        self.video_track = WebcamStreamTrack(self.capture)
        self.pc.addTrack(self.video_track)

        return True

    async def negotiate_webrtc(self) -> bool:
        """Perform WebRTC offer/answer exchange"""
        if not self.ws:
            return False

        # Create offer
        offer = await self.pc.createOffer()
        await self.pc.setLocalDescription(offer)

        # Send offer to server
        await self.ws.send_json(
            {
                "type": "offer",
                "sdp": self.pc.localDescription.sdp,
                "camera_name": self.camera_name,
            }
        )

        # Wait for answer
        msg = await self.ws.receive()
        if msg.type != WSMsgType.TEXT:
            return False

        data = msg.json()
        if data.get("type") != "answer":
            logger.error(f"Unexpected message: {data}")
            return False

        answer = RTCSessionDescription(sdp=data["sdp"], type="answer")
        await self.pc.setRemoteDescription(answer)

        logger.info("WebRTC negotiation complete")
        return True

    async def run(self):
        """Main client loop"""
        self.running = True

        if not self.capture.start():
            return

        async with ClientSession() as session:
            # Register camera
            if not await self.register_camera(session):
                logger.warning("Camera registration failed, continuing anyway")

            # Connect to signaling
            if not await self.connect_signaling(session):
                return

            # Setup WebRTC
            if not await self.setup_webrtc():
                return

            # Negotiate WebRTC
            if not await self.negotiate_webrtc():
                return

            # Main loop - handle signaling messages and motion detection
            last_motion_time = None
            motion_cooldown = 5.0  # seconds between motion reports

            while self.running:
                try:
                    # Check for signaling messages
                    if self.ws and not self.ws.closed:
                        msg = await asyncio.wait_for(self.ws.receive(), timeout=1.0)

                        if msg.type == WSMsgType.TEXT:
                            data = msg.json()
                            msg_type = data.get("type")

                            if msg_type == "ping":
                                await self.ws.send_json({"type": "pong"})
                            elif msg_type == "reconnect":
                                logger.info("Reconnect requested")
                                await self.negotiate_webrtc()

                    # Motion detection reporting
                    if self.motion_detector and self.capture.cap is not None:
                        frame = self.capture.read()
                        if frame is not None:
                            motion = self.motion_detector.detect(frame)
                            now = datetime.now().timestamp()

                            if motion and (
                                last_motion_time is None
                                or now - last_motion_time > motion_cooldown
                            ):
                                last_motion_time = now
                                if self.ws and not self.ws.closed:
                                    await self.ws.send_json(
                                        {
                                            "type": "motion",
                                            "camera_name": self.camera_name,
                                            "timestamp": now,
                                        }
                                    )
                                logger.debug("Motion detected!")

                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    logger.error(f"Error in main loop: {e}")
                    await asyncio.sleep(1)

    def stop(self):
        """Stop the client"""
        logger.info("Stopping client...")
        self.running = False
        self.capture.stop()


def load_config(config_path: str) -> Dict[str, Any]:
    """Load configuration from YAML file"""
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


async def main():
    parser = argparse.ArgumentParser(description="LapCam Client")
    parser.add_argument(
        "--config", "-c", required=True, help="Path to configuration file"
    )
    args = parser.parse_args()

    config = load_config(args.config)

    # Setup logging
    log_level = getattr(logging, config["logging"].get("level", "INFO"))
    logging.getLogger().setLevel(log_level)

    client = LapCamClient(config)

    # Setup signal handlers
    loop = asyncio.get_event_loop()
    stop_event = asyncio.Event()

    def signal_handler():
        logger.info("Shutdown signal received")
        client.stop()
        stop_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, signal_handler)

    try:
        await client.run()
    except KeyboardInterrupt:
        pass
    finally:
        client.stop()
        await asyncio.sleep(0.5)
        logger.info("Client stopped")


if __name__ == "__main__":
    asyncio.run(main())
