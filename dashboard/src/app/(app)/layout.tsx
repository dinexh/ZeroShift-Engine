import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "VersionGate Engine",
  description: "Zero-downtime deployment dashboard",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
        </div>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0a0a0a",
            color: "#fafafa",
            border: "1px solid #262626",
            fontFamily: "var(--font-poppins)",
            fontSize: "13px",
          },
        }}
      />
    </div>
  );
}
