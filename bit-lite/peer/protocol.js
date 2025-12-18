const MESSAGE_TYPES = {
    HANDSHAKE: "handshake",
    BITFILED: "bitfield",
    REQUEST: "request",
    PIECE: "piece",
}

function encode(message){
    return JSON.stringify(message);
}

function decode(data){
    return JSON.parse(data.toString());
}

module.exports = {
    encode, decode, MESSAGE_TYPES
};