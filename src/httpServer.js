const http = require("http");
const fs = require("fs");
const path = require("path");

function startHttpServer(basePath, port = 8080) {
  const server = http.createServer((req, res) => {
    if (!req.url.startsWith("/stream")) {
      res.writeHead(404);
      return res.end("Not found");
    }

    const url = new URL(req.url, "http://localhost");
    const file = url.searchParams.get("file");

    if (!file) {
      res.writeHead(400);
      return res.end("Missing ?file=");
    }

    const filePath = path.join(basePath, file);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end("File not found");
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (!range) {
      res.writeHead(200, {
        "Content-Length": stat.size,
        "Content-Type": "application/octet-stream",
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // ---- RANGE REQUEST ----
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : stat.size - 1;

    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "application/octet-stream",
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  });

  server.listen(port, () => {
    console.log(`📺 HTTP streaming server on http://localhost:${port}`);
  });
}

module.exports = startHttpServer;
