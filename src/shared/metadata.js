const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const PIECE_LENGTH = 1024 * 16; // 16 KB (good default)

function createMetadata(filePath) {
  const data = fs.readFileSync(filePath);
  const pieces = [];

  for (let i = 0; i < data.length; i += PIECE_LENGTH) {
    const chunk = data.slice(i, i + PIECE_LENGTH);
    const hash = crypto.createHash("sha1").update(chunk).digest("hex");
    pieces.push(hash);
  }

  const info = {
    name: path.basename(filePath),
    length: data.length,
    pieceLength: PIECE_LENGTH,
    pieces,
  };

  const infoHash = crypto
    .createHash("sha1")
    .update(JSON.stringify(info))
    .digest("hex");

  return {
    infoHash,
    info,
  };
}

module.exports = { createMetadata };
