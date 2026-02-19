"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import UploadCard from "../components/UploadCard";
import DownloadCard from "../components/DownloadCard";
import NodeList from "../components/NodeList";
import TorrentList from "../components/TorrentList";
import StatsCard from "../components/StatsCard";
import {
  fetchNodes,
  fetchTorrents,
  fetchGlobalStats,
  fetchTrackerStatus,
  formatBytes,
  type NodeInfo,
  type TorrentInfo,
  type GlobalStats,
} from "../lib/api";

export default function Dashboard() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [torrents, setTorrents] = useState<TorrentInfo[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [trackerOnline, setTrackerOnline] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);

  const refresh = useCallback(async () => {
    const [n, t, g, tr] = await Promise.all([
      fetchNodes(),
      fetchTorrents(),
      fetchGlobalStats(),
      fetchTrackerStatus(),
    ]);

    setNodes(n);
    setTorrents(t);
    setGlobalStats(g);
    setApiOnline(g !== null);
    setTrackerOnline(tr !== null);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  // Aggregate stats
  const activeNodes = nodes.filter(n => n.status === "running");
  const seeders = activeNodes.filter(n => n.isSeeder || n.stats?.isComplete);
  const leechers = activeNodes.filter(
    n => !n.isSeeder && !n.stats?.isComplete
  );
  const totalDown = globalStats?.totalDownloaded ?? 0;
  const totalUp = globalStats?.totalUploaded ?? 0;

  return (
    <div className="page-wrapper">
      <Navbar isOnline={apiOnline} trackerOnline={trackerOnline} />

      {/* ─── Hero Stats ─────────────────────────── */}
      <div className="stats-grid">
        <StatsCard
          icon="🖥️"
          label="Active Nodes"
          value={String(activeNodes.length)}
          sub={`${seeders.length} seeders, ${leechers.length} leechers`}
          color="cyan"
          delay={1}
        />
        <StatsCard
          icon="📦"
          label="Torrents"
          value={String(torrents.length)}
          sub="Tracked files"
          color="violet"
          delay={2}
        />
        <StatsCard
          icon="⬇️"
          label="Downloaded"
          value={formatBytes(totalDown)}
          color="emerald"
          delay={3}
        />
        <StatsCard
          icon="⬆️"
          label="Uploaded"
          value={formatBytes(totalUp)}
          color="amber"
          delay={4}
        />
      </div>

      {/* ─── Upload & Download ──────────────────── */}
      <div className="content-grid">
        <UploadCard onSeedStarted={() => refresh()} />
        <DownloadCard onDownloadStarted={() => refresh()} />
      </div>

      {/* ─── Active Nodes ───────────────────────── */}
      <NodeList nodes={nodes} onRefresh={refresh} />

      {/* ─── Torrent List ───────────────────────── */}
      <TorrentList torrents={torrents} />

      {/* ─── Footer ─────────────────────────────── */}
      <footer className="footer">
        BitLite — Real BitTorrent • Upload. Seed. Share. Download.
      </footer>
    </div>
  );
}
