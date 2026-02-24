"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Step {
  step: string;
  ok: boolean;
  error?: string;
}

type Phase = "form" | "running" | "restarting" | "done" | "error";

export default function SetupPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("form");
  const [domain, setDomain] = useState("");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [fatalError, setFatalError] = useState("");
  const [countdown, setCountdown] = useState(8);

  // If already configured, send to dashboard
  useEffect(() => {
    fetch("/api/v1/setup/status")
      .then((r) => r.json())
      .then((d) => { if (d.configured) router.replace("/"); })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("running");
    setSteps([]);
    setFatalError("");

    try {
      const res = await fetch("/api/v1/setup/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, databaseUrl, geminiApiKey: geminiApiKey || undefined }),
      });
      const data = await res.json();

      if (!res.ok && res.status !== 207) {
        setFatalError(data.message ?? "Setup failed");
        setPhase("error");
        return;
      }

      setSteps(data.steps ?? []);
      if (data.ok) {
        setPhase("restarting");
        setCountdown(8);
        const interval = setInterval(() => {
          setCountdown((n) => {
            if (n <= 1) {
              clearInterval(interval);
              window.location.href = `http://${domain}`;
              return 0;
            }
            return n - 1;
          });
        }, 1000);
      } else {
        setPhase("error");
      }
    } catch (err: any) {
      setFatalError(err.message ?? "Network error");
      setPhase("error");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="2" fill="white"/>
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">VersionGate</span>
          </div>
          <h1 className="text-2xl font-bold text-white">First-Run Setup</h1>
          <p className="text-zinc-400 text-sm mt-1">Configure your deployment engine</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">

          {/* FORM */}
          {phase === "form" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Domain <span className="text-zinc-500 font-normal">(e.g. engine.example.com)</span>
                </label>
                <input
                  type="text"
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="engine.example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Database URL <span className="text-zinc-500 font-normal">(PostgreSQL)</span>
                </label>
                <input
                  type="text"
                  required
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  placeholder="postgresql://user:pass@host:5432/db"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Gemini API Key <span className="text-zinc-500 font-normal">(optional — enables AI features)</span>
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors mt-2"
              >
                Apply & Start Engine
              </button>
            </form>
          )}

          {/* RUNNING */}
          {phase === "running" && (
            <div className="py-4 text-center space-y-4">
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-zinc-300 text-sm">Applying configuration…</p>
            </div>
          )}

          {/* RESTARTING */}
          {phase === "restarting" && (
            <div className="space-y-5">
              <ul className="space-y-2">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-500/20 text-emerald-400">✓</span>
                    <span className="text-sm font-medium text-zinc-200">{s.step}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-3 border-t border-zinc-800 text-center space-y-3">
                <div className="flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-zinc-300 text-sm">Engine restarting…</p>
                <p className="text-zinc-500 text-xs">
                  Redirecting to <span className="text-zinc-300 font-mono">http://{domain}</span> in {countdown}s
                </p>
                <button
                  onClick={() => { window.location.href = `http://${domain}`; }}
                  className="text-indigo-400 hover:text-indigo-300 text-xs underline"
                >
                  Go now
                </button>
              </div>
            </div>
          )}

          {/* DONE or ERROR (shows steps) */}
          {(phase === "done" || (phase === "error" && steps.length > 0)) && (
            <div className="space-y-4">
              <ul className="space-y-2">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${s.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {s.ok ? "✓" : "✕"}
                    </span>
                    <div>
                      <span className={`text-sm font-medium ${s.ok ? "text-zinc-200" : "text-zinc-300"}`}>{s.step}</span>
                      {s.error && <p className="text-xs text-red-400 mt-0.5">{s.error}</p>}
                    </div>
                  </li>
                ))}
              </ul>

              {phase === "done" ? (
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-emerald-400 text-sm font-medium mb-3">Setup complete! Redirecting…</p>
                  <a
                    href={`http://${domain}`}
                    className="block w-full text-center bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                  >
                    Open {domain} →
                  </a>
                </div>
              ) : (
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-red-400 text-sm mb-3">Some steps failed. Check errors above and try again.</p>
                  <button
                    onClick={() => setPhase("form")}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                  >
                    Back to form
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FATAL ERROR (no steps) */}
          {phase === "error" && steps.length === 0 && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400 text-sm font-medium">Setup failed</p>
                <p className="text-red-300 text-xs mt-1">{fatalError}</p>
              </div>
              <button
                onClick={() => setPhase("form")}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-zinc-600 text-xs mt-6">
          VersionGate Engine · first-run wizard
        </p>
      </div>
    </div>
  );
}
