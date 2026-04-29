const Peer = require("./peer/peer");
const { createMetadata } = require("./shared/metadata");
const fs = require("fs");
const path = require("path");
const startHttpServer = require("./httpServer");

/**
 * Worker process — spawned by the orchestrator via child_process.fork()
 * Receives config via IPC message, runs as seeder or leecher.
 * Reports stats back to orchestrator.
 */

let peer = null;

process.on("message", async msg => {
  if (msg.type === "START") {
    await startPeer(msg.config);
  }

  if (msg.type === "STOP") {
    process.exit(0);
  }

  if (msg.type === "GET_STATS") {
    sendStats();
  }
});

async function startPeer(config) {
  const {
    peerId,
    port,
    filePath,
    isSeeder,
    torrentPath,
    metadataObj,
    mode,
    httpPort,
  } = config;

  let metadata;

  // ─── TORRENT HANDLING ────────────────────────
  if (isSeeder && metadataObj) {
    // Orchestrator already created the metadata
    metadata = metadataObj;
    // Save the torrent file
    if (torrentPath) {
      const dir = path.dirname(torrentPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(torrentPath, JSON.stringify(metadata, null, 2));
    }
  } else if (isSeeder && torrentPath && !fs.existsSync(torrentPath)) {
    metadata = createMetadata(filePath);
    const dir = path.dirname(torrentPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(torrentPath, JSON.stringify(metadata, null, 2));
  } else if (torrentPath && fs.existsSync(torrentPath)) {
    metadata = JSON.parse(fs.readFileSync(torrentPath, "utf-8"));
  } else if (metadataObj) {
    metadata = metadataObj;
  } else {
    console.error("No torrent file or metadata provided");
    process.exit(1);
  }

  // ─── PEER ───────────────────────────────────
  peer = new Peer({
    peerId,
    port,
    filePath,
    isSeeder,
    metadata,
    mode: mode || "sequential",
  });

  peer.startServer();

  // All peers announce (not just seeders) — true peer behavior
  try {
    await peer.announce();
  } catch {
    console.log("⚠ Tracker unavailable (continuing)");
  }

  // Periodic re-announce (every 20s) so tracker always has us
  setInterval(async () => {
    try {
      await peer.announce();
    } catch {}
  }, 20000);

  // Stats reporter
  setInterval(() => sendStats(), 2000);

  // ─── LEECHER LOGIC ───────────────────────────
  if (!isSeeder) {
    if (httpPort) {
      const downloadDir = path.dirname(filePath);
      if (!fs.existsSync(downloadDir))
        fs.mkdirSync(downloadDir, { recursive: true });
      startHttpServer(downloadDir, httpPort);
    }

    // Initial peer discovery + connect
    await connectToSwarm();

    // Periodically discover new peers (for leecher-to-leecher)
    setInterval(async () => {
      if (peer.pieceManager && !peer.pieceManager.isComplete()) {
        await connectToSwarm();
      }
    }, 10000);
  }

  process.send({ type: "STARTED", peerId, port, isSeeder });
}

async function connectToSwarm() {
  if (!peer) return;
  try {
    const peers = await peer.getPeers();
    const validPeers = peers.filter(p => p.port !== peer.port);

    if (validPeers.length === 0) {
      console.log("No new peers available yet");
      return;
    }

    for (const p of validPeers.slice(0, 5)) {
      peer.connectToPeer(p);
    }
  } catch {}
}

function sendStats() {
  if (!peer) return;

  let downloaded = 0;
  let uploaded = 0;
  for (const s of peer.peerStats.values()) {
    downloaded += s.downloaded;
    uploaded += s.uploaded;
  }

  const pm = peer.pieceManager;
  const pieces = pm ? pm.pieces : [];
  const completed = pieces.filter(Boolean).length;

  process.send({
    type: "STATS",
    data: {
      peerId: peer.peerId,
      port: peer.port,
      isSeeder: peer.isSeeder,
      fileId: peer.fileId,
      connectedPeers: peer.uploadPeers.size,
      unchokedPeers: peer.unchokedPeers.size,
      downloaded,
      uploaded,
      totalPieces: pieces.length,
      completedPieces: completed,
      progress:
        pieces.length > 0
          ? ((completed / pieces.length) * 100).toFixed(1)
          : "0.0",
      isComplete: pm ? pm.isComplete() : false,
      endGame: peer.endGame,
      bitfield: pieces.map(Boolean),
      mode: pm ? pm.mode : "unknown",
    },
  });
}
