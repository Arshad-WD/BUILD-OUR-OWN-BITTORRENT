const fs = require("fs");
const { PIECE_SIZE } = require("../shared/constants");

class Storage {
  constructor(filePath, isSeeder) {
    this.filePath = filePath;
    this.isSeeder = isSeeder;

    if (!isSeeder) {
      // create empty file for leecher
      fs.writeFileSync(this.filePath, "");
    }

    this.fileSize = fs.statSync(this.filePath).size;
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
    const offset = index * PIECE_SIZE;

    fs.writeSync(fd, data, 0, data.length, offset);
    fs.closeSync(fd);
  }

  getTotalPieces() {
    return Math.ceil(this.fileSize / PIECE_SIZE);
  }
}

module.exports = Storage;
