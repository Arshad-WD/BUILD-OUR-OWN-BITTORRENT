const dgram = require("dgram");

class DHT {
  constructor(bootstrapNodes) {
    this.bootstrapNodes = bootstrapNodes;
    this.socket = dgram.createSocket("udp4");
  }

  send(node, msg) {
    this.socket.send(
      Buffer.from(JSON.stringify(msg)),
      node.port,
      node.host
    );
  }

  announce(infoHash, peer) {
    for (const node of this.bootstrapNodes) {
      this.send(node, {
        type: "ANNOUNCE",
        infoHash,
        peer,
      });
    }
  }

  async findPeers(infoHash) {
    return new Promise(resolve => {
      const peers = new Set();

      // Use a named handler so we can remove it after timeout
      const handler = msg => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.type === "PEERS") {
            data.peers.forEach(p => peers.add(JSON.stringify(p)));
          }
        } catch {}
      };

      this.socket.on("message", handler);

      for (const node of this.bootstrapNodes) {
        this.send(node, {
          type: "FIND_PEERS",
          infoHash,
        });
      }

      setTimeout(() => {
        this.socket.removeListener("message", handler);
        resolve([...peers].map(JSON.parse));
      }, 1000);
    });
  }
}

module.exports = DHT;
