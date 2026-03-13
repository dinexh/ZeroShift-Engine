"use client";
import { useState, useEffect, useRef } from "react";
import { api, type CreateProjectInput } from "@/lib/api";
import toast from "react-hot-toast";
import { GitBranch, Loader2, Plus, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

async function fetchRepoDirs(owner: string, repo: string, branch: string): Promise<string[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    if (!res.ok) return [];
    const data = (await res.json()) as { tree: { path: string; type: string }[] };
    return [".", ...data.tree.filter(item => item.type === "tree").map(item => item.path)];
  } catch { return []; }
}

interface Props { open: boolean; onClose: () => void; onCreated: () => void; }
interface EnvRow { key: string; value: string; }

const HEALTH_PATH_OPTIONS = [
  { value: "/health", label: "Standard — /health" },
  { value: "/healthz", label: "Kubernetes — /healthz" },
  { value: "/api/health", label: "API prefix — /api/health" },
  { value: "/status", label: "Status — /status" },
  { value: "/ping", label: "Ping — /ping" },
  { value: "/ready", label: "Readiness — /ready" },
  { value: "/", label: "Root — /" },
];

const DEFAULTS = { name: "", repoUrl: "", branch: "main", buildContext: ".", appPort: "3000", healthPath: "/health", basePort: "3100" };

export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(DEFAULTS);
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<typeof DEFAULTS>>({});
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [dirs, setDirs] = useState<string[]>([]);
  const [contextOpen, setContextOpen] = useState(false);
  const branchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const url = form.repoUrl.trim();
    const match = url.match(/github\.com\/([^/]+)\/([^/.\s]+?)(?:\.git)?(?:[/?#].*)?$/);
    if (!match) { setBranches([]); setDirs([]); setBranchesLoading(false); return; }
    const [, owner, repo] = match;
    setBranchesLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`);
        if (res.ok) {
          const data = (await res.json()) as { name: string }[];
          const names = data.map(b => b.name);
          setBranches(names);
          const sel = names.includes(form.branch) ? form.branch : names.includes("main") ? "main" : names.includes("master") ? "master" : names[0] ?? form.branch;
          setForm(prev => ({ ...prev, branch: sel }));
          setDirs(await fetchRepoDirs(owner, repo, sel));
        } else { setBranches([]); setDirs([]); }
      } catch { setBranches([]); setDirs([]); }
      finally { setBranchesLoading(false); }
    }, 800);
    return () => { clearTimeout(timer); setBranchesLoading(false); };
  }, [form.repoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(field: keyof typeof DEFAULTS, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<typeof DEFAULTS> = {};
    if (!form.name.trim()) e.name = "Required";
    else if (!/^[a-z0-9-]+$/.test(form.name)) e.name = "Lowercase letters, numbers and hyphens only";
    if (!form.repoUrl.trim()) e.repoUrl = "Required";
    else if (!/^https?:\/\//i.test(form.repoUrl)) e.repoUrl = "Must be an HTTPS URL";
    if (!form.branch.trim()) e.branch = "Required";
    const ap = parseInt(form.appPort, 10);
    if (!form.appPort || isNaN(ap) || ap < 1 || ap > 65535) e.appPort = "1 – 65535";
    const bp = parseInt(form.basePort, 10);
    if (!form.basePort || isNaN(bp) || bp < 1024 || bp > 65534) e.basePort = "1024 – 65534";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const env: Record<string, string> = {};
    for (const row of envRows) if (row.key.trim()) env[row.key.trim()] = row.value;
    const payload: CreateProjectInput = {
      name: form.name.trim(), repoUrl: form.repoUrl.trim(), branch: form.branch.trim(),
      buildContext: form.buildContext.trim() || ".", appPort: parseInt(form.appPort, 10),
      healthPath: form.healthPath.trim() || "/health", basePort: parseInt(form.basePort, 10), env,
    };
    setSubmitting(true);
    try {
      await api.projects.create(payload);
      toast.success(`Project "${payload.name}" created`);
      setForm(DEFAULTS); setEnvRows([]); setErrors({}); setBranches([]); setDirs([]);
      onCreated(); onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally { setSubmitting(false); }
  }

  function handleClose() {
    if (submitting) return;
    setForm(DEFAULTS); setEnvRows([]); setErrors({}); setBranches([]); setDirs([]);
    onClose();
  }

  const filteredBranches = branches.filter(b => b.toLowerCase().includes(form.branch.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-4">
              
              {/* Name */}
              <Field label="Project name" error={errors.name} required>
                <Input
                  value={form.name} onChange={e => set("name", e.target.value)}
                  placeholder="my-app" autoFocus
                  className={cn(errors.name && "border-red-500/50 focus-visible:ring-red-500/30")}
                />
                <p className="text-xs text-muted-foreground/50 mt-1">Lowercase letters, numbers, hyphens only.</p>
              </Field>

              {/* Repo URL */}
              <Field label="Repository URL" error={errors.repoUrl} required>
                <div className="relative">
                  <Input
                    value={form.repoUrl} onChange={e => set("repoUrl", e.target.value)}
                    placeholder="https://github.com/you/repo"
                    className={cn(errors.repoUrl && "border-red-500/50 focus-visible:ring-red-500/30")}
                  />
                  {branchesLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
                  )}
                </div>
                {!branchesLoading && branches.length > 0 && (
                  <p className="text-xs text-indigo-400 mt-1">✓ {branches.length} branches loaded</p>
                )}
              </Field>

              {/* Branch */}
              <Field label="Branch" error={errors.branch} required>
                <div className="relative">
                  <Input
                    ref={branchInputRef}
                    value={form.branch}
                    onChange={e => { set("branch", e.target.value); setBranchOpen(true); }}
                    onFocus={() => setBranchOpen(branches.length > 0)}
                    onBlur={() => setTimeout(() => setBranchOpen(false), 150)}
                    placeholder="main"
                    className={cn("pr-8", errors.branch && "border-red-500/50 focus-visible:ring-red-500/30")}
                  />
                  {branches.length > 0 && (
                    <button type="button" tabIndex={-1}
                      onMouseDown={e => { e.preventDefault(); setBranchOpen(v => !v); branchInputRef.current?.focus(); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {branchOpen && filteredBranches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-2xl z-20 max-h-44 overflow-y-auto">
                      {filteredBranches.map(b => (
                        <button key={b} type="button" onMouseDown={() => { set("branch", b); setBranchOpen(false); }}
                          className={cn("w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2",
                            b === form.branch ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                          )}
                        >
                          <GitBranch className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                          {b}
                          {b === form.branch && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              {/* Build context */}
              <Field label="Build context" hint="Subdirectory w/ Dockerfile. Use . for repo root.">
                <div className="relative">
                  <Input
                    value={form.buildContext}
                    onChange={e => { set("buildContext", e.target.value); setContextOpen(true); }}
                    onFocus={() => setContextOpen(dirs.length > 0)}
                    onBlur={() => setTimeout(() => setContextOpen(false), 150)}
                    placeholder="."
                  />
                  {contextOpen && dirs.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-2xl z-20 max-h-44 overflow-y-auto">
                      {dirs.filter(d => d === "." || d.toLowerCase().includes(form.buildContext.toLowerCase().replace(/^\.\//, ""))).map(d => (
                        <button key={d} type="button" onMouseDown={() => { set("buildContext", d); setContextOpen(false); }}
                          className={cn("w-full text-left px-3 py-2 text-sm font-mono transition-colors flex items-center gap-2",
                            d === form.buildContext ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                          )}
                        >
                          <span className="text-muted-foreground/40 text-xs">{d === "." ? "📁" : "/"}</span>
                          {d}
                          {d === form.buildContext && <span className="ml-auto text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              {/* Ports */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="App port" error={errors.appPort} hint="Port inside container" required>
                  <Input type="number" value={form.appPort} onChange={e => set("appPort", e.target.value)} placeholder="3000"
                    className={cn(errors.appPort && "border-red-500/50")} />
                </Field>
                <Field label="Base port" error={errors.basePort} hint="Blue slot port (green = base+1)" required>
                  <Input type="number" value={form.basePort} onChange={e => set("basePort", e.target.value)} placeholder="3100"
                    className={cn(errors.basePort && "border-red-500/50")} />
                </Field>
              </div>

              {/* Health path */}
              <Field label="Health check path" hint="VersionGate polls this to confirm container is live.">
                <Input type="text" list="health-path-suggestions" value={form.healthPath}
                  onChange={e => set("healthPath", e.target.value)} placeholder="/health" />
                <datalist id="health-path-suggestions">
                  {HEALTH_PATH_OPTIONS.map(o => <option key={o.value} value={o.value} label={o.label} />)}
                </datalist>
              </Field>

              {/* Env vars */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Environment variables <span className="text-muted-foreground/40 font-normal">(optional)</span></Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEnvRows(p => [...p, { key: "", value: "" }])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                {envRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground/40 py-2">No env vars — click Add to inject variables.</p>
                ) : (
                  <div className="space-y-2">
                    {envRows.map((row, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input value={row.key} onChange={e => setEnvRows(p => p.map((r, idx) => idx === i ? { ...r, key: e.target.value } : r))}
                          placeholder="KEY" className="font-mono text-xs" />
                        <Input value={row.value} onChange={e => setEnvRows(p => p.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r))}
                          placeholder="value" className="font-mono text-xs" />
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-400"
                          onClick={() => setEnvRows(p => p.filter((_, idx) => idx !== i))}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t border-border px-6 py-4 shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="min-w-[120px]">
              {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</> : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, hint, required, children }: {
  label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs mb-1.5 block">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground/50 mt-1">{hint}</p>}
    </div>
  );
}
