# ⚡ BitLite — A Simplified BitTorrent Implementation

A fully functional BitTorrent-like peer-to-peer file sharing system built from scratch in Node.js, with a real-time Next.js dashboard.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Tracker    │◄───►│   Seeder     │◄───►│   Leecher    │
│  (port 3000) │     │  (port 5001) │     │ (random port)│
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────┴───────┐
                     │  DHT Node    │
                     │  (UDP 6881)  │
                     └──────────────┘

┌──────────────┐     ┌──────────────┐
│  API Server  │◄───►│  Next.js UI  │
│  (port 4000) │     │  (port 3001) │
└──────────────┘     └──────────────┘
```

## Features

- **Centralized Tracker** — Peer discovery via HTTP announce/peers
- **DHT (Distributed Hash Table)** — Decentralized peer discovery over UDP
- **SHA-1 Piece Verification** — Every piece is hashed and verified on download
- **Piece Selection** — Rarest-first and sequential (streaming) modes
- **Choking / Unchoking** — Fair bandwidth allocation with optimistic unchoking
- **End Game Mode** — Aggressive piece fetching when download is nearly complete
- **Resume Support** — Scans existing pieces on restart, skips already-verified ones
- **Multi-peer Swarm** — Multiple leechers download simultaneously
- **File Streaming** — HTTP range-request server for streaming while downloading
- **Real-time Dashboard** — Next.js UI shows live swarm stats, piece map, and peer table

## Project Structure

```
bit-lite/
├── tracker/
│   └── server.js          # Centralized tracker (Express, port 3000)
├── peer/
│   ├── peer.js            # Core peer logic (seeder + leecher)
│   ├── pieceManager.js    # Piece selection strategies
│   ├── protocol.js        # Wire protocol (length-prefixed JSON over TCP)
│   ├── storage.js         # Disk I/O for piece read/write
│   ├── dht.js             # DHT client
│   ├── dhtNode.js         # DHT bootstrap node (UDP)
│   └── utils.js           # Crypto helpers (XOR distance, node IDs)
├── shared/
│   ├── constants.js       # Piece size config
│   └── metadata.js        # Torrent file creator (hashing, chunking)
├── torrent/
│   └── sample.torrent.json
├── text-file/
│   └── sample.txt         # Sample file to share
├── downloads/             # Downloaded files land here
├── ui/                    # Next.js dashboard (TypeScript)
│   └── src/
│       ├── app/page.tsx   # Dashboard with live stats
│       ├── components/    # Navbar, StatsCard, PieceGrid, PeerTable
│       └── lib/api.ts     # API fetch helpers
├── swarm.js               # Main entry point (start seeder/leecher)
├── httpServer.js          # HTTP streaming server
└── dht-bootstrap.js       # Standalone DHT node
```

## How to Run

> **Prerequisites:** Node.js 18+ installed

### 1. Install Dependencies

```bash
cd bit-lite
npm install

cd ui
npm install
```

### 2. Start Everything (4 terminals)

**Terminal 1 — Tracker:**
```bash
cd bit-lite
node tracker/server.js
# → Tracker running on http://localhost:3000
```

**Terminal 2 — Seeder (with API for dashboard):**
```bash
cd bit-lite
node swarm.js --seed --api
# → Peer listening on 5001
# → 📊 API server on http://localhost:4000
```

**Terminal 3 — Dashboard UI:**
```bash
cd bit-lite/ui
npm run dev
# → http://localhost:3001
```

**Terminal 4 — Leecher (to see download in action):**
```bash
cd bit-lite
node swarm.js
# → Downloads pieces from seeder, shows progress
```

Then open **http://localhost:3001** to see the live dashboard.

### Optional: DHT Bootstrap Node

```bash
node dht-bootstrap.js
# → 🌐 DHT node listening on UDP 6881
```

## Wire Protocol

Messages are length-prefixed JSON over TCP:

```
[4-byte length][JSON payload]
```

| Message     | Purpose                            |
|-------------|-------------------------------------|
| `handshake` | Identify peer                       |
| `metadata`  | Exchange torrent info               |
| `bitfield`  | Announce which pieces peer has      |
| `request`   | Ask for a specific piece            |
| `piece`     | Send piece data (base64)            |
| `have`      | Announce newly downloaded piece     |
| `choke`     | Stop uploading to peer              |
| `unchoke`   | Resume uploading to peer            |

## API Endpoints

**Tracker (port 3000):**
| Endpoint         | Method | Description               |
|------------------|--------|---------------------------|
| `/announce`      | POST   | Register peer in swarm    |
| `/peers`         | GET    | Get peers for a file      |
| `/status`        | GET    | Tracker stats for UI      |

**Peer API (port 4000, with `--api` flag):**
| Endpoint         | Method | Description               |
|------------------|--------|---------------------------|
| `/api/stats`     | GET    | Peer stats + bitfield     |
| `/api/peers`     | GET    | Connected peers           |
| `/api/metadata`  | GET    | Torrent metadata          |

## Remaining / Future Work

- Rare-piece-first selection improvements
- Parallel piece requests across peers
- Upload while downloading (true peer behavior)
- Peer timeouts & retries
- Bitfield exchange (currently uses metadata)
- Bandwidth throttling
- Peer Exchange (PEX)
- Magnet Links
