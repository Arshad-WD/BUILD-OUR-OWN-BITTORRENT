"use client";
import { useState, useRef } from "react";
import { startSeed, formatBytes, type SeedResult } from "../lib/api";

export default function UploadCard({
  onSeedStarted,
}: {
  onSeedStarted?: (result: SeedResult) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setResult(null);
    setUploading(true);
    const res = await startSeed(file);
    setUploading(false);

    if (res) {
      setResult(res);
      onSeedStarted?.(res);
    } else {
      setError("Upload failed — is the server running?");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function copyHash() {
    if (result) {
      navigator.clipboard.writeText(result.infoHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="glass-card section-card animate-in animate-delay-1">
      <div className="section-header">
        <span className="section-title">📤 Upload & Seed</span>
      </div>

      {!result ? (
        <div
          className={`drop-zone ${dragging ? "dragging" : ""} ${uploading ? "uploading" : ""}`}
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            style={{ display: "none" }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="drop-icon">{uploading ? "⏳" : "📁"}</div>
          <div className="drop-text">
            {uploading
              ? "Creating torrent & starting seeder..."
              : "Drop a file here or click to browse"}
          </div>
          <div className="drop-sub">Any file type supported</div>
        </div>
      ) : (
        <div className="seed-result">
          <div className="result-row">
            <span className="result-label">File</span>
            <span className="result-value">{result.fileName}</span>
          </div>
          <div className="result-row">
            <span className="result-label">Size</span>
            <span className="result-value">{formatBytes(result.fileSize)}</span>
          </div>
          <div className="result-row">
            <span className="result-label">Pieces</span>
            <span className="result-value">{result.totalPieces}</span>
          </div>
          <div className="hash-display">
            <span className="hash-label">InfoHash (share this):</span>
            <div className="hash-row">
              <code className="hash-code">{result.infoHash}</code>
              <button className="btn-copy" onClick={copyHash}>
                {copied ? "✅" : "📋"}
              </button>
            </div>
          </div>
          <button
            className="btn-secondary"
            onClick={() => setResult(null)}
          >
            Upload Another
          </button>
        </div>
      )}

      {error && <div className="error-msg">❌ {error}</div>}
    </div>
  );
}
