# ⚡ BitLite — Real BitTorrent Client

A fully functional peer-to-peer file sharing system built from scratch in Node.js, with a real-time Next.js dashboard. **One command to start everything.**

## Quick Start

```bash
npm install
cd ui && npm install && cd ..
npm start
```

Then open **http://localhost:3001** — upload a file, get an infoHash, share it.

## Architecture

```
npm start
  └─ orchestrator.js
       ├── Tracker           (port 3000) — Peer discovery
       ├── DHT Node          (UDP 6881) — Decentralized discovery
       ├── Management API    (port 4000) — Controls everything
       ├── Next.js Dashboard (port 3001) — UI
       └── Worker Peers      (dynamic)  — Seeder/Leecher instances
```

## How It Works

1. **Upload & Seed** — Drag a file into the dashboard → torrent created → infoHash displayed
2. **Share** — Copy the infoHash and send it to anyone
3. **Download** — Paste infoHash in the dashboard → leecher spawns → pieces download
4. **True P2P** — Leechers serve verified pieces to other leechers (not just seeders)

## Features

- **Single command startup** — `npm start` boots tracker, DHT, API, and UI
- **File upload via UI** — Drag-and-drop, auto torrent creation
- **Dynamic peer spawning** — Start/stop seeders and leechers from the dashboard
- **True peer behavior** — Leechers upload pieces they've downloaded
- **SHA-1 piece verification** — Every piece hashed and verified
- **Piece selection** — Rarest-first and sequential modes
- **Choking / Unchoking** — Fair bandwidth allocation
- **End Game Mode** — Aggressive fetching near completion
- **Resume support** — Scans existing pieces on restart
- **Real-time dashboard** — Live stats, node management, torrent tracking
- **Premium dark theme** — Glassmorphism, mesh gradients, glow effects

## Project Structure

```
bit-lite/
├── orchestrator.js       # Master process — boots everything
├── worker.js             # Standalone peer process (IPC)
├── tracker/server.js     # HTTP tracker (port 3000)
├── peer/
│   ├── peer.js           # Core peer logic
│   ├── pieceManager.js   # Piece selection strategies
│   ├── protocol.js       # Wire protocol (TCP)
│   ├── storage.js        # Disk I/O
│   ├── dht.js            # DHT client
│   └── dhtNode.js        # DHT bootstrap node
├── shared/
│   ├── constants.js      # Config
│   └── metadata.js       # Torrent creator
├── ui/                   # Next.js dashboard
│   └── src/
│       ├── app/page.tsx   # Main dashboard
│       ├── components/    # Upload, Download, NodeList, etc.
│       └── lib/api.ts     # API client
├── uploads/              # Seeded files
├── downloads/            # Downloaded files
└── torrents/             # Torrent metadata
```

## API Reference

**Management API (port 4000):**

| Endpoint             | Method | Description             |
|----------------------|--------|-------------------------|
| `/api/start-seed`    | POST   | Upload file → start seeding |
| `/api/start-download`| POST   | InfoHash → start downloading |
| `/api/nodes`         | GET    | List active peers       |
| `/api/stop-node/:id` | DELETE | Stop a peer             |
| `/api/torrents`      | GET    | List all torrents       |
| `/api/global-stats`  | GET    | Aggregate statistics    |
