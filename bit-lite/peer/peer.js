const net = require("net");
const axios = require("axios");
const crypto = require("crypto");

const { MESSAGE_TYPES, encode, decodeStream } = require("./protocol");
const Storage = require("./storage");
const PieceManager = require("./pieceManager");
const DHT = require("./dht");

// UTILS 
function verifyPiece(buffer, expectedHash) {
  return (
    crypto.createHash("sha1").update(buffer).digest("hex") === expectedHash
  );
}

// PEER

class Peer {
  constructor({ peerId, port, filePath, isSeeder, metadata, mode }) {
    this.peerId = peerId;
    this.port = port;
    this.host = "127.0.0.1";
    this.fileId = metadata.infoHash;
    this.metadata = metadata;
    this.isSeeder = isSeeder;

    // STORAGE
    this.storage = new Storage(filePath);

    this.expectedHashes = null;
    this.totalLength = null;
    this.pieceManager = null;

    //DOWNLOAD STATE 
    this.MAX_INFLIGHT = 4;
    this.REQUEST_TIMEOUT = 5000;

    this.inFlight = new Map();       // socket -> Map(piece -> timestamp)
    this.peerBitfields = new Map();  // socket -> bitfield[]
    this.chokedByPeer = new Set();   // socket

    // UPLOAD STATE 
    this.uploadPeers = new Set();    // sockets connected to us
    this.unchokedPeers = new Set();
    this.MAX_UPLOAD_SLOTS = 4;

    // STATS
    this.peerStats = new Map(); // socket -> { downloaded, uploaded, lastActive }

    // END GAME
    this.ENDGAME_THRESHOLD = Math.max(2, this.MAX_INFLIGHT);
    this.endGame = false;
    this.pendingEndgame = new Map(); // piece -> Set(sockets)

    // STREAMING 
    this.streaming = true;
    this.STREAM_PIECES = 8;
    this.streamReady = false;

    // DHT
    this.dht = new DHT([{ host: "127.0.0.1", port: 6881 }]);

    // INIT 
    this.mode = mode || "rarest";

    if (isSeeder) {
      const { length, pieceLength, pieces } = metadata.info;
      const totalPieces = Math.ceil(length / pieceLength);

      this.expectedHashes = pieces;
      this.totalLength = length;
      this.pieceManager = new PieceManager(totalPieces, true);
      this.pieceManager.setMode(this.mode);
    }

    setInterval(() => this.checkTimeouts(), 1000);
    setInterval(() => this.recalculateUnchoke(), 10000);
    setInterval(() => this.printStats(), 2000);
  }

  // TRACKER + DHT 
  async announce() {
    try {
      await axios.post("http://localhost:3000/announce", {
        fileId: this.fileId,
        peerId: this.peerId,
        host: this.host,
        port: this.port,
      });
    } catch {
      /* tracker offline is OK */
    }

    await this.dht.announce(this.fileId, {
      host: this.host,
      port: this.port,
    });
  }

  async getPeers() {
    let trackerPeers = [];
    try {
      const res = await axios.get("http://localhost:3000/peers", {
        params: { fileId: this.fileId, peerId: this.peerId },
      });
      trackerPeers = res.data;
    } catch {}

    const dhtPeers = await this.dht.findPeers(this.fileId);

    const uniq = new Map();
    for (const p of [...trackerPeers, ...dhtPeers]) {
      if (!p || p.port === this.port) continue;
      uniq.set(`${p.host}:${p.port}`, p);
    }

    return [...uniq.values()];
  }

  // SERVER 
  startServer() {
    const server = net.createServer(socket => {
      this.uploadPeers.add(socket);

      socket.on("error", () => {});
      socket.on("close", () => this.cleanupSocket(socket));

      decodeStream(socket, msg => {
        if (msg.type === MESSAGE_TYPES.HANDSHAKE && this.metadata) {
          socket.write(encode({ type: MESSAGE_TYPES.METADATA, info: this.metadata.info }));
          socket.write(
            encode({
              type: MESSAGE_TYPES.BITFIELD,
              bitfield: this.pieceManager.getBitfield(),
            })
          );

          // Immediately unchoke if upload slots available
          if (this.unchokedPeers.size < this.MAX_UPLOAD_SLOTS) {
            socket.write(encode({ type: MESSAGE_TYPES.UNCHOKE }));
            this.unchokedPeers.add(socket);
          } else {
            socket.write(encode({ type: MESSAGE_TYPES.CHOKE }));
          }
          return;
        }

        if (
          msg.type === MESSAGE_TYPES.REQUEST &&
          this.unchokedPeers.has(socket) &&
          this.pieceManager.hasPiece(msg.index)
        ) {
          const piece = this.storage.readPiece(msg.index);
          if (!piece) return;

          this.updateStats(socket, "uploaded", piece.length);

          socket.write(
            encode({
              type: MESSAGE_TYPES.PIECE,
              index: msg.index,
              data: piece.toString("base64"),
            })
          );
        }
      });
    });

    server.listen(this.port, () =>
      console.log(`Peer listening on ${this.port}`)
    );
  }

  // CLIENT 
  connectToPeer(peer) {
    const socket = net.connect(peer.port, peer.host, () => {
      socket.write(
        encode({ type: MESSAGE_TYPES.HANDSHAKE, peerId: this.peerId })
      );
    });

    socket.on("error", () => {});
    socket.on("close", () => this.cleanupSocket(socket));

    decodeStream(socket, msg => {
      if (msg.type === MESSAGE_TYPES.CHOKE) {
        this.chokedByPeer.add(socket);
        return;
      }

      if (msg.type === MESSAGE_TYPES.UNCHOKE) {
        this.chokedByPeer.delete(socket);
        this.requestMorePieces(socket);
        return;
      }

      if (msg.type === MESSAGE_TYPES.METADATA && !this.pieceManager) {
        this.initLeecher(msg.info);
        return;
      }

      if (msg.type === MESSAGE_TYPES.BITFIELD) {
        this.peerBitfields.set(socket, msg.bitfield || []);
        this.requestMorePieces(socket);
        return;
      }

      if (msg.type === MESSAGE_TYPES.HAVE) {
        if (!this.peerBitfields.has(socket)) {
          this.peerBitfields.set(socket, []);
        }
        this.peerBitfields.get(socket)[msg.index] = true;
        return;
      }

      if (msg.type === MESSAGE_TYPES.PIECE) {
        this.handlePiece(socket, msg);
      }
    });
  }

  // LEECHER INIT 
  initLeecher(info) {
    const { length, pieceLength, pieces } = info;

    this.totalLength = length;
    this.expectedHashes = pieces;

    const totalPieces = Math.ceil(length / pieceLength);
    const existing = this.storage.scanExistingPieces(
      totalPieces,
      pieceLength,
      pieces
    );

    this.pieceManager = new PieceManager(totalPieces, false, existing);

    if (this.streaming) {
      this.pieceManager.setMode("sequential");
      this.pieceManager.setStreamingWindow(0, this.STREAM_PIECES - 1);
    }

    if (!this.storage.exists()) {
      this.storage.initEmptyFile(totalPieces);
    }

    console.log(`Resuming: ${existing.filter(Boolean).length}/${totalPieces}`);
  }

  // PIECE HANDLING 
  handlePiece(socket, msg) {
    this.inFlight.get(socket)?.delete(msg.index);

    const buffer = Buffer.from(msg.data, "base64");
    if (!verifyPiece(buffer, this.expectedHashes[msg.index])) {
      return;
    }

    this.updateStats(socket, "downloaded", buffer.length);

    if (!this.pieceManager.hasPiece(msg.index)) {
      console.log(`Piece ${msg.index} verified`);
    }

    this.storage.writePiece(msg.index, buffer);
    this.pieceManager.addPiece(msg.index);

    for (const s of this.uploadPeers) {
      if (!s.destroyed) {
        s.write(encode({ type: MESSAGE_TYPES.HAVE, index: msg.index }));
      }
    }

    this.checkEndGame();

    if (this.pieceManager.isComplete()) {
      console.log("Download complete (verified)");
      this.storage.truncateToSize(this.totalLength);
      socket.end();
      return;
    }

    this.requestMorePieces(socket);
  }

  // REQUEST PIPELINE 
  requestMorePieces(socket) {
    if (this.chokedByPeer.has(socket)) return;

    if (!this.inFlight.has(socket)) {
      this.inFlight.set(socket, new Map());
    }

    const inflight = this.inFlight.get(socket);

    while (inflight.size < this.MAX_INFLIGHT) {
      let next =
        this.endGame
          ? this.pieceManager.getMissingPiece()
          : this.pieceManager.getNextPiece(this.peerBitfields);

      if (next === null || inflight.has(next)) break;

      inflight.set(next, Date.now());
      socket.write(encode({ type: MESSAGE_TYPES.REQUEST, index: next }));
    }
  }

  checkTimeouts() {
    const now = Date.now();
    for (const [socket, map] of this.inFlight.entries()) {
      for (const [idx, ts] of map.entries()) {
        if (now - ts > this.REQUEST_TIMEOUT && !socket.destroyed) {
          map.delete(idx);
          socket.write(encode({ type: MESSAGE_TYPES.REQUEST, index: idx }));
        }
      }
    }
  }

  // CHOKING 

  recalculateUnchoke() {
    const sockets = [...this.uploadPeers];
    sockets.sort(
      (a, b) =>
        (this.peerStats.get(b)?.downloaded || 0) -
        (this.peerStats.get(a)?.downloaded || 0)
    );

    const preferred = new Set(sockets.slice(0, this.MAX_UPLOAD_SLOTS - 1));

    const rest = sockets.filter(s => !preferred.has(s));
    if (rest.length) {
      preferred.add(rest[Math.floor(Math.random() * rest.length)]);
    }

    for (const s of sockets) {
      if (preferred.has(s)) {
        if (!this.unchokedPeers.has(s)) {
          s.write(encode({ type: MESSAGE_TYPES.UNCHOKE }));
          this.unchokedPeers.add(s);
        }
      } else if (this.unchokedPeers.has(s)) {
        s.write(encode({ type: MESSAGE_TYPES.CHOKE }));
        this.unchokedPeers.delete(s);
      }
    }
  }

  // HELPERS 

  updateStats(socket, field, bytes) {
    if (!this.peerStats.has(socket)) {
      this.peerStats.set(socket, {
        downloaded: 0,
        uploaded: 0,
        lastActive: Date.now(),
      });
    }
    this.peerStats.get(socket)[field] += bytes;
    this.peerStats.get(socket).lastActive = Date.now();
  }

  cleanupSocket(socket) {
    this.uploadPeers.delete(socket);
    this.unchokedPeers.delete(socket);
    this.peerBitfields.delete(socket);
    this.chokedByPeer.delete(socket);
    this.inFlight.delete(socket);
    this.peerStats.delete(socket);
  }

  checkEndGame() {
    if (this.isSeeder || !this.pieceManager) return;
    const remaining = this.pieceManager.pieces.filter(p => !p).length;
    if (!this.endGame && remaining <= this.ENDGAME_THRESHOLD) {
      this.endGame = true;
      console.log("END GAME MODE ACTIVATED");
    }
  }

  printStats() {
    if (!this.pieceManager) return;

    let downloaded = 0;
    let uploaded = 0;
    for (const s of this.peerStats.values()) {
      downloaded += s.downloaded;
      uploaded += s.uploaded;
    }

    const completed = this.pieceManager.pieces.filter(Boolean).length;

    if (!this.isSeeder) console.clear();
    console.log("───────── SWARM STATS ─────────");
    console.log(`Peers connected      : ${this.uploadPeers.size}`);
    console.log(`Downloaded           : ${downloaded} bytes`);
    console.log(`Uploaded             : ${uploaded} bytes`);
    console.log(`Pieces               : ${completed} / ${this.pieceManager.pieces.length}`);
    console.log(`End game mode        : ${this.endGame ? "ON" : "OFF"}`);
    console.log("──────────────────────────────");
  }
}

module.exports = Peer;
