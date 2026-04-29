const express = require("express");

const app = express();
app.use(express.json());

// CORS for UI
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const torrents = new Map();

app.post("/announce", (req, res) => {
  const { fileId, peerId, host, port } = req.body;

  if (!torrents.has(fileId)) {
    torrents.set(fileId, new Map());
  }

  torrents.get(fileId).set(peerId, { host, port, lastSeen: Date.now() });
  console.log(`Peer ${peerId} announced for ${fileId}`);
  res.json({ status: "ok" });
});

app.get("/peers", (req, res) => {
  const { fileId, peerId } = req.query;

  if (!torrents.has(fileId)) return res.json([]);

  const now = Date.now();

  const peers = [...torrents.get(fileId).entries()]
    .filter(([_, p]) => now - p.lastSeen < 30000)
    .filter(([id]) => id !== peerId)
    .map(([_, p]) => ({ host: p.host, port: p.port }));

  res.json(peers);
});

// Status endpoint for UI
app.get("/status", (req, res) => {
  const now = Date.now();
  const status = {};

  for (const [fileId, peers] of torrents.entries()) {
    const activePeers = [...peers.entries()]
      .filter(([_, p]) => now - p.lastSeen < 30000)
      .map(([id, p]) => ({
        peerId: id,
        host: p.host,
        port: p.port,
        lastSeen: p.lastSeen,
      }));

    if (activePeers.length > 0) {
      status[fileId] = {
        peerCount: activePeers.length,
        peers: activePeers,
      };
    }
  }

  res.json({
    tracker: "online",
    activeTorrents: Object.keys(status).length,
    torrents: status,
    uptime: process.uptime(),
  });
});

const PEER_TTL = 30000;

setInterval(() => {
  const now = Date.now();

  for (const [fileId, peers] of torrents.entries()) {
    for (const [peerId, info] of peers.entries()) {
      if (now - info.lastSeen > PEER_TTL) {
        peers.delete(peerId);
      }
    }

    if (peers.size === 0) {
      torrents.delete(fileId);
    }
  }
}, 10000);

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`Tracker running on http://localhost:${PORT}`)
);
