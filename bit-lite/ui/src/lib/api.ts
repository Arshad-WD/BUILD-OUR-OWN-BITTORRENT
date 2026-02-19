const PEER_API = "http://localhost:4000";
const TRACKER_API = "http://localhost:3000";

export interface PeerStats {
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

export interface ConnectedPeer {
    remote: string;
    downloaded: number;
    uploaded: number;
    lastActive: number;
    isChoked: boolean;
    isConnected: boolean;
}

export interface TorrentInfo {
    infoHash: string;
    info: {
        name: string;
        length: number;
        pieceLength: number;
        pieces: string[];
    };
}

export interface TrackerStatus {
    tracker: string;
    activeTorrents: number;
    torrents: Record<
        string,
        {
            peerCount: number;
            peers: { peerId: string; host: string; port: number; lastSeen: number }[];
        }
    >;
    uptime: number;
}

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return fallback;
        return (await res.json()) as T;
    } catch {
        return fallback;
    }
}

export async function fetchStats(): Promise<PeerStats | null> {
    return safeFetch<PeerStats | null>(`${PEER_API}/api/stats`, null);
}

export async function fetchPeers(): Promise<ConnectedPeer[]> {
    return safeFetch<ConnectedPeer[]>(`${PEER_API}/api/peers`, []);
}

export async function fetchMetadata(): Promise<TorrentInfo | null> {
    return safeFetch<TorrentInfo | null>(`${PEER_API}/api/metadata`, null);
}

export async function fetchTrackerStatus(): Promise<TrackerStatus | null> {
    return safeFetch<TrackerStatus | null>(`${TRACKER_API}/status`, null);
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}
