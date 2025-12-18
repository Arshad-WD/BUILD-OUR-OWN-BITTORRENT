const Peer = require("./peer/peer");

async function start(){
    const isSeeder = process.argv.includes("--seed");

    const peer = new Peer({
        peerId: Math.random().toString(36).slice(2),
        port: isSeeder? 5001: 5002,
        filePath: "./test-file/sample.txt",
        isSeeder,
    });

    peer.startServer();
    await peer.announce();

    const peers = await peer.getPeers();
    console.log("Peers from tracker:", peers);
}

start();