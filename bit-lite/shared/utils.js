const crytpo = require("crypto");
const fs = require("fs");

function getFileId(filePath){
    const stats = fs.statSync(filePath);
    const data =  `${filePath}:${stats.size}`;

    return crytpo
    .createHash("sha1")
    .update(data)
    .digest("hex");
}

module.exports = {
    getFileId,
}