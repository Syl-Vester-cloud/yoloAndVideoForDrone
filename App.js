import React, { useEffect, useRef, useState } from "react";

const SIGNALING_SERVER = "ws://192.168.0.100:8080"; // replace

function App() {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    wsRef.current = new WebSocket(SIGNALING_SERVER);

    wsRef.current.onopen = () => {
      console.log("WS connected, registering as viewer");
      wsRef.current.send(JSON.stringify({ type: "register", role: "viewer" }));
    };

    wsRef.current.onmessage = async (evt) => {
      const data = JSON.parse(evt.data);
      if (data.type === "offer") {
        console.log("Received offer");
        // create peer connection
        pcRef.current = new RTCPeerConnection();

        pcRef.current.ontrack = (event) => {
          console.log("Track received:", event.streams);
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.play().catch(() => {});
          }
        };

        pcRef.current.onicecandidate = (e) => {
          if (e.candidate) {
            wsRef.current.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
          }
        };

        // handle incoming offer
        await pcRef.current.setRemoteDescription({ type: "offer", sdp: data.sdp });
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        // send answer back to pi via server
        wsRef.current.send(JSON.stringify({ type: "answer", sdp: pcRef.current.localDescription.sdp }));
        setConnected(true);
      } else if (data.type === "ice") {
        if (pcRef.current) {
          try {
            await pcRef.current.addIceCandidate(data.candidate);
          } catch (e) {
            console.warn("Error adding ICE candidate", e);
          }
        }
      }
    };

    wsRef.current.onclose = () => {
      console.log("WS closed");
    };

    return () => {
      if (pcRef.current) pcRef.current.close();
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Pi YOLO Live Stream</h2>
      <video ref={videoRef} style={{ width: "100%", maxWidth: 720, borderRadius: 8 }} playsInline autoPlay controls />
      <div>{connected ? "Connected" : "Waiting for stream..."}</div>
    </div>
  );
}

export default App;