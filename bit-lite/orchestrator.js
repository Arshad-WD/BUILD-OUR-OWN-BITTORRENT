const { fork, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { createMetadata } = require("./shared/metadata");

// ─── CONFIG ───────────────────────────────────
const TRACKER_PORT = 3000;
const API_PORT = 4000;
const UI_PORT = 3001;
const DHT_PORT = 6881;
const BASE_PEER_PORT = 5001;
const UPLOADS_DIR = path.join(__dirname, "uploads");
const TORRENTS_DIR = path.join(__dirname, "torrents");
const DOWNLOADS_DIR = path.join(__dirname, "downloads");

// Ensure directories
[UPLOADS_DIR, TORRENTS_DIR, DOWNLOADS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── STATE ────────────────────────────────────
const nodes = new Map();       // id -> { process, config, stats, status }
const torrents = new Map();    // infoHash -> { metadata, filePath, name }
let nextPort = BASE_PEER_PORT;
let trackerProcess = null;
let dhtProcess = null;
let uiProcess = null;

// ─── PROCESS MANAGEMENT ──────────────────────
function spawnTracker() {
  trackerProcess = fork(path.join(__dirname, "tracker/server.js"), [], {
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    env: { ...process.env },
  });

  trackerProcess.stdout.on("data", d => process.stdout.write(`[tracker] ${d}`));
  trackerProcess.stderr.on("data", d => process.stderr.write(`[tracker] ${d}`));
  trackerProcess.on("exit", code => {
    console.log(`[orchestrator] Tracker exited with code ${code}`);
  });

  console.log(`[orchestrator] Tracker starting on port ${TRACKER_PORT}`);
}

function spawnDHT() {
  dhtProcess = fork(path.join(__dirname, "dht-bootstrap.js"), [], {
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });

  dhtProcess.stdout.on("data", d => process.stdout.write(`[dht] ${d}`));
  dhtProcess.stderr.on("data", d => process.stderr.write(`[dht] ${d}`));
  dhtProcess.on("exit", code => {
    console.log(`[orchestrator] DHT exited with code ${code}`);
  });

  console.log(`[orchestrator] DHT node starting on UDP ${DHT_PORT}`);
}

function spawnUI() {
  uiProcess = require("child_process").spawn("npx", ["next", "dev", "-p", String(UI_PORT)], {
    cwd: path.join(__dirname, "ui"),
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });

  uiProcess.stdout.on("data", d => {
    const line = d.toString().trim();
    if (line) process.stdout.write(`[ui] ${line}\n`);
  });
  uiProcess.stderr.on("data", d => {
    const line = d.toString().trim();
    if (line && !line.includes("ExperimentalWarning")) {
      process.stderr.write(`[ui] ${line}\n`);
    }
  });
  uiProcess.on("exit", code => {
    console.log(`[orchestrator] UI exited with code ${code}`);
  });

  console.log(`[orchestrator] UI starting on http://localhost:${UI_PORT}`);
}

function spawnWorker(config) {
  const id = config.peerId;
  const worker = fork(path.join(__dirname, "worker.js"), [], {
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });

  worker.stdout.on("data", d =>
    process.stdout.write(`[${id.slice(0, 6)}] ${d}`)
  );
  worker.stderr.on("data", d =>
    process.stderr.write(`[${id.slice(0, 6)}] ${d}`)
  );

  const nodeInfo = {
    process: worker,
    config,
    stats: null,
    status: "starting",
  };

  nodes.set(id, nodeInfo);

  worker.on("message", msg => {
    if (msg.type === "STARTED") {
      nodeInfo.status = "running";
      console.log(
        `[orchestrator] ${msg.isSeeder ? "Seeder" : "Leecher"} ${msg.peerId.slice(0, 6)} running on port ${msg.port}`
      );
    }
    if (msg.type === "STATS") {
      nodeInfo.stats = msg.data;
    }
  });

  worker.on("exit", code => {
    nodeInfo.status = "stopped";
    console.log(`[orchestrator] Worker ${id.slice(0, 6)} exited (code ${code})`);
  });

  // Send start config
  worker.send({ type: "START", config });

  return id;
}

function getNextPort() {
  return nextPort++;
}

// ─── API SERVER ───────────────────────────────
const api = express();
api.use(express.json());

// CORS
api.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// File upload
const upload = multer({ dest: UPLOADS_DIR });

// ── Start Seed (upload file) ──────────────────
api.post("/api/start-seed", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const originalName = req.file.originalname;
    const finalPath = path.join(UPLOADS_DIR, originalName);

    // Move from multer temp to named file
    fs.renameSync(req.file.path, finalPath);

    // Create torrent metadata
    const metadata = createMetadata(finalPath);
    const torrentPath = path.join(
      TORRENTS_DIR,
      `${metadata.infoHash}.torrent.json`
    );

    // Save torrent
    fs.writeFileSync(torrentPath, JSON.stringify(metadata, null, 2));

    // Track torrent
    torrents.set(metadata.infoHash, {
      metadata,
      filePath: finalPath,
      name: originalName,
    });

    // Spawn seeder worker
    const port = getNextPort();
    const peerId = `seed_${Math.random().toString(36).slice(2)}`;

    spawnWorker({
      peerId,
      port,
      filePath: finalPath,
      isSeeder: true,
      torrentPath,
      metadataObj: metadata,
      mode: "sequential",
    });

    res.json({
      success: true,
      infoHash: metadata.infoHash,
      fileName: originalName,
      fileSize: metadata.info.length,
      totalPieces: metadata.info.pieces.length,
      peerId,
      port,
    });
  } catch (err) {
    console.error("[orchestrator] Seed error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Start Download (paste infoHash) ───────────
api.post("/api/start-download", (req, res) => {
  try {
    const { infoHash } = req.body;

    if (!infoHash) {
      return res.status(400).json({ error: "infoHash is required" });
    }

    // Find torrent
    let metadata = null;
    let torrentPath = null;

    if (torrents.has(infoHash)) {
      metadata = torrents.get(infoHash).metadata;
    } else {
      // Check filesystem
      torrentPath = path.join(TORRENTS_DIR, `${infoHash}.torrent.json`);
      if (fs.existsSync(torrentPath)) {
        metadata = JSON.parse(fs.readFileSync(torrentPath, "utf-8"));
        torrents.set(infoHash, {
          metadata,
          filePath: null,
          name: metadata.info.name,
        });
      }
    }

    if (!metadata) {
      return res.status(404).json({ error: "Torrent not found. The seeder must be on this network." });
    }

    const port = getNextPort();
    const peerId = `leech_${Math.random().toString(36).slice(2)}`;
    const downloadPath = path.join(
      DOWNLOADS_DIR,
      `${metadata.info.name}`
    );

    spawnWorker({
      peerId,
      port,
      filePath: downloadPath,
      isSeeder: false,
      torrentPath,
      metadataObj: metadata,
      mode: "sequential",
      httpPort: 8080 + (port - BASE_PEER_PORT),
    });

    res.json({
      success: true,
      peerId,
      port,
      fileName: metadata.info.name,
      fileSize: metadata.info.length,
    });
  } catch (err) {
    console.error("[orchestrator] Download error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── List Nodes ────────────────────────────────
api.get("/api/nodes", (req, res) => {
  const result = [];
  for (const [id, node] of nodes.entries()) {
    result.push({
      peerId: id,
      status: node.status,
      isSeeder: node.config.isSeeder,
      port: node.config.port,
      stats: node.stats,
    });
  }
  res.json(result);
});

// ── Get Node Stats ────────────────────────────
api.get("/api/stats/:id", (req, res) => {
  const node = nodes.get(req.params.id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  res.json(node.stats || { error: "Stats not yet available" });
});

// ── Stop Node ─────────────────────────────────
api.delete("/api/stop-node/:id", (req, res) => {
  const node = nodes.get(req.params.id);
  if (!node) return res.status(404).json({ error: "Node not found" });

  try {
    node.process.send({ type: "STOP" });
    node.status = "stopping";
    res.json({ success: true });
  } catch {
    node.process.kill();
    node.status = "stopped";
    res.json({ success: true, note: "Force killed" });
  }
});

// ── List Torrents ─────────────────────────────
api.get("/api/torrents", (req, res) => {
  const result = [];
  for (const [hash, info] of torrents.entries()) {
    // Count seeders and leechers for this torrent
    let seeders = 0;
    let leechers = 0;
    for (const node of nodes.values()) {
      if (node.stats && node.stats.fileId === hash && node.status === "running") {
        if (node.config.isSeeder || (node.stats && node.stats.isComplete)) {
          seeders++;
        } else {
          leechers++;
        }
      }
    }

    result.push({
      infoHash: hash,
      name: info.name,
      size: info.metadata.info.length,
      pieces: info.metadata.info.pieces.length,
      seeders,
      leechers,
    });
  }
  res.json(result);
});

// ── Global Stats ──────────────────────────────
api.get("/api/global-stats", (req, res) => {
  let totalDown = 0;
  let totalUp = 0;
  let activeNodes = 0;

  for (const node of nodes.values()) {
    if (node.status === "running" && node.stats) {
      totalDown += node.stats.downloaded;
      totalUp += node.stats.uploaded;
      activeNodes++;
    }
  }

  res.json({
    activeNodes,
    totalTorrents: torrents.size,
    totalDownloaded: totalDown,
    totalUploaded: totalUp,
    trackerRunning: trackerProcess && !trackerProcess.killed,
    dhtRunning: dhtProcess && !dhtProcess.killed,
    uiRunning: uiProcess && !uiProcess.killed,
  });
});

// ─── BOOT EVERYTHING ──────────────────────────
async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  ⚡ BitLite — Real BitTorrent Client");
  console.log("═══════════════════════════════════════\n");

  // 1. Start tracker
  spawnTracker();
  await sleep(1000);

  // 2. Start DHT
  spawnDHT();
  await sleep(500);

  // 3. Start API
  api.listen(API_PORT, () => {
    console.log(`[orchestrator] API server on http://localhost:${API_PORT}`);
  });

  // 4. Start UI
  spawnUI();

  // 5. Load existing torrents
  if (fs.existsSync(TORRENTS_DIR)) {
    for (const file of fs.readdirSync(TORRENTS_DIR)) {
      if (file.endsWith(".torrent.json")) {
        try {
          const meta = JSON.parse(
            fs.readFileSync(path.join(TORRENTS_DIR, file), "utf-8")
          );
          torrents.set(meta.infoHash, {
            metadata: meta,
            filePath: null,
            name: meta.info.name,
          });
        } catch {}
      }
    }
    console.log(`[orchestrator] Loaded ${torrents.size} existing torrent(s)`);
  }

  console.log("\n───────────────────────────────────────");
  console.log(`  Dashboard:  http://localhost:${UI_PORT}`);
  console.log(`  API:        http://localhost:${API_PORT}`);
  console.log(`  Tracker:    http://localhost:${TRACKER_PORT}`);
  console.log("───────────────────────────────────────\n");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[orchestrator] Shutting down...");
  for (const [id, node] of nodes.entries()) {
    try { node.process.kill(); } catch {}
  }
  try { trackerProcess?.kill(); } catch {}
  try { dhtProcess?.kill(); } catch {}
  try { uiProcess?.kill(); } catch {}
  process.exit(0);
});

main();
