class PieceManager {
  constructor(totalPieces, isSeeder) {
    this.totalPieces = totalPieces;
    this.pieces = new Array(totalPieces).fill(isSeeder);
  }

  hasPiece(i){
    return this.pieces[i];
  }
  
  getMissingPiece() {
    for (let i = 0; i < this.totalPieces; i++) {
      if (!this.pieces[i]) return i;
    }
    return null;
  }

  addPiece(index) {
    this.pieces[index] = true;
  }

  isComplete() {
    return this.pieces.every(Boolean);
  }
}

module.exports = PieceManager;
