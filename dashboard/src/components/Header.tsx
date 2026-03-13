"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <header className="h-14 shrink-0 border-b border-border flex items-center px-6 gap-4 bg-background">
        <nav className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground/40">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaletteOpen(true)}
            className="gap-2 text-muted-foreground border-border h-8 px-3 text-xs"
          >
            <Search className="w-3 h-3" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline text-[10px] text-muted-foreground/60 border border-border rounded px-1">⌘K</kbd>
          </Button>

          <span className="text-xs text-muted-foreground hidden md:inline">
            {PAGE_TITLES[pathname] ?? "VersionGate"}
          </span>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
