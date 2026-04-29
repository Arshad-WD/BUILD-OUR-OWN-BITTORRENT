"use client";

interface StatsCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "violet";
  delay?: number;
}

export default function StatsCard({
  icon,
  label,
  value,
  sub,
  color,
  delay = 0,
}: StatsCardProps) {
  return (
    <div
      className={`glass-card stat-card ${color} animate-in animate-delay-${delay}`}
    >
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
