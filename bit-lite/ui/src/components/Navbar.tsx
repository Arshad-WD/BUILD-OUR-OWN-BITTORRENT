"use client";

interface NavbarProps {
  isOnline: boolean;
  trackerOnline: boolean;
}

export default function Navbar({ isOnline, trackerOnline }: NavbarProps) {
  return (
    <nav className="navbar animate-in">
      <div className="navbar-brand">
        <div className="navbar-logo">⚡</div>
        <div>
          <div className="navbar-title">BitLite</div>
          <div className="navbar-subtitle">BitTorrent Dashboard</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "20px" }}>
        <div className="navbar-status">
          <span className={`status-dot ${isOnline ? "" : "offline"}`} />
          Peer: {isOnline ? "Online" : "Offline"}
        </div>
        <div className="navbar-status">
          <span className={`status-dot ${trackerOnline ? "" : "offline"}`} />
          Tracker: {trackerOnline ? "Online" : "Offline"}
        </div>
      </div>
    </nav>
  );
}
