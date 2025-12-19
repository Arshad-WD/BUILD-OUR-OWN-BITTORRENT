const MESSAGE_TYPES = {
  HANDSHAKE: "handshake",
  METADATA: "metadata",
  REQUEST: "request",
  PIECE: "piece",
};

function encode(msg) {
  return JSON.stringify(msg);
}

function decode(data) {
  return JSON.parse(data.toString());
}

module.exports = { MESSAGE_TYPES, encode, decode };
