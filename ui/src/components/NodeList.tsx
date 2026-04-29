"use client";
import {
  type NodeInfo,
  formatBytes,
  truncateId,
  stopNode,
} from "../lib/api";

export default function NodeList({
  nodes,
  onRefresh,
}: {
  nodes: NodeInfo[];
  onRefresh?: () => void;
}) {
  const activeNodes = nodes.filter(n => n.status === "running");

  async function handleStop(peerId: string) {
    await stopNode(peerId);
    onRefresh?.();
  }

  if (activeNodes.length === 0) {
    return (
      <div className="glass-card section-card animate-in animate-delay-3">
        <div className="section-header">
          <span className="section-title">🖥️ Active Nodes</span>
          <span className="section-badge">0</span>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🖥️</div>
          <div className="empty-text">No active nodes</div>
          <div className="empty-sub">
            Upload a file to seed or paste an infoHash to download
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card section-card animate-in animate-delay-3">
      <div className="section-header">
        <span className="section-title">🖥️ Active Nodes</span>
        <span className="section-badge">{activeNodes.length}</span>
      </div>

      <div className="node-list">
        {activeNodes.map(node => {
          const s = node.stats;
          const progress = s ? parseFloat(s.progress) : 0;
          const role = node.isSeeder || (s && s.isComplete) ? "Seeder" : "Leecher";
          const roleClass = role === "Seeder" ? "role-seeder" : "role-leecher";

          return (
            <div key={node.peerId} className="node-card">
              <div className="node-header">
                <div className="node-identity">
                  <span className={`role-badge ${roleClass}`}>{role}</span>
                  <span className="node-id">{truncateId(node.peerId)}</span>
                  <span className="node-port">:{node.port}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {s && s.isComplete && !node.isSeeder && s.fileId && (
                    <a
                      className="btn-save"
                      href={`http://localhost:4000/api/download-file/${s.fileId}`}
                      title="Save to device"
                    >
                      💾
                    </a>
                  )}
                  <button
                    className="btn-stop"
                    onClick={() => handleStop(node.peerId)}
                    title="Stop node"
                  >
                    ⏹
                  </button>
                </div>
              </div>

              {s && (
                <>
                  <div className="node-progress-bar">
                    <div
                      className="node-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="node-stats-row">
                    <span>
                      {s.completedPieces}/{s.totalPieces} pieces ({s.progress}%)
                    </span>
                    <span>
                      ⬇ {formatBytes(s.downloaded)} ⬆ {formatBytes(s.uploaded)}
                    </span>
                  </div>
                  <div className="node-stats-row">
                    <span>
                      🔗 {s.connectedPeers} peers ({s.unchokedPeers} unchoked)
                    </span>
                    <span>
                      {s.endGame ? "🔥 End Game" : s.mode}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
