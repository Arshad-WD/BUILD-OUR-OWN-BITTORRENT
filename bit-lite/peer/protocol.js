const MESSAGE_TYPES = {
  HANDSHAKE: "handshake",
  METADATA: "metadata",
  BITFIELD: "bitfield",
  REQUEST: "request",
  PIECE: "piece",
  CHOKE: "choke",
  UNCHOKE: "unchoke",
  CANCEL: "cancel",
  HAVE: "have"
};

function encode(message) {
  const json = Buffer.from(JSON.stringify(message));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(json.length, 0);
  return Buffer.concat([length,json]);
}

function decodeStream(socket, onMessage){
  let buffer = Buffer.alloc(0);

  socket.on("data", chunk => {
    buffer = Buffer.concat([buffer, chunk]);

    while(buffer.length >= 4){
      const msgLength = buffer.readUInt32BE(0);
      
      if(buffer.length < 4 + msgLength) break;

      const msg = buffer.slice(4, 4 + msgLength);
      buffer = buffer.slice(4 + msgLength);

      onMessage(JSON.parse(msg.toString()));
    }
  });
}

module.exports = { MESSAGE_TYPES, encode, decodeStream };
