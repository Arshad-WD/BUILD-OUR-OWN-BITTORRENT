const fs = require("fs");
const { PIECE_SIZE } = require("../shared/constants");

class Storage {
  constructor(filePath) {
    this.filePath = filePath;
  }

  initEmptyFile(totalPieces) {
    fs.writeFileSync(this.filePath, Buffer.alloc(totalPieces * PIECE_SIZE));
  }

  readPiece(index) {
    const fd = fs.openSync(this.filePath, "r");
    const buffer = Buffer.alloc(PIECE_SIZE);
    const offset = index * PIECE_SIZE;

    const bytesRead = fs.readSync(
      fd,
      buffer,
      0,
      PIECE_SIZE,
      offset
    );

    fs.closeSync(fd);
      return buffer.slice(0, bytesRead);
  }
  
  scanExistingPieces(totalPieces, pieceLength, expectedHashes) {
    const completed = new Array(totalPieces).fill(false);

    if (!fs.existsSync(this.filePath)) {
      return completed;
    }

    const fd = fs.openSync(this.filePath, "r");

    for (let i = 0; i < totalPieces; i++) {
      const buffer = Buffer.alloc(pieceLength);
      const bytes = fs.readSync(fd, buffer, 0, pieceLength, i * pieceLength);

      if (bytes === 0) continue;

      const hash = require("crypto")
        .createHash("sha1")
        .update(buffer.slice(0, bytes))
        .digest("hex");

      if (hash === expectedHashes[i]) {
        completed[i] = true;
      }
    }

    fs.closeSync(fd);
    return completed;
  }



  writePiece(index, data) {
    const fd = fs.openSync(this.filePath, "r+");
    fs.writeSync(fd, data, 0, data.length, index * PIECE_SIZE);
    fs.closeSync(fd);
  }

  exists(){
    return fs.existsSync(this.filePath);
  }

  truncateToSize(size){
    fs.truncateSync(this.filePath, size);
  }
}

module.exports = Storage;
