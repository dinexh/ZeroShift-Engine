"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, type Project } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

const QUICK_ACTIONS = [
  { id: "nav-overview",     label: "Overview",        description: "Go to dashboard overview",   href: "/" },
  { id: "nav-deployments",  label: "All Deployments", description: "View all deployments table", href: "/deployments" },
  { id: "nav-server",       label: "Server Metrics",  description: "Live server CPU / memory",   href: "/server" },
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

  // Keep refs to avoid stale closures in the keydown handler
  const selectedRef = useRef(0);
  const resultsRef = useRef<ResultItem[]>([]);

  // Fetch projects when the palette opens
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(0);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 10);
    setLoading(true);
    api.projects
      .list()
      .then(({ projects: p }) => setProjects(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Build filtered result list
  const q = query.toLowerCase();
  const filteredProjects = projects.filter(
    (p) => p.name.toLowerCase().includes(q) || p.repoUrl.toLowerCase().includes(q)
  );
  const filteredActions = QUICK_ACTIONS.filter(
    (a) => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
  );
  const allResults: ResultItem[] = [
    ...filteredProjects.map((p) => ({
      type: "project" as const,
      id: p.id,
      label: p.name,
      description: p.repoUrl,
      href: `/projects/${p.id}`,
      avatar: p.name[0]?.toUpperCase(),
    })),
    ...filteredActions.map((a) => ({
      type: "action" as const,
      id: a.id,
      label: a.label,
      description: a.description,
      href: a.href,
    })),
  ];

  // Keep refs in sync every render
  selectedRef.current = selected;
  resultsRef.current = allResults;

  // Clamp selected when list shrinks
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, allResults.length - 1)));
  }, [allResults.length]);

  // Reset selected on query change
  useEffect(() => {
    setSelected(0);
  }, [query]);

  // Keyboard navigation (stable handler via refs)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, resultsRef.current.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        const item = resultsRef.current[selectedRef.current];
        if (item) {
          router.push(item.href);
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, router, onClose]);

  if (!open) return null;

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[18vh] bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 border-b border-zinc-800">
          <svg className="text-zinc-500 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3 3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and pages..."
            className="flex-1 bg-transparent py-4 text-sm text-zinc-200 placeholder-zinc-600 outline-none"
          />
          {loading && (
            <span className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin shrink-0" />
          )}
          <kbd className="text-xs text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 shrink-0">esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {!loading && allResults.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-zinc-600">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {filteredProjects.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
                Projects
              </p>
              {filteredProjects.map((p, i) => {
                const idx = i;
                const isSelected = selected === idx;
                return (
                  <button
                    key={p.id}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                    }`}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <span className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                      {p.name[0]?.toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-zinc-100 font-medium">{p.name}</span>
                      <span className="block text-xs text-zinc-500 truncate">{p.repoUrl}</span>
                    </span>
                    {isSelected && (
                      <kbd className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 shrink-0">↵</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {filteredActions.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
                Navigation
              </p>
              {filteredActions.map((a, i) => {
                const idx = filteredProjects.length + i;
                const isSelected = selected === idx;
                return (
                  <button
                    key={a.id}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                    }`}
                    onClick={() => navigate(a.href)}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <span className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm text-zinc-500 shrink-0">
                      →
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm text-zinc-200">{a.label}</span>
                      <span className="block text-xs text-zinc-500">{a.description}</span>
                    </span>
                    {isSelected && (
                      <kbd className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 shrink-0">↵</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center gap-4 text-[11px] text-zinc-600">
          <span><span className="text-zinc-500">↑↓</span> navigate</span>
          <span><span className="text-zinc-500">↵</span> open</span>
          <span><span className="text-zinc-500">esc</span> close</span>
          <span className="ml-auto">{allResults.length} result{allResults.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
