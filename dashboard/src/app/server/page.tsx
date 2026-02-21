"use client";
import { useEffect, useState, useCallback } from "react";
import { api, type ServerStats, type ServerDashboard, type MonixProcess } from "@/lib/api";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function GaugeBar({ value, color }: { value: number; color: string }) {
  const width = Math.min(Math.max(value, 0), 100);
  const barColor =
    value >= 90 ? "bg-red-500" :
    value >= 70 ? "bg-amber-500" :
    color;
  return (
    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${width}%` }} />
    </div>
  );
}

interface StatSample { time: string; cpu: number; mem: number; }

export default function ServerPage() {
  const [stats, setStats]       = useState<ServerStats | null>(null);
  const [dashboard, setDashboard] = useState<ServerDashboard | null>(null);
  const [history, setHistory]   = useState<StatSample[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        api.system.serverStats(),
        api.system.serverDashboard(),
      ]);
      if (s.status === "unavailable") {
        setUnavailable(true);
        return;
      }
      setUnavailable(false);
      setStats(s);
      setDashboard(d);
      setLastUpdated(new Date());
      setHistory((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          cpu: s.cpu_percent,
          mem: s.memory_percent,
        },
      ].slice(-60));
    } catch {
      setUnavailable(true);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  if (unavailable || !stats) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm font-medium">Monix is not running</p>
          <p className="text-zinc-700 text-xs mt-2">
            Start monix to see server metrics.
          </p>
          <code className="inline-block mt-4 text-xs bg-zinc-950 border border-zinc-800 rounded px-4 py-2 text-zinc-400 font-mono">
            pip install monix-cli &amp;&amp; monix-cli --watch
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "CPU",       value: `${stats.cpu_percent.toFixed(1)}%`,        color: "bg-blue-500" },
          { label: "Memory",    value: `${stats.memory_percent.toFixed(1)}%`,     color: "bg-violet-500" },
          { label: "Disk",      value: `${stats.disk_percent.toFixed(1)}%`,       color: "bg-orange-500" },
          { label: "Uptime",    value: formatUptime(stats.uptime),                color: "bg-emerald-500" },
          { label: "Processes", value: String(stats.process_count),               color: "bg-zinc-500" },
          { label: "Load (1m)", value: stats.load_avg[0].toFixed(2),              color: "bg-zinc-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-lg font-semibold text-zinc-200">{value}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Resource gauges + charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gauges */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Resource Usage</p>

          {[
            { label: "CPU", value: stats.cpu_percent, color: "bg-blue-500" },
            { label: "Memory", value: stats.memory_percent, color: "bg-violet-500" },
            { label: "Disk", value: stats.disk_percent, color: "bg-orange-500" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-500">{label}</span>
                <span className="text-zinc-300 font-medium">{value.toFixed(1)}%</span>
              </div>
              <GaugeBar value={value} color={color} />
            </div>
          ))}

          <div className="pt-3 border-t border-zinc-800 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-zinc-600">Net Sent</span>
              <p className="text-zinc-300 font-medium mt-0.5">{formatBytes(stats.network_sent)}</p>
            </div>
            <div>
              <span className="text-zinc-600">Net Recv</span>
              <p className="text-zinc-300 font-medium mt-0.5">{formatBytes(stats.network_recv)}</p>
            </div>
            <div>
              <span className="text-zinc-600">Load avg</span>
              <p className="text-zinc-300 font-medium mt-0.5">
                {stats.load_avg.map((l) => l.toFixed(2)).join(" · ")}
              </p>
            </div>
            <div>
              <span className="text-zinc-600">Last updated</span>
              <p className="text-zinc-300 font-medium mt-0.5">{lastUpdated?.toLocaleTimeString() ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Live CPU + Memory chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
            Live History <span className="text-zinc-700 normal-case font-normal">(10s interval · {history.length}/60 samples)</span>
          </p>
          <ServerMetricsChart data={history} />
        </div>
      </div>

      {/* Connections + Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active connections */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300">Active Connections</span>
            <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
              {dashboard?.connections?.length ?? 0}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!dashboard?.connections?.length ? (
              <p className="text-xs text-zinc-700 px-5 py-8 text-center">No active connections</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {["Remote", "State", "Process"].map((h) => (
                      <th key={h} className="text-left text-zinc-600 font-medium px-5 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {dashboard.connections.slice(0, 20).map((c, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30">
                      <td className="px-5 py-2 font-mono text-zinc-400 max-w-[120px] truncate">{c.remote_address ?? "—"}</td>
                      <td className="px-5 py-2">
                        <span className={`font-medium ${c.state === "ESTABLISHED" ? "text-emerald-400" : "text-zinc-500"}`}>
                          {c.state ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-zinc-500 truncate max-w-[100px]">{c.process ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300">Security Alerts</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              (dashboard?.alerts?.length ?? 0) > 0
                ? "bg-red-500/15 text-red-400"
                : "bg-zinc-800 text-zinc-600"
            }`}>
              {dashboard?.alerts?.length ?? 0}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!dashboard?.alerts?.length ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs text-emerald-400 font-medium">All clear</p>
                <p className="text-xs text-zinc-700 mt-1">No security alerts detected</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {dashboard.alerts.map((a, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${
                        a.severity === "high" ? "text-red-400" :
                        a.severity === "medium" ? "text-amber-400" :
                        "text-zinc-400"
                      }`}>
                        {a.type ?? "Alert"}
                      </span>
                      {a.severity && (
                        <span className="text-[10px] text-zinc-700 uppercase">{a.severity}</span>
                      )}
                    </div>
                    {a.message && (
                      <p className="text-xs text-zinc-500 mt-0.5">{a.message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top processes */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-300">Top Processes</span>
        </div>
        <TopProcesses />
      </div>

      {/* Traffic summary */}
      {dashboard?.traffic_summary && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Traffic Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Requests",  value: dashboard.traffic_summary.total_requests },
              { label: "Unique IPs",      value: dashboard.traffic_summary.unique_ips },
              { label: "Total 404s",      value: dashboard.traffic_summary.total_404s },
              { label: "High Risk Hits",  value: dashboard.traffic_summary.high_risk_hits },
            ].map(({ label, value }) => (
              <div key={label} className="bg-zinc-950 rounded-lg p-3">
                <p className="text-lg font-semibold text-zinc-200">{value}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Top processes — fetches separately ─────────────────────────────────────────
function TopProcesses() {
  const [processes, setProcesses] = useState<MonixProcess[]>([]);

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch("/api/v1/system/server-dashboard");
        // processes come from monix /api/processes endpoint separately; use what we have
        const data = await res.json();
        if (data.processes) setProcesses(data.processes.slice(0, 10));
      } catch { /* ignore */ }
    }
    fetch_();
  }, []);

  if (!processes.length) {
    return <p className="text-xs text-zinc-700 px-5 py-8 text-center">Process data not available</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800">
            {["PID", "Name", "CPU %", "Memory %"].map((h) => (
              <th key={h} className="text-left text-zinc-600 font-medium px-5 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {processes.map((p) => (
            <tr key={p.pid} className="hover:bg-zinc-800/30">
              <td className="px-5 py-2.5 font-mono text-zinc-600">{p.pid}</td>
              <td className="px-5 py-2.5 text-zinc-300 font-medium">{p.name}</td>
              <td className="px-5 py-2.5 text-blue-400">{p.cpu_percent.toFixed(1)}%</td>
              <td className="px-5 py-2.5 text-violet-400">{p.memory_percent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Inline server metrics chart (no SSR) ──────────────────────────────────────
function ServerMetricsChart({ data }: { data: StatSample[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center">
        <span className="text-xs text-zinc-700">Collecting data...</span>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = require("recharts");

  const tooltipStyle = {
    contentStyle: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 11 },
    labelStyle: { color: "#a1a1aa" },
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#71717a" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "#71717a" }} tickLine={false} axisLine={false} domain={[0, 100]} />
        <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n === "cpu" ? "CPU" : "Memory"]} />
        <Legend wrapperStyle={{ fontSize: 10, color: "#71717a" }} formatter={(v: string) => v === "cpu" ? "CPU" : "Memory"} />
        <Line type="monotone" dataKey="cpu" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="mem" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}
