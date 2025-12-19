const net = require("net");
const axios = require("axios");
const crypto = require("crypto");
const { MESSAGE_TYPES, encode, decode } = require("./protocol");
const Storage = require("./storage");
const PieceManager = require("./pieceManager");

function verifyPiece(buffer, expectedHash) {
  const actualHash = crypto
    .createHash("sha1")
    .update(buffer)
    .digest("hex");

  return actualHash === expectedHash;
}

class Peer {
  constructor({ peerId, port, filePath, isSeeder, metadata }) {
    this.peerId = peerId;
    this.port = port;
    this.host = "127.0.0.1";
    this.fileId = metadata.infoHash;
    this.metadata = metadata;
    this.isSeeder = isSeeder;

    this.storage = new Storage(filePath);

    this.expectedHashes = null;
    this.totalLength = null;
    this.pieceManager = null;

    // Seeder initializes immediately
    if (isSeeder) {
      const { length, pieceLength, pieces } = metadata.info;
      const totalPieces = Math.ceil(length / pieceLength);

      this.expectedHashes = pieces;
      this.totalLength = length;
      this.pieceManager = new PieceManager(totalPieces, true);
    }
  }

  async announce() {
    await axios.post("http://localhost:3000/announce", {
      fileId: this.fileId,
      peerId: this.peerId,
      host: this.host,
      port: this.port,
    });
  }

  async getPeers() {
    const res = await axios.get("http://localhost:3000/peers", {
      params: { fileId: this.fileId, peerId: this.peerId },
    });
    return res.data;
  }

  startServer() {
    const server = net.createServer(socket => {
      socket.on("error", err =>
        console.log("Socket error:", err.message)
      );

      socket.on("data", data => {
        const msg = decode(data);

        // Send metadata once
        if (msg.type === MESSAGE_TYPES.HANDSHAKE && this.metadata) {
          socket.write(
            encode({
              type: MESSAGE_TYPES.METADATA,
              info: this.metadata.info,
            })
          );
        }

        // Upload piece if we have it
        if (
          msg.type === MESSAGE_TYPES.REQUEST &&
          msg.index !== null &&
          this.pieceManager &&
          this.pieceManager.hasPiece(msg.index)
        ) {
          const piece = this.storage.readPiece(msg.index);
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

  connectToPeer(peer) {
    const socket = net.connect(peer.port, peer.host, () => {
      console.log(`Connected to peer ${peer.host}:${peer.port}`);

      socket.write(
        encode({
          type: MESSAGE_TYPES.HANDSHAKE,
          peerId: this.peerId,
        })
      );
    });

    socket.on("error", err =>
      console.log("Socket error:", err.message)
    );

    socket.on("data", data => {
      const msg = decode(data);

      // Receive metadata (ONLY ONCE)
      if (msg.type === MESSAGE_TYPES.METADATA && !this.pieceManager) {
        const { length, pieceLength, pieces } = msg.info;

        this.totalLength = length;
        this.expectedHashes = pieces;

        const totalPieces = Math.ceil(length / pieceLength);
        this.pieceManager = new PieceManager(totalPieces, false);
        this.storage.initEmptyFile(totalPieces);

        const first = this.pieceManager.getMissingPiece();
        if (first !== null) {
          socket.write(
            encode({ type: MESSAGE_TYPES.REQUEST, index: first })
          );
        }
        return;
      }

      // Receive piece
      if (msg.type === MESSAGE_TYPES.PIECE) {
        const buffer = Buffer.from(msg.data, "base64");
        const expected = this.expectedHashes[msg.index];

        if (!verifyPiece(buffer, expected)) {
          socket.write(
            encode({
              type: MESSAGE_TYPES.REQUEST,
              index: msg.index,
            })
          );
          return;
        }

        this.storage.writePiece(msg.index, buffer);
        this.pieceManager.addPiece(msg.index);

        if (this.pieceManager.isComplete()) {
          console.log("Download complete (verified)");
          this.storage.truncateToSize(this.totalLength);
          socket.end();
          return;
        }

        const next = this.pieceManager.getMissingPiece();
        if (next !== null) {
          socket.write(
            encode({ type: MESSAGE_TYPES.REQUEST, index: next })
          );
        }
      }
    });
  }
}

module.exports = Peer;
