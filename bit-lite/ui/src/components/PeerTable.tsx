"use client";

import { ConnectedPeer, formatBytes } from "@/lib/api";

interface PeerTableProps {
  peers: ConnectedPeer[];
}

export default function PeerTable({ peers }: PeerTableProps) {
  if (peers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <div className="empty-text">No peers connected</div>
        <div className="empty-sub">Peers will appear when they connect to the swarm</div>
      </div>
    );
  }

  return (
    <table className="peer-table">
      <thead>
        <tr>
          <th>Address</th>
          <th>Downloaded</th>
          <th>Uploaded</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {peers.map((peer, i) => (
          <tr key={i}>
            <td>{peer.remote}</td>
            <td>{formatBytes(peer.downloaded)}</td>
            <td>{formatBytes(peer.uploaded)}</td>
            <td>
              {!peer.isConnected ? (
                <span className="peer-status disconnected">
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "currentColor",
                      display: "inline-block",
                    }}
                  />
                  Disconnected
                </span>
              ) : peer.isChoked ? (
                <span className="peer-status choked">
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "currentColor",
                      display: "inline-block",
                    }}
                  />
                  Choked
                </span>
              ) : (
                <span className="peer-status connected">
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "currentColor",
                      display: "inline-block",
                    }}
                  />
                  Unchoked
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
