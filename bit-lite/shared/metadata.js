const fs = require("fs");
const crypto = require("crypto");
const { PIECE_SIZE } = require("./constants");

function createMetadata(filePath) {
  const data = fs.readFileSync(filePath);
  const pieces = [];

  for (let i = 0; i < data.length; i += PIECE_SIZE) {
    const piece = data.slice(i, i + PIECE_SIZE);
    const hash = crypto.createHash("sha1").update(piece).digest("hex");
    pieces.push(hash);
  }

  return {
    infoHash: crypto.createHash("sha1").update(data).digest("hex"),
    info: {
      length: data.length,
      pieceLength: PIECE_SIZE,
      pieces,
    },
  };
}

module.exports = { createMetadata };
