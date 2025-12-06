// server/server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let piSocket = null;
const viewers = new Set();

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch (e) { return; }

    // Role registration
    if (data.type === "register") {
      if (data.role === "pi") {
        console.log("Pi registered");
        piSocket = ws;
        ws.role = "pi";
      } else if (data.role === "viewer") {
        console.log("Viewer registered");
        viewers.add(ws);
        ws.role = "viewer";
      }
      return;
    }

    // pi -> viewers
    if (data.type === "offer" && ws.role === "pi") {
      // broadcast offer to all viewers
      for (const v of viewers) {
        if (v.readyState === WebSocket.OPEN) {
          v.send(JSON.stringify({ type: "offer", sdp: data.sdp }));
        }
      }
      return;
    }

    // viewer -> pi (answer)
    if (data.type === "answer" && ws.role === "viewer") {
      if (piSocket && piSocket.readyState === WebSocket.OPEN) {
        piSocket.send(JSON.stringify({ type: "answer", sdp: data.sdp }));
      }
      return;
    }

    // ICE candidates (forward accordingly)
    if (data.type === "ice") {
      if (ws.role === "pi") {
        // forward to all viewers
        for (const v of viewers) {
          if (v.readyState === WebSocket.OPEN) v.send(JSON.stringify({ type: "ice", candidate: data.candidate }));
        }
      } else if (ws.role === "viewer") {
        // forward to pi
        if (piSocket && piSocket.readyState === WebSocket.OPEN) {
          piSocket.send(JSON.stringify({ type: "ice", candidate: data.candidate }));
        }
      }
      return;
    }
  });

  ws.on("close", () => {
    if (ws.role === "pi") {
      console.log("Pi disconnected");
      piSocket = null;
    } else if (ws.role === "viewer") {
      viewers.delete(ws);
      console.log("Viewer disconnected");
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Signaling server running on :${PORT}`));