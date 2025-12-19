const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const torrents = new Map();

app.post("/announce", (req, res) => {
  const { fileId, peerId, host, port } = req.body;

  if (!torrents.has(fileId)) {
    torrents.set(fileId, new Map());
  }

  torrents.get(fileId).set(peerId, { host, port, lastSeen: Date.now(), });
  console.log(`Peer ${peerId} announced for ${fileId}`);
  res.json({ status: "ok" });
});

app.get("/peers", (req, res) => {
  const { fileId, peerId } = req.query;

  if (!torrents.has(fileId)) return res.json([]);

  const now = Date.now();

  const peers = [...torrents.get(fileId).entries()]
    .filter(([_,p]) => now - p.lastSeen < 30000)  
    .filter(([id]) => id !== peerId)
    .map(([_, p]) => ({ host: p.host, port: p.port }));

  res.json(peers);
});

const PORT= 3000;
app.listen(PORT, () =>
  console.log(`Tracker running on http://localhost:${PORT}`)
);
