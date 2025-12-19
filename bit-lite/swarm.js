const Peer = require("./peer/peer");
const { createMetadata } = require("./shared/metadata");
const fs = require("fs");

async function start() {
  const isSeeder = process.argv.includes("--seed");

  const basePort = 5001;
  const port = isSeeder
    ? basePort
    : basePort + Math.floor(Math.random() * 1000) + 1;

  let metadata;

  // Seeder creates torrent ONCE
  if (isSeeder) {
    metadata = createMetadata("./text-file/sample.txt");

    fs.writeFileSync(
      "./sample.torrent.json",
      JSON.stringify(metadata, null, 2)
    );

    console.log("Torrent file created");
  } else {
    // Leecher reads torrent
    metadata = JSON.parse(
      fs.readFileSync("./sample.torrent.json", "utf-8")
    );

    console.log("Torrent file loaded");
  }

  const peer = new Peer({
    peerId: Math.random().toString(36).slice(2),
    port,
    filePath: isSeeder
      ? "./text-file/sample.txt"
      : `./downloads/sample-${port}.txt`,
    isSeeder,
    metadata,
  });

  peer.startServer();
  await peer.announce();

  if (!isSeeder) {
    const peers = await peer.getPeers();
    const validPeers = peers.filter(p => p.port !== peer.port);
    const MAX_CONNECTIONS =3;
    for (const p of validPeers.slice(0, MAX_CONNECTIONS)) {
      peer.connectToPeer(p);
    }
  }
}

start();
