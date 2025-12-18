const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const torrents = new Map();

app.post("/announce", (req, res) => {
    const { fileId, peerId, host, port } = req.body;

    if (!fileId || !peerId || !host || !port) {
        return res.status(400).json({ error: "Invalid announce" });
    }

    if (!torrents.has(fileId)) {
        torrents.set(fileId, new Map());
    }

    torrents.get(fileId).set(peerId, { host, port });

    console.log(`Peer ${peerId} announced for ${fileId}`);
    res.json({ status: "ok" });
});

app.get("/peers", (req, res) => {
    const { fileId, peerId } = req.query;

    if (!fileId || !torrents.has(fileId)) {
        return res.json([]);
    }

    const peers = [...torrents.get(fileId).entries()]
        .filter(([id]) => id !== peerId)
        .map(([_, info]) => info);

    res.json(peers);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Tracker running on http://localhost:${PORT}`);
});
