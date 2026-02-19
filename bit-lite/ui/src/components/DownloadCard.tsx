"use client";
import { useState } from "react";
import { startDownload, type DownloadResult } from "../lib/api";

export default function DownloadCard({
  onDownloadStarted,
}: {
  onDownloadStarted?: (result: DownloadResult) => void;
}) {
  const [infoHash, setInfoHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleDownload() {
    if (!infoHash.trim()) return;
    setError("");
    setSuccess("");
    setLoading(true);

    const res = await startDownload(infoHash.trim());
    setLoading(false);

    if (res) {
      setSuccess(`Downloading ${res.fileName} — peer ${res.peerId.slice(0, 8)}`);
      setInfoHash("");
      onDownloadStarted?.(res);
    } else {
      setError("Failed — torrent not found or server unavailable");
    }
  }

  return (
    <div className="glass-card section-card animate-in animate-delay-2">
      <div className="section-header">
        <span className="section-title">📥 Download</span>
      </div>

      <div className="download-form">
        <div className="input-group">
          <input
            type="text"
            className="input-hash"
            placeholder="Paste infoHash here..."
            value={infoHash}
            onChange={e => setInfoHash(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleDownload()}
          />
          <button
            className="btn-primary"
            onClick={handleDownload}
            disabled={loading || !infoHash.trim()}
          >
            {loading ? "Starting..." : "⬇️ Download"}
          </button>
        </div>

        {success && <div className="success-msg">✅ {success}</div>}
        {error && <div className="error-msg">❌ {error}</div>}
      </div>
    </div>
  );
}
