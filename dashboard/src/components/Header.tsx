"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { CommandPalette } from "./CommandPalette";

const PAGE_TITLES: Record<string, string> = {
  "/":            "Overview",
  "/deployments": "Deployments",
  "/server":      "Server",
};

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/") return [{ label: "Overview" }];
  if (pathname === "/deployments") return [{ label: "Deployments" }];
  if (pathname === "/server") return [{ label: "Server" }];
  if (pathname.startsWith("/projects/")) {
    return [
      { label: "Overview", href: "/" },
      { label: "Project" },
    ];
  }
  return [{ label: "VersionGate" }];
}

export function Header() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="h-14 shrink-0 border-b border-zinc-800 flex items-center px-6 gap-4 bg-zinc-950">
        <nav className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-zinc-700">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-zinc-200 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Search / Command Palette trigger */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors text-xs"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3 3" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline text-[10px] text-zinc-600 border border-zinc-700 rounded px-1">⌘K</kbd>
          </button>

          <span className="text-xs text-zinc-700 hidden md:inline">
            {PAGE_TITLES[pathname] ?? "VersionGate"}
          </span>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
