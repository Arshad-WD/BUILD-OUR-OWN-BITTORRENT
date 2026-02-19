// ─── API Configuration ─────────────────────────
const API_BASE = "http://localhost:4000";
const TRACKER_BASE = "http://localhost:3000";

// ─── Types ──────────────────────────────────────

export interface NodeStats {
    peerId: string;
    port: number;
    isSeeder: boolean;
    fileId: string;
    connectedPeers: number;
    unchokedPeers: number;
    downloaded: number;
    uploaded: number;
    totalPieces: number;
    completedPieces: number;
    progress: string;
    isComplete: boolean;
    endGame: boolean;
    bitfield: boolean[];
    mode: string;
}

export interface NodeInfo {
    peerId: string;
    status: string;
    isSeeder: boolean;
    port: number;
    stats: NodeStats | null;
}

export interface TorrentInfo {
    infoHash: string;
    name: string;
    size: number;
    pieces: number;
    seeders: number;
    leechers: number;
}

export interface GlobalStats {
    activeNodes: number;
    totalTorrents: number;
    totalDownloaded: number;
    totalUploaded: number;
    trackerRunning: boolean;
    dhtRunning: boolean;
    uiRunning: boolean;
}

export interface SeedResult {
    success: boolean;
    infoHash: string;
    fileName: string;
    fileSize: number;
    totalPieces: number;
    peerId: string;
    port: number;
}

export interface DownloadResult {
    success: boolean;
    peerId: string;
    port: number;
    fileName: string;
    fileSize: number;
}

// ─── Safe Fetch ─────────────────────────────────

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch {
        return fallback;
    }
}

// ─── Management API ─────────────────────────────

export async function startSeed(file: File): Promise<SeedResult | null> {
    try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${API_BASE}/api/start-seed`, {
            method: "POST",
            body: form,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch {
        return null;
    }
}

export async function startDownload(
    infoHash: string
): Promise<DownloadResult | null> {
    try {
        const res = await fetch(`${API_BASE}/api/start-download`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ infoHash }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
    } catch (err) {
        console.error("Download start failed:", err);
        return null;
    }
}

export async function fetchNodes(): Promise<NodeInfo[]> {
    return safeFetch<NodeInfo[]>(`${API_BASE}/api/nodes`, []);
}

export async function fetchTorrents(): Promise<TorrentInfo[]> {
    return safeFetch<TorrentInfo[]>(`${API_BASE}/api/torrents`, []);
}

export async function fetchGlobalStats(): Promise<GlobalStats | null> {
    return safeFetch<GlobalStats | null>(`${API_BASE}/api/global-stats`, null);
}

export async function stopNode(peerId: string): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/api/stop-node/${peerId}`, {
            method: "DELETE",
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ─── Tracker API ────────────────────────────────

export async function fetchTrackerStatus() {
    return safeFetch(`${TRACKER_BASE}/status`, null);
}

// ─── Helpers ────────────────────────────────────

export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatUptime(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function truncateId(id: string, len = 8): string {
    return id.length > len ? id.slice(0, len) + "…" : id;
}
