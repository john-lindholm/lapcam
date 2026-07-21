#!/usr/bin/env python3
"""
LapCam Client - HTTP MJPEG streaming client for home surveillance
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
import base64
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

import cv2
import numpy as np
from aiohttp import ClientSession, ClientError


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

    def detect_with_confidence(self, frame: np.ndarray) -> tuple[bool, float]:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        if self.prev_frame is None:
            self.prev_frame = gray
            return False, 0.0

        frame_delta = cv2.absdiff(self.prev_frame, gray)
        thresh = cv2.threshold(
            frame_delta, int(255 * self.sensitivity), 255, cv2.THRESH_BINARY
        )[1]
        thresh = cv2.dilate(thresh, None, iterations=2)
        contours = cv2.findContours(
            thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        contours = contours[0] if len(contours) == 2 else contours[1]

        total_area = sum(cv2.contourArea(c) for c in contours)
        confidence = min(100.0, (total_area / 10000.0) * 100)

        motion_found = total_area > self.min_area

        self.prev_frame = gray
        self.motion_detected = motion_found
        return motion_found, confidence


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


class LapCamClient:
    """Main HTTP streaming client application"""

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

        self.running = False
        self.frames_sent = 0
        self.last_heartbeat = 0

    async def send_frame(self, session: ClientSession, frame: np.ndarray) -> bool:
        """Send frame to server via HTTP POST"""
        server_url = self.config["server"]["url"]
        url = f"{server_url}/api/stream/{self.camera_name}/frame"

        headers = {"X-API-Key": self.config["server"]["api_key"]}

        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        frame_bytes = buffer.tobytes()

        try:
            async with session.post(url, data=frame_bytes, headers=headers) as resp:
                if resp.status == 200:
                    self.frames_sent += 1
                    return True
                else:
                    logger.error(f"Frame upload failed: {resp.status}")
                    return False
        except Exception as e:
            logger.error(f"Frame upload error: {e}")
            return False

    async def send_motion_event(
        self, session: ClientSession, confidence: float, timestamp: float
    ):
        """Report motion event to server"""
        server_url = self.config["server"]["url"]
        url = f"{server_url}/api/motion-events"

        headers = {"X-API-Key": self.config["server"]["api_key"]}

        payload = {
            "cameraId": self.camera_name,
            "cameraName": self.camera_name,
            "confidence": confidence,
            "timestamp": timestamp,
        }

        try:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    logger.debug(f"Motion event reported: {confidence:.1f}%")
                else:
                    logger.error(f"Motion event failed: {resp.status}")
        except Exception as e:
            logger.error(f"Motion event error: {e}")

    async def run(self):
        """Main client loop"""
        self.running = True

        if not self.capture.start():
            return

        async with ClientSession() as session:
            last_motion_time = None
            motion_cooldown = 5.0
            frame_interval = 1.0 / self.config["camera"]["framerate"]

            while self.running:
                try:
                    frame = await asyncio.get_event_loop().run_in_executor(
                        None, self.capture.read
                    )
                    if frame is None:
                        await asyncio.sleep(0.1)
                        continue

                    # Send frame to server
                    await self.send_frame(session, frame)

                    # Motion detection
                    if self.motion_detector:
                        motion, confidence = (
                            self.motion_detector.detect_with_confidence(frame)
                        )
                        now = datetime.now().timestamp()

                        if motion and (
                            last_motion_time is None
                            or now - last_motion_time > motion_cooldown
                        ):
                            last_motion_time = now
                            await self.send_motion_event(session, confidence, now)
                            logger.info(f"Motion detected: {confidence:.1f}%")

                    await asyncio.sleep(frame_interval)

                except Exception as e:
                    logger.error(f"Error in main loop: {e}")
                    await asyncio.sleep(1)

    def stop(self):
        """Stop the client"""
        logger.info("Stopping client...")
        self.running = False
        self.capture.stop()
        logger.info(f"Total frames sent: {self.frames_sent}")


def load_config(config_path: str) -> Dict[str, Any]:
    """Load configuration from YAML file"""
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


async def main():
    parser = argparse.ArgumentParser(description="LapCam HTTP Client")
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

    def signal_handler():
        logger.info("Shutdown signal received")
        client.stop()

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
