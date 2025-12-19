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


  writePiece(index, data) {
    const fd = fs.openSync(this.filePath, "r+");
    fs.writeSync(fd, data, 0, data.length, index * PIECE_SIZE);
    fs.closeSync(fd);
  }
  truncateToSize(size){
    fs.truncateSync(this.filePath, size);
  }
}

module.exports = Storage;
