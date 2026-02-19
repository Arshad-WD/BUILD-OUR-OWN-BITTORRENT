"use client";

interface PieceGridProps {
  bitfield: boolean[];
  totalPieces: number;
}

export default function PieceGrid({ bitfield, totalPieces }: PieceGridProps) {
  if (totalPieces === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🧩</div>
        <div className="empty-text">No piece data available</div>
        <div className="empty-sub">Start a peer with --api flag to see pieces</div>
      </div>
    );
  }

  return (
    <div>
      <div className="piece-grid-container">
        {Array.from({ length: totalPieces }).map((_, i) => (
          <div
            key={i}
            className={`piece-cell ${bitfield[i] ? "completed" : ""}`}
            title={`Piece ${i} — ${bitfield[i] ? "Downloaded" : "Missing"}`}
          />
        ))}
      </div>
      <div className="piece-legend">
        <div className="piece-legend-item">
          <div
            className="piece-legend-dot"
            style={{ background: "var(--accent-emerald)" }}
          />
          Downloaded
        </div>
        <div className="piece-legend-item">
          <div
            className="piece-legend-dot"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
          Missing
        </div>
      </div>
    </div>
  );
}
