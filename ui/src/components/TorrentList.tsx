"use client";
import { type TorrentInfo, formatBytes, truncateId } from "../lib/api";

export default function TorrentList({
  torrents,
}: {
  torrents: TorrentInfo[];
}) {
  if (torrents.length === 0) {
    return null;
  }

  return (
    <div className="glass-card section-card animate-in animate-delay-4">
      <div className="section-header">
        <span className="section-title">📦 Torrents</span>
        <span className="section-badge">{torrents.length}</span>
      </div>

      <div className="torrent-list">
        {torrents.map(t => (
          <div key={t.infoHash} className="torrent-row">
            <div className="torrent-info">
              <span className="torrent-name">{t.name}</span>
              <span className="torrent-hash">{truncateId(t.infoHash, 16)}</span>
            </div>
            <div className="torrent-meta">
              <span className="torrent-size">{formatBytes(t.size)}</span>
              <span className="torrent-pieces">{t.pieces} pcs</span>
              <span className="torrent-swarm">
                🟢 {t.seeders}S / 🔵 {t.leechers}L
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
