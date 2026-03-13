"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, LayoutDashboard, Rocket, Server, ChevronRight } from "lucide-react";
import { api, type Project } from "@/lib/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props { open: boolean; onClose: () => void; }

const QUICK_ACTIONS = [
  { id: "nav-overview",    label: "Overview",        description: "Go to dashboard overview",   href: "/",            icon: LayoutDashboard },
  { id: "nav-deployments", label: "All Deployments", description: "View all deployments table", href: "/deployments", icon: Rocket },
  { id: "nav-server",      label: "Server Metrics",  description: "Live server CPU / memory",   href: "/server",      icon: Server },
];

type ResultItem = {
  type: "project" | "action";
  id: string;
  label: string;
  description: string;
  href: string;
  avatar?: string;
};

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef(0);
  const resultsRef = useRef<ResultItem[]>([]);

  useEffect(() => {
    if (!open) { setQuery(""); setSelected(0); return; }
    setTimeout(() => inputRef.current?.focus(), 50);
    setLoading(true);
    api.projects.list().then(({ projects: p }) => setProjects(p)).catch(() => {}).finally(() => setLoading(false));
  }, [open]);

  const q = query.toLowerCase();
  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(q) || p.repoUrl.toLowerCase().includes(q));
  const filteredActions = QUICK_ACTIONS.filter(a => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
  const allResults: ResultItem[] = [
    ...filteredProjects.map(p => ({ type: "project" as const, id: p.id, label: p.name, description: p.repoUrl, href: `/projects/${p.id}`, avatar: p.name[0]?.toUpperCase() })),
    ...filteredActions.map(a => ({ type: "action" as const, id: a.id, label: a.label, description: a.description, href: a.href })),
  ];

  selectedRef.current = selected;
  resultsRef.current = allResults;

  useEffect(() => { setSelected(s => Math.min(s, Math.max(0, allResults.length - 1))); }, [allResults.length]);
  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, resultsRef.current.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      else if (e.key === "Enter") {
        const item = resultsRef.current[selectedRef.current];
        if (item) { router.push(item.href); onClose(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, router, onClose]);

  function navigate(href: string) { router.push(href); onClose(); }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="p-0 max-w-[540px] overflow-hidden gap-0 top-[25%] translate-y-0 [&>button]:hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects and pages..."
            className="flex-1 bg-transparent py-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
          {loading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
          ) : (
            <kbd className="text-xs text-muted-foreground/40 border border-border rounded px-1.5 py-0.5 shrink-0">esc</kbd>
          )}
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {!loading && allResults.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground/40">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {filteredProjects.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Projects</p>
              {filteredProjects.map((p, i) => {
                const isSelected = selected === i;
                return (
                  <button key={p.id}
                    className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    )}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <span className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                      {p.name[0]?.toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-foreground font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground/60 truncate">{p.repoUrl}</span>
                    </span>
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {filteredActions.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Navigation</p>
              {filteredActions.map((a, i) => {
                const idx = filteredProjects.length + i;
                const isSelected = selected === idx;
                const Icon = a.icon;
                return (
                  <button key={a.id}
                    className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    )}
                    onClick={() => navigate(a.href)}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <span className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm text-foreground">{a.label}</span>
                      <span className="block text-xs text-muted-foreground/60">{a.description}</span>
                    </span>
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border flex items-center gap-4 text-[11px] text-muted-foreground/40">
          <span><span className="text-muted-foreground/60">↑↓</span> navigate</span>
          <span><span className="text-muted-foreground/60">↵</span> open</span>
          <span><span className="text-muted-foreground/60">esc</span> close</span>
          <span className="ml-auto">{allResults.length} result{allResults.length !== 1 ? "s" : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
