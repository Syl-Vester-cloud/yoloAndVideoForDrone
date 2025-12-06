# pi_stream_yolo.py
import asyncio
import json
import time
from picamera2 import Picamera2
from ultralytics import YOLO
import numpy as np
import cv2
from av import VideoFrame
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack, RTCIceCandidate
import websockets

SIGNALING = "ws://192.168.0.100:8080"  # replace with your Node.js signaling server IP
VIDEO_WIDTH = 320
VIDEO_HEIGHT = 240
FPS = 10

class YOLOVideoTrack(VideoStreamTrack):
    """Video track that captures from Picamera2 and draws YOLO detections"""
    def __init__(self, model, picam):
        super().__init__()
        self.model = model
        self.picam = picam

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        frame = self.picam.capture_array()

        # Ensure 3 channels
        if len(frame.shape) == 2:
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        elif frame.shape[2] == 4:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

        # Run YOLO
        results = self.model(frame, verbose=False)[0]
        annotated = results.plot()

        rgb_frame = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
        vframe = VideoFrame.from_ndarray(rgb_frame, format="rgb24")
        vframe.pts = pts
        vframe.time_base = time_base
        return vframe

async def run():
    # Load YOLO model
    model = YOLO("/home/mypie/Documents/yolov8n.pt")

    # Initialize camera
    picam = Picamera2()
    config = picam.create_video_configuration(main={"size": (VIDEO_WIDTH, VIDEO_HEIGHT)})
    picam.configure(config)
    picam.start()
    await asyncio.sleep(1.0)

    pc = RTCPeerConnection()
    track = YOLOVideoTrack(model, picam)
    pc.addTrack(track)

    async with websockets.connect(SIGNALING) as ws:
        # Register Pi
        await ws.send(json.dumps({"type": "register", "role": "pi"}))

        # Create and send offer
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await ws.send(json.dumps({"type": "offer", "sdp": pc.localDescription.sdp}))
        print("Offer sent to signaling server.")

        async for message in ws:
            data = json.loads(message)

            if data.get("type") == "answer":
                if pc.signalingState == "have-local-offer":
                    await pc.setRemoteDescription(RTCSessionDescription(data["sdp"], "answer"))
                    print("Answer received and set.")
                else:
                    print("Skipping answer, signaling state:", pc.signalingState)

            elif data.get("type") == "ice":
                cand = data.get("candidate")
                if cand and "candidate" in cand:
                    try:
                        ice_candidate = RTCIceCandidate(
                            candidate=cand["candidate"],
                            sdpMid=cand["sdpMid"],
                            sdpMLineIndex=cand["sdpMLineIndex"]
                        )
                        await pc.addIceCandidate(ice_candidate)
                    except Exception as e:
                        print("Failed to add ICE candidate:", e)

    await pc.close()
    picam.stop()

if __name__ == "__main__":
    asyncio.run(run())
