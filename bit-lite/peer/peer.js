const net = require("net");
const axios = require("axios");
const { getFileId } = require("../shared/utils");
const { MESSAGE_TYPES, encode, decode } = require("./protocol");

const Storage = require("./storage");
const PieceManager = require("./pieceManager");

class Peer {
  constructor({ peerId, port, filePath, isSeeder }) {
    this.peerId = peerId;
    this.port = port;
    this.host = "127.0.0.1";
    this.filePath = filePath;
    this.isSeeder = isSeeder;

    // Torrent identity
    this.fileId = getFileId(filePath);

    // Disk
    this.storage = new Storage(filePath, isSeeder);

    // Pieces
    const totalPieces = this.storage.getTotalPieces();
    this.pieceManager = new PieceManager(totalPieces, isSeeder);
  }

  async announce() {
    await axios.post("http://localhost:3000/announce", {
      fileId: this.fileId,
      peerId: this.peerId,
      host: this.host,
      port: this.port,
    });

    console.log("📡 Announced to tracker");
  }

  async getPeers() {
    const res = await axios.get("http://localhost:3000/peers", {
      params: {
        fileId: this.fileId,
        peerId: this.peerId,
      },
    });

    return res.data;
  }

  startServer() {
    const server = net.createServer(socket => {
      socket.on("data", data => {
        const msg = decode(data);
        console.log("Received:", msg);
      });
    });

    server.listen(this.port, () => {
      console.log(`Peer listening on ${this.port}`);
    });
  }
}

module.exports = Peer;
