import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BitLite — BitTorrent Dashboard",
  description:
    "Real-time monitoring dashboard for the BitLite BitTorrent client. View swarm stats, peer connections, and piece download progress.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
