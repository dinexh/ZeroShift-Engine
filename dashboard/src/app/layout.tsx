import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZeroShift Engine",
  description: "Zero-downtime deployment dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight">ZeroShift Engine</span>
            <span className="text-xs text-zinc-500 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded">
              dashboard
            </span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#18181b",
              color: "#f4f4f5",
              border: "1px solid #3f3f46",
            },
          }}
        />
      </body>
    </html>
  );
}
