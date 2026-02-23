"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",             label: "Overview",    symbol: "◈" },
  { href: "/deployments",  label: "Deployments", symbol: "⟳" },
  { href: "/server",       label: "Server",      symbol: "▣" },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-[220px] shrink-0 h-screen flex flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center">
            <span className="text-zinc-900 text-xs font-black">Z</span>
          </div>
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">VersionGate</span>
          <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded ml-auto">
            Engine
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, symbol }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive(href)
                ? "bg-zinc-800 text-zinc-100 font-medium"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            <span className="text-base leading-none w-4 text-center select-none">{symbol}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <p className="text-[10px] text-emerald-500 font-medium">Engine online</p>
        </div>
        <p className="text-[10px] text-zinc-700">Zero-downtime deployments</p>
      </div>
    </aside>
  );
}
