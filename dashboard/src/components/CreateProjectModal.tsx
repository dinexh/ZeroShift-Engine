"use client";
import { useState, useEffect, useRef } from "react";
import { api, type CreateProjectInput } from "@/lib/api";
import toast from "react-hot-toast";

async function fetchRepoDirs(owner: string, repo: string, branch: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { tree: { path: string; type: string }[] };
    const dirs = data.tree
      .filter((item) => item.type === "tree")
      .map((item) => item.path);
    return [".", ...dirs];
  } catch {
    return [];
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface EnvRow {
  key: string;
  value: string;
}

const HEALTH_PATH_OPTIONS = [
  { value: "/health",        label: "Standard — /health" },
  { value: "/healthz",       label: "Kubernetes style — /healthz" },
  { value: "/api/health",    label: "API prefix — /api/health" },
  { value: "/api/healthz",   label: "API prefix — /api/healthz" },
  { value: "/status",        label: "Status — /status" },
  { value: "/ping",          label: "Ping — /ping" },
  { value: "/ready",         label: "Readiness — /ready" },
  { value: "/live",          label: "Liveness — /live" },
  { value: "/",              label: "Root — /" },
];

const DEFAULTS = {
  name: "",
  repoUrl: "",
  branch: "main",
  buildContext: ".",
  appPort: "3000",
  healthPath: "/health",
  basePort: "3100",
};

export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(DEFAULTS);
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<typeof DEFAULTS>>({});

  // Branch auto-fetch state
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const branchInputRef = useRef<HTMLInputElement>(null);

  // Build context directory picker state
  const [dirs, setDirs] = useState<string[]>([]);
  const [contextOpen, setContextOpen] = useState(false);
  const contextInputRef = useRef<HTMLInputElement>(null);

  // Fetch branches + repo directory tree when repoUrl changes (debounced 800ms)
  useEffect(() => {
    const url = form.repoUrl.trim();
    const match = url.match(/github\.com\/([^/]+)\/([^/.\s]+?)(?:\.git)?(?:[\/?#].*)?$/);
    if (!match) {
      setBranches([]);
      setDirs([]);
      setBranchesLoading(false);
      return;
    }
    const [, owner, repo] = match;
    setBranchesLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`
        );
        if (res.ok) {
          const data = (await res.json()) as { name: string }[];
          const names = data.map((b) => b.name);
          setBranches(names);
          // Auto-select default branch if current value isn't in the list
          const selectedBranch = names.includes(form.branch)
            ? form.branch
            : names.includes("main")
            ? "main"
            : names.includes("master")
            ? "master"
            : names[0] ?? form.branch;
          setForm((prev) => ({ ...prev, branch: selectedBranch }));
          // Fetch directory tree for build context picker
          const repoDirs = await fetchRepoDirs(owner, repo, selectedBranch);
          setDirs(repoDirs);
        } else {
          setBranches([]);
          setDirs([]);
        }
      } catch {
        setBranches([]);
        setDirs([]);
      } finally {
        setBranchesLoading(false);
      }
    }, 800);
    return () => {
      clearTimeout(timer);
      setBranchesLoading(false);
    };
  }, [form.repoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  function set(field: keyof typeof DEFAULTS, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function addEnvRow() {
    setEnvRows((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeEnvRow(i: number) {
    setEnvRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function setEnvRow(i: number, field: "key" | "value", val: string) {
    setEnvRows((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: val } : row))
    );
  }

  function validate(): boolean {
    const e: Partial<typeof DEFAULTS> = {};
    if (!form.name.trim()) e.name = "Required";
    else if (!/^[a-z0-9-]+$/.test(form.name)) e.name = "Lowercase letters, numbers and hyphens only";
    else if (form.name.length > 64) e.name = "Max 64 characters";
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
    for (const row of envRows) {
      if (row.key.trim()) env[row.key.trim()] = row.value;
    }

    const payload: CreateProjectInput = {
      name: form.name.trim(),
      repoUrl: form.repoUrl.trim(),
      branch: form.branch.trim(),
      buildContext: form.buildContext.trim() || ".",
      appPort: parseInt(form.appPort, 10),
      healthPath: form.healthPath.trim() || "/health",
      basePort: parseInt(form.basePort, 10),
      env,
    };

    setSubmitting(true);
    try {
      await api.projects.create(payload);
      toast.success(`Project "${payload.name}" created`);
      setForm(DEFAULTS);
      setEnvRows([]);
      setErrors({});
      setBranches([]);
      setDirs([]);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setForm(DEFAULTS);
    setEnvRows([]);
    setErrors({});
    setBranches([]);
    setDirs([]);
    onClose();
  }

  // Filtered branches for dropdown
  const filteredBranches = branches.filter((b) =>
    b.toLowerCase().includes(form.branch.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-100">New Project</h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-4">

            {/* Name */}
            <Field label="Project name" error={errors.name} required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="my-app"
                className={input(errors.name)}
                autoFocus
              />
              <p className="text-xs text-zinc-600 mt-1">
                Lowercase letters, numbers, hyphens. Used as the container name prefix.
              </p>
            </Field>

            {/* Repo URL */}
            <Field label="Repository URL" error={errors.repoUrl} required>
              <div className="relative">
                <input
                  type="text"
                  value={form.repoUrl}
                  onChange={(e) => set("repoUrl", e.target.value)}
                  placeholder="https://github.com/you/repo"
                  className={input(errors.repoUrl)}
                />
                {branchesLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin block" />
                  </span>
                )}
              </div>
              {!branchesLoading && branches.length > 0 && (
                <p className="text-xs text-emerald-600 mt-1">
                  ✓ {branches.length} branches loaded
                </p>
              )}
            </Field>

            {/* Branch — combobox with auto-fetched list */}
            <Field label="Branch" error={errors.branch} required>
              <div className="relative">
                <input
                  ref={branchInputRef}
                  type="text"
                  value={form.branch}
                  onChange={(e) => {
                    set("branch", e.target.value);
                    setBranchOpen(true);
                  }}
                  onFocus={() => setBranchOpen(branches.length > 0)}
                  onBlur={() => setTimeout(() => setBranchOpen(false), 150)}
                  placeholder="main"
                  className={`${input(errors.branch)} pr-8`}
                />
                {branches.length > 0 && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setBranchOpen((v) => !v);
                      branchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 8L1 3h10L6 8z" />
                    </svg>
                  </button>
                )}

                {/* Branch dropdown */}
                {branchOpen && filteredBranches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl z-20 max-h-44 overflow-y-auto">
                    {filteredBranches.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onMouseDown={() => {
                          set("branch", b);
                          setBranchOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                          b === form.branch
                            ? "bg-zinc-700 text-zinc-100"
                            : "text-zinc-300 hover:bg-zinc-700/60"
                        }`}
                      >
                        <span className="text-zinc-500 text-xs font-mono">⎇</span>
                        {b}
                        {b === form.branch && (
                          <span className="ml-auto text-zinc-500 text-xs">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {branches.length === 0 && !branchesLoading && form.repoUrl.includes("github.com") && (
                <p className="text-xs text-zinc-600 mt-1">
                  Enter a valid public GitHub URL to load branches automatically.
                </p>
              )}
            </Field>

            {/* Build context */}
            <Field label="Build context" hint="Subdirectory containing the Dockerfile (or where one will be generated). Use . for repo root.">
              <div className="relative">
                <input
                  ref={contextInputRef}
                  type="text"
                  value={form.buildContext}
                  onChange={(e) => {
                    set("buildContext", e.target.value);
                    setContextOpen(true);
                  }}
                  onFocus={() => setContextOpen(dirs.length > 0)}
                  onBlur={() => setTimeout(() => setContextOpen(false), 150)}
                  placeholder="."
                  className={`${input(undefined)} ${dirs.length > 0 ? "pr-8" : ""}`}
                />
                {dirs.length > 0 && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setContextOpen((v) => !v);
                      contextInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 8L1 3h10L6 8z" />
                    </svg>
                  </button>
                )}
                {contextOpen && dirs.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl z-20 max-h-44 overflow-y-auto">
                    {dirs
                      .filter((d) => d === "." || d.toLowerCase().includes(form.buildContext.toLowerCase().replace(/^\.\//, "")))
                      .map((d) => (
                        <button
                          key={d}
                          type="button"
                          onMouseDown={() => {
                            set("buildContext", d);
                            setContextOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm font-mono transition-colors flex items-center gap-2 ${
                            d === form.buildContext
                              ? "bg-zinc-700 text-zinc-100"
                              : "text-zinc-300 hover:bg-zinc-700/60"
                          }`}
                        >
                          <span className="text-zinc-500 text-xs">{d === "." ? "📁" : "/"}</span>
                          {d}
                          {d === form.buildContext && (
                            <span className="ml-auto text-zinc-500 text-xs">✓</span>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </Field>

            {/* Ports row */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="App port" error={errors.appPort} hint="Port your app listens on inside the container" required>
                <input
                  type="number"
                  value={form.appPort}
                  onChange={(e) => set("appPort", e.target.value)}
                  placeholder="3000"
                  className={input(errors.appPort)}
                />
              </Field>
              <Field label="Base port" error={errors.basePort} hint="Host port for blue slot (green = base + 1)" required>
                <input
                  type="number"
                  value={form.basePort}
                  onChange={(e) => set("basePort", e.target.value)}
                  placeholder="3100"
                  className={input(errors.basePort)}
                />
              </Field>
            </div>

            {/* Health path */}
            <Field label="Health check path" error={errors.healthPath} hint="VersionGate hits this endpoint to confirm the container is live.">
              <div className="relative">
                <input
                  type="text"
                  list="health-path-suggestions"
                  value={form.healthPath}
                  onChange={(e) => set("healthPath", e.target.value)}
                  placeholder="/health"
                  className={input(errors.healthPath)}
                />
                <datalist id="health-path-suggestions">
                  {HEALTH_PATH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} label={o.label} />
                  ))}
                </datalist>
              </div>
            </Field>

            {/* Env vars */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-zinc-400">
                  Environment variables
                  <span className="text-zinc-600 font-normal ml-1">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={addEnvRow}
                  className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded px-2 py-0.5 transition-colors"
                >
                  + Add
                </button>
              </div>

              {envRows.length === 0 ? (
                <p className="text-xs text-zinc-700 py-2">
                  No env vars — click Add to inject variables into the container.
                </p>
              ) : (
                <div className="space-y-2">
                  {envRows.map((row, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(e) => setEnvRow(i, "key", e.target.value)}
                        placeholder="KEY"
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                      />
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) => setEnvRow(i, "value", e.target.value)}
                        placeholder="value"
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeEnvRow(i)}
                        className="text-zinc-600 hover:text-red-400 transition-colors text-sm px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end px-6 py-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[100px]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-900 rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function input(error?: string) {
  return `w-full bg-zinc-950 border ${
    error ? "border-red-500" : "border-zinc-700"
  } rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors`;
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}
