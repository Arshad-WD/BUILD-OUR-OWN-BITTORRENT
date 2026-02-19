const dgram = require("dgram");
const { randomNodeId } = require("./utils");

class DHTNode {
  constructor(port) {
    this.port = port;
    this.nodeId = randomNodeId();

    // infoHash -> Set({host, port})
    this.store = new Map();

    this.socket = dgram.createSocket("udp4");
  }

  start() {
    this.socket.on("message", (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());

        if (data.type === "PING") {
          this.reply(rinfo, {
            type: "PONG",
            nodeId: this.nodeId,
          });
        }

        if (data.type === "ANNOUNCE") {
          const { infoHash, peer } = data;
          if (!this.store.has(infoHash)) {
            this.store.set(infoHash, new Set());
          }
          this.store.get(infoHash).add(JSON.stringify(peer));
        }

        if (data.type === "FIND_PEERS") {
          const peers = [...(this.store.get(data.infoHash) || [])]
            .map(JSON.parse);

          this.reply(rinfo, {
            type: "PEERS",
            peers,
          });
        }
      } catch {}
    });

    this.socket.bind(this.port, () => {
      console.log(`🌐 DHT node listening on UDP ${this.port}`);
    });
  }

  reply(rinfo, msg) {
    this.socket.send(
      Buffer.from(JSON.stringify(msg)),
      rinfo.port,
      rinfo.address
    );
  }
}

module.exports = DHTNode;
