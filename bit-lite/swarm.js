const Peer = require("./peer/peer");
const { createMetadata } = require("./shared/metadata");
const fs = require("fs");
const path = require("path");
const startHttpServer = require("./httpServer");
const express = require("express");

const TORRENT_PATH = path.join(__dirname, "/torrent/sample.torrent.json");

// ─── API SERVER FOR UI ────────────────────────
let peerInstance = null;

function startApiServer(port = 4000) {
  const api = express();
  api.use(express.json());

  // CORS
  api.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  api.get("/api/stats", (req, res) => {
    if (!peerInstance) return res.json({ error: "Peer not initialized" });

    let downloaded = 0;
    let uploaded = 0;
    for (const s of peerInstance.peerStats.values()) {
      downloaded += s.downloaded;
      uploaded += s.uploaded;
    }

    const pm = peerInstance.pieceManager;
    const pieces = pm ? pm.pieces : [];
    const completed = pieces.filter(Boolean).length;

    res.json({
      peerId: peerInstance.peerId,
      port: peerInstance.port,
      isSeeder: peerInstance.isSeeder,
      fileId: peerInstance.fileId,
      connectedPeers: peerInstance.uploadPeers.size,
      unchokedPeers: peerInstance.unchokedPeers.size,
      downloaded,
      uploaded,
      totalPieces: pieces.length,
      completedPieces: completed,
      progress: pieces.length > 0 ? ((completed / pieces.length) * 100).toFixed(1) : "0.0",
      isComplete: pm ? pm.isComplete() : false,
      endGame: peerInstance.endGame,
      bitfield: pieces.map(Boolean),
      mode: pm ? pm.mode : "unknown",
    });
  });

  api.get("/api/peers", (req, res) => {
    if (!peerInstance) return res.json([]);

    const peers = [];
    for (const [socket, stats] of peerInstance.peerStats.entries()) {
      peers.push({
        remote: socket.remoteAddress
          ? `${socket.remoteAddress}:${socket.remotePort}`
          : "unknown",
        downloaded: stats.downloaded,
        uploaded: stats.uploaded,
        lastActive: stats.lastActive,
        isChoked: !peerInstance.unchokedPeers.has(socket),
        isConnected: !socket.destroyed,
      });
    }
    res.json(peers);
  });

  api.get("/api/metadata", (req, res) => {
    if (!peerInstance || !peerInstance.metadata) {
      return res.json({ error: "No metadata" });
    }
    res.json(peerInstance.metadata);
  });

  api.listen(port, () => {
    console.log(`📊 API server on http://localhost:${port}`);
  });
}

// ─── MAIN ────────────────────────────────────
async function start() {
  const isSeeder = process.argv.includes("--seed");
  const enableApi = process.argv.includes("--api");

  const basePort = 5001;
  const port = isSeeder
    ? basePort
    : basePort + Math.floor(Math.random() * 1000) + 1;

  let metadata;

  // ─── TORRENT HANDLING ────────────────────────
  if (isSeeder && !fs.existsSync(TORRENT_PATH)) {
    metadata = createMetadata("./text-file/sample.txt");
    fs.writeFileSync(TORRENT_PATH, JSON.stringify(metadata, null, 2));
    console.log("Torrent file created");
  } else {
    metadata = JSON.parse(fs.readFileSync(TORRENT_PATH, "utf-8"));
    console.log(isSeeder ? "Seeder started" : "Torrent file loaded");
  }

  // ─── PEER ───────────────────────────────────
  const peer = new Peer({
    peerId: Math.random().toString(36).slice(2),
    port,
    filePath: isSeeder
      ? "./text-file/sample.txt"
      : `./downloads/sample-${port}.txt`,
    isSeeder,
    metadata,
    mode: "sequential",
  });

  peerInstance = peer;
  peer.startServer();

  // Start API server if requested
  if (enableApi) {
    startApiServer(4000);
  }

  // Tracker may not exist — don't crash
  try {
    await peer.announce();
  } catch {
    console.log("⚠ Tracker unavailable (continuing)");
  }

  // ─── LEECHER LOGIC ───────────────────────────
  if (!isSeeder) {
    // HTTP streaming should start immediately
    startHttpServer("./downloads", 8080);

    const peers = await peer.getPeers();
    const validPeers = peers.filter(p => p.port !== peer.port);

    if (validPeers.length === 0) {
      console.log("No peers available yet");
      return;
    }

    for (const p of validPeers.slice(0, 3)) {
      peer.connectToPeer(p);
    }
  }
}

start();
