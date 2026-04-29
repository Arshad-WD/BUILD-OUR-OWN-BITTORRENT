class PieceManager {
  constructor(totalPieces, isSeeder, existingBitfield = null) {
    this.totalPieces = totalPieces;
    this.pieces = existingBitfield
      ? existingBitfield
      : new Array(totalPieces).fill(isSeeder);

    this.mode = "rarest"; // default
  }

  setMode(mode) {
    if(mode === "sequential" || mode === "rarest"){
      this.mode = mode;
      console.log(`Piece Mode set to ${mode}`);
    }
  }

  hasPiece(i) {
    return this.pieces[i];
  }

  addPiece(i) {
    this.pieces[i] = true;
  }

  getMissingPiece() {
    for (let i = 0; i < this.totalPieces; i++) {
      if (!this.pieces[i]) return i;
    }
    return null;
  }

  getNextPiece(peerBitfields) {
    //STREAMING FIRST
    if (this.mode === "sequential" && this.streamEnd !== undefined) {
      for (let i = this.streamStart; i <= this.streamEnd;i++) {
        if (!this.pieces[i]) {
          return i;
        }
      }

      //fallback
      return this.getRarestPiece(peerBitfields);
    }

    // default: rarest-first
    return this.getRarestPiece(peerBitfields);
  }

  getRarestPiece(peerBitfields) {
    const counts = new Array(this.totalPieces).fill(0);

    for (const bitfield of peerBitfields.values()) {
      for (let i = 0; i < this.totalPieces; i++) {
        if (bitfield[i]) counts[i]++;
      }
    }

    let min = Infinity;
    let rarest = null;

    for (let i = 0; i < this.totalPieces; i++) {
      if (!this.pieces[i] && counts[i] > 0 && counts[i] < min) {
        min = counts[i];
        rarest = i;
      }
    }

    return rarest;
  }

  isComplete() {
    return this.pieces.every(Boolean);
  }

  setStreamingWindow(start, end){
    this.streamStart = start;
    this.streamEnd = end;
  }

}

module.exports = PieceManager;
