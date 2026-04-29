const crypto = require("crypto");

function randomNodeId() {
  return crypto.randomBytes(20).toString("hex"); // 160-bit
}

function xorDistance(a, b) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  const out = Buffer.alloc(20);

  for (let i = 0; i < 20; i++) {
    out[i] = ab[i] ^ bb[i];
  }
  return BigInt("0x" + out.toString("hex"));
}

module.exports = { randomNodeId, xorDistance };
