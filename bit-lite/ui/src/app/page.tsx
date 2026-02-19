"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import StatsCard from "@/components/StatsCard";
import PieceGrid from "@/components/PieceGrid";
import PeerTable from "@/components/PeerTable";
import {
  fetchStats,
  fetchPeers,
  fetchTrackerStatus,
  fetchMetadata,
  formatBytes,
  formatUptime,
  type PeerStats,
  type ConnectedPeer,
  type TrackerStatus,
  type TorrentInfo,
} from "@/lib/api";

const POLL_INTERVAL = 2000;

export default function DashboardPage() {
  const [stats, setStats] = useState<PeerStats | null>(null);
  const [peers, setPeers] = useState<ConnectedPeer[]>([]);
  const [tracker, setTracker] = useState<TrackerStatus | null>(null);
  const [metadata, setMetadata] = useState<TorrentInfo | null>(null);

  const refresh = useCallback(async () => {
    const [s, p, t, m] = await Promise.all([
      fetchStats(),
      fetchPeers(),
      fetchTrackerStatus(),
      fetchMetadata(),
    ]);
    setStats(s);
    setPeers(p);
    setTracker(t);
    setMetadata(m);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  const isOnline = stats !== null;
  const trackerOnline = tracker?.tracker === "online";
  const progress = stats ? parseFloat(stats.progress) : 0;

  return (
    <div className="page-wrapper">
      <Navbar isOnline={isOnline} trackerOnline={trackerOnline} />

      {/* ── Progress Bar ───────────────────── */}
      <div className="glass-card full-width-section animate-in animate-delay-1" style={{ padding: 24, marginBottom: 24 }}>
        <div className="progress-container" style={{ marginBottom: 0 }}>
          <div className="progress-header">
            <span className="progress-title">
              {stats?.isSeeder ? "🌱 Seeding" : stats?.isComplete ? "✅ Download Complete" : "⬇️ Downloading"}
            </span>
            <span className="progress-percent">{stats ? stats.progress : "0.0"}%</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
            <span>
              {stats ? `${stats.completedPieces} / ${stats.totalPieces} pieces` : "—"}
            </span>
            <span>
              Mode: {stats?.mode ?? "—"} {stats?.endGame ? " • END GAME" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────── */}
      <div className="stats-grid">
        <StatsCard
          icon="👤"
          label="Peer ID"
          value={stats?.peerId?.slice(0, 8) ?? "—"}
          sub={stats ? `Port ${stats.port}` : undefined}
          color="indigo"
          delay={1}
        />
        <StatsCard
          icon="🔗"
          label="Connected Peers"
          value={stats?.connectedPeers ?? 0}
          sub={`${stats?.unchokedPeers ?? 0} unchoked`}
          color="cyan"
          delay={2}
        />
        <StatsCard
          icon="⬇️"
          label="Downloaded"
          value={formatBytes(stats?.downloaded ?? 0)}
          color="emerald"
          delay={3}
        />
        <StatsCard
          icon="⬆️"
          label="Uploaded"
          value={formatBytes(stats?.uploaded ?? 0)}
          color="amber"
          delay={4}
        />
        <StatsCard
          icon="📁"
          label="Active Torrents"
          value={tracker?.activeTorrents ?? 0}
          sub={trackerOnline ? `Uptime: ${formatUptime(tracker?.uptime ?? 0)}` : "Tracker offline"}
          color="violet"
          delay={5}
        />
        <StatsCard
          icon={stats?.isSeeder ? "🌱" : "📥"}
          label="Role"
          value={stats?.isSeeder ? "Seeder" : "Leecher"}
          sub={stats?.isComplete ? "Complete" : "In progress"}
          color="rose"
          delay={6}
        />
      </div>

      {/* ── Content Grid ───────────────────── */}
      <div className="content-grid">
        {/* Piece Grid */}
        <div className="glass-card section-card animate-in animate-delay-3">
          <div className="section-header">
            <span className="section-title">🧩 Piece Map</span>
            <span className="section-badge">
              {stats ? `${stats.completedPieces}/${stats.totalPieces}` : "—"}
            </span>
          </div>
          <PieceGrid
            bitfield={stats?.bitfield ?? []}
            totalPieces={stats?.totalPieces ?? 0}
          />
        </div>

        {/* Peers Table */}
        <div className="glass-card section-card animate-in animate-delay-4">
          <div className="section-header">
            <span className="section-title">👥 Connected Peers</span>
            <span className="section-badge">{peers.length}</span>
          </div>
          <PeerTable peers={peers} />
        </div>
      </div>

      {/* ── Torrent Info ───────────────────── */}
      {metadata && metadata.info && (
        <div className="glass-card section-card full-width-section animate-in animate-delay-5">
          <div className="section-header">
            <span className="section-title">📋 Torrent Info</span>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">File Name</div>
              <div className="info-value">{metadata.info.name}</div>
            </div>
            <div className="info-item">
              <div className="info-label">File Size</div>
              <div className="info-value">{formatBytes(metadata.info.length)}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Piece Size</div>
              <div className="info-value">{formatBytes(metadata.info.pieceLength)}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Info Hash</div>
              <div className="info-value" style={{ fontSize: 11 }}>{metadata.infoHash}</div>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        BitLite — A simplified BitTorrent implementation • Built with Next.js
      </footer>
    </div>
  );
}
