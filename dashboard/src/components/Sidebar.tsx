"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Rocket, Server, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const NAV = [
  { href: "/",            label: "Overview",    icon: LayoutDashboard },
  { href: "/deployments", label: "Deployments", icon: Rocket },
  { href: "/server",      label: "Server",      icon: Server },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-[220px] shrink-0 h-screen flex flex-col border-r border-border bg-background">
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-foreground tracking-tight">VersionGate</span>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isActive(href)
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
          </span>
          <p className="text-[10px] text-indigo-400 font-medium">Engine online</p>
        </div>
        <p className="text-[10px] text-muted-foreground/50">Zero-downtime deployments</p>
      </div>
    </aside>
  );
}
