import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VersionGate Engine",
  description: "Zero-downtime deployment engine",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
