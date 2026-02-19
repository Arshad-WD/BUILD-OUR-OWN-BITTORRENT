"use client";

interface NavbarProps {
  isOnline: boolean;
  trackerOnline: boolean;
}

export default function Navbar({ isOnline, trackerOnline }: NavbarProps) {
  return (
    <nav className="navbar animate-in">
      <div className="navbar-brand">
        <div className="navbar-logo">
          <span className="logo-icon">⚡</span>
        </div>
        <div>
          <div className="navbar-title">BitLite</div>
          <div className="navbar-subtitle">Peer-to-Peer File Sharing</div>
        </div>
      </div>
      <div className="navbar-right">
        <div className="navbar-status">
          <span className={`status-dot ${isOnline ? "" : "offline"}`} />
          <span className="status-label">API</span>
        </div>
        <div className="navbar-status">
          <span className={`status-dot ${trackerOnline ? "" : "offline"}`} />
          <span className="status-label">Tracker</span>
        </div>
      </div>
    </nav>
  );
}
