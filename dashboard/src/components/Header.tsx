"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

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
  return [{ label: "ZeroShift" }];
}

export function Header() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);

  return (
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
        <span className="text-xs text-zinc-600">
          {PAGE_TITLES[pathname] ?? "ZeroShift"}
        </span>
      </div>
    </header>
  );
}
