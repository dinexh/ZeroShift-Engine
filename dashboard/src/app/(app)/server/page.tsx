"use client";
import { useEffect, useState, useCallback } from "react";
import { api, type ServerStats, type ServerDashboard } from "@/lib/api";

// ── Formatters ─────────────────────────────────────────────────────────────────
function formatBytes(b: number): string {
  if (!b) return "0 B";
  const k = 1024, s = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
}
function formatUptime(s: number): string {
  if (!s) return "—";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── History sample ─────────────────────────────────────────────────────────────
interface Sample {
  time: string;
  cpu: number;
  mem: number;
  sentRate: number;
  recvRate: number;
}

// ── Gauge bar ─────────────────────────────────────────────────────────────────
function GaugeBar({ value, color }: { value: number; color: string }) {
  const c = value >= 90 ? "bg-red-500" : value >= 70 ? "bg-amber-500" : color;
  return (
    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1.5">
      <div className={`h-full rounded-full transition-all duration-700 ${c}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// ── Donut chart (CSS-based, no recharts needed) ────────────────────────────────
function DonutChart({ percent, color, label, sublabel }: { percent: number; color: string; label: string; sublabel: string }) {
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (Math.min(percent, 100) / 100) * circ;
  const strokeColor = percent >= 90 ? "#ef4444" : percent >= 70 ? "#f59e0b" : color;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#27272a" strokeWidth="8" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={strokeColor} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.7s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-zinc-200">{percent.toFixed(0)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-zinc-300">{label}</p>
        <p className="text-[10px] text-zinc-600">{sublabel}</p>
      </div>
    </div>
  );
}

// ── Mini stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "text-zinc-200" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-600 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-zinc-700 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Charts skeleton ─────────────────────────────────────────────────────────────
function ChartsSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-6">
      {[{ title: "CPU & Memory History", h: 160 }, { title: "Network Rate (KB/s)", h: 140 }].map(({ title, h }) => (
        <div key={title}>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">{title}</p>
          <div className={`bg-zinc-800/40 rounded-lg flex flex-col items-center justify-center gap-1.5`} style={{ height: h }}>
            <span className="text-xs text-zinc-600">{label}</span>
            {label.startsWith("Collecting") && (
              <span className="text-[10px] text-zinc-700">Chart will appear once 2+ samples are collected</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Charts (recharts, client-only) ─────────────────────────────────────────────
function Charts({ history }: { history: Sample[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <ChartsSkeleton label="Loading…" />;
  if (history.length < 2) return <ChartsSkeleton label={history.length === 0 ? "Waiting for first sample…" : "Collecting data — 1 sample so far…"} />;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RC = require("recharts");
  const tooltip = {
    contentStyle: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 11 },
    labelStyle: { color: "#a1a1aa" },
  };
  const axis = { tick: { fontSize: 10, fill: "#52525b" }, tickLine: false, axisLine: false };

  return (
    <div className="space-y-6">
      {/* CPU + Memory area chart */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">CPU & Memory History</p>
        <RC.ResponsiveContainer width="100%" height={160}>
          <RC.AreaChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gMem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <RC.CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <RC.XAxis dataKey="time" {...axis} />
            <RC.YAxis {...axis} domain={[0, 100]} />
            <RC.Tooltip {...tooltip} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n === "cpu" ? "CPU" : "Memory"]} />
            <RC.Legend wrapperStyle={{ fontSize: 10, color: "#71717a" }} formatter={(v: string) => v === "cpu" ? "CPU %" : "Memory %"} />
            <RC.Area type="monotone" dataKey="cpu" stroke="#60a5fa" strokeWidth={1.5} fill="url(#gCpu)" dot={false} isAnimationActive={false} />
            <RC.Area type="monotone" dataKey="mem" stroke="#a78bfa" strokeWidth={1.5} fill="url(#gMem)" dot={false} isAnimationActive={false} />
          </RC.AreaChart>
        </RC.ResponsiveContainer>
      </div>

      {/* Network rate area chart */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Network Rate (KB/s)</p>
        <RC.ResponsiveContainer width="100%" height={140}>
          <RC.AreaChart data={history.map(s => ({ ...s, rx: +(s.recvRate / 1024).toFixed(2), tx: +(s.sentRate / 1024).toFixed(2) }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gRx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gTx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <RC.CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <RC.XAxis dataKey="time" {...axis} />
            <RC.YAxis {...axis} />
            <RC.Tooltip {...tooltip} formatter={(v: number, n: string) => [`${v.toFixed(2)} KB/s`, n === "rx" ? "RX" : "TX"]} />
            <RC.Legend wrapperStyle={{ fontSize: 10, color: "#71717a" }} formatter={(v: string) => v === "rx" ? "RX (in)" : "TX (out)"} />
            <RC.Area type="monotone" dataKey="rx" stroke="#34d399" strokeWidth={1.5} fill="url(#gRx)" dot={false} isAnimationActive={false} />
            <RC.Area type="monotone" dataKey="tx" stroke="#f97316" strokeWidth={1.5} fill="url(#gTx)" dot={false} isAnimationActive={false} />
          </RC.AreaChart>
        </RC.ResponsiveContainer>
      </div>
    </div>
  );
}

function LoadChart({ loadAvg }: { loadAvg: [number, number, number] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RC = require("recharts");
  const data = [
    { label: "1m",  value: loadAvg[0] },
    { label: "5m",  value: loadAvg[1] },
    { label: "15m", value: loadAvg[2] },
  ];
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 1;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Load Average</p>
        <span className="text-[10px] text-zinc-700">{cores} cores</span>
      </div>
      <RC.ResponsiveContainer width="100%" height={100}>
        <RC.BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <RC.CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <RC.XAxis dataKey="label" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
          <RC.YAxis tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
          <RC.Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 11 }}
            formatter={(v: number) => [v.toFixed(2), "Load"]}
          />
          <RC.Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry, i) => {
              const ratio = entry.value / cores;
              const color = ratio >= 1 ? "#ef4444" : ratio >= 0.7 ? "#f59e0b" : "#60a5fa";
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { Cell } = require("recharts");
              return <Cell key={i} fill={color} />;
            })}
          </RC.Bar>
        </RC.BarChart>
      </RC.ResponsiveContainer>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ServerPage() {
  const [stats, setStats]         = useState<ServerStats | null>(null);
  const [dashboard, setDashboard] = useState<ServerDashboard | null>(null);
  const [history, setHistory]     = useState<Sample[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([api.system.serverStats(), api.system.serverDashboard()]);
      if (s.status === "unavailable") { setUnavailable(true); return; }
      setUnavailable(false);
      setStats(s);
      setDashboard(d);
      setLastUpdated(new Date());
      setHistory(prev => [...prev, {
        time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        cpu: s.cpu_percent,
        mem: s.memory_percent,
        sentRate: s.network_sent_rate ?? 0,
        recvRate: s.network_recv_rate ?? 0,
      }].slice(-60));
    } catch { setUnavailable(true); }
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
          <p className="text-zinc-500 text-sm font-medium">Server metrics unavailable</p>
          <p className="text-zinc-700 text-xs mt-2">Starting up — please wait a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Row 1: stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="CPU"        value={`${stats.cpu_percent.toFixed(1)}%`}        color={stats.cpu_percent >= 90 ? "text-red-400" : stats.cpu_percent >= 70 ? "text-amber-400" : "text-blue-400"} />
        <StatCard label="Memory"     value={`${stats.memory_percent.toFixed(1)}%`}     sub={`${formatBytes(stats.memory_used)} / ${formatBytes(stats.memory_total)}`} color="text-violet-400" />
        <StatCard label="Disk"       value={`${stats.disk_percent.toFixed(1)}%`}       sub={`${formatBytes(stats.disk_used)} / ${formatBytes(stats.disk_total)}`} color={stats.disk_percent >= 90 ? "text-red-400" : "text-orange-400"} />
        <StatCard label="Uptime"     value={formatUptime(stats.uptime)} />
        <StatCard label="Processes"  value={String(stats.process_count)} />
        <StatCard label="Load (1m)"  value={stats.load_avg[0].toFixed(2)} sub={`5m: ${stats.load_avg[1].toFixed(2)} · 15m: ${stats.load_avg[2].toFixed(2)}`} />
      </div>

      {/* ── Row 2: donuts + load bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Donut gauges */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-6">Resource Overview</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <DonutChart percent={stats.cpu_percent}    color="#60a5fa" label="CPU"    sublabel={`${stats.cpu_percent.toFixed(1)}% used`} />
            <DonutChart percent={stats.memory_percent} color="#a78bfa" label="Memory" sublabel={`${formatBytes(stats.memory_used)} used`} />
            <DonutChart percent={stats.disk_percent}   color="#f97316" label="Disk"   sublabel={`${formatBytes(stats.disk_used)} used`} />
          </div>
          {/* Gauge bars */}
          <div className="space-y-3 border-t border-zinc-800 pt-4">
            {[
              { label: "CPU",    value: stats.cpu_percent,    color: "bg-blue-500" },
              { label: "Memory", value: stats.memory_percent, color: "bg-violet-500" },
              { label: "Disk",   value: stats.disk_percent,   color: "bg-orange-500" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-zinc-400 font-medium">{value.toFixed(1)}%</span>
                </div>
                <GaugeBar value={value} color={color} />
              </div>
            ))}
          </div>
        </div>

        {/* Load avg + network snapshot */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
          <LoadChart loadAvg={stats.load_avg} />
          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Network (total)</p>
            {[
              { label: "Total Received", value: formatBytes(stats.network_recv), color: "text-emerald-400" },
              { label: "Total Sent",     value: formatBytes(stats.network_sent), color: "text-orange-400" },
              { label: "RX Rate",        value: `${formatBytes(stats.network_recv_rate)}/s`, color: "text-emerald-300" },
              { label: "TX Rate",        value: `${formatBytes(stats.network_sent_rate)}/s`, color: "text-orange-300" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-zinc-600">{label}</span>
                <span className={`font-medium font-mono ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: history charts ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Live History</p>
          <div className="flex items-center gap-3 text-[10px] text-zinc-600">
            <span>{history.length}/60 samples</span>
            <span>·</span>
            <span>10s interval</span>
            {lastUpdated && <><span>·</span><span>Updated {lastUpdated.toLocaleTimeString()}</span></>}
          </div>
        </div>
        <Charts history={history} />
      </div>

      {/* ── Row 4: connections + alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300">Active Connections</span>
            <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">{dashboard?.connections?.length ?? 0}</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!dashboard?.connections?.length ? (
              <p className="text-xs text-zinc-700 px-5 py-8 text-center">No active connections</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-zinc-800">
                  {["Remote", "Local", "State"].map(h => <th key={h} className="text-left text-zinc-600 font-medium px-5 py-2">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {dashboard.connections.slice(0, 25).map((c, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30">
                      <td className="px-5 py-2 font-mono text-zinc-400 truncate max-w-[120px]">{c.remote_address ?? "—"}</td>
                      <td className="px-5 py-2 font-mono text-zinc-600 truncate max-w-[100px]">{c.local_address ?? "—"}</td>
                      <td className="px-5 py-2 text-emerald-400 font-medium">{c.state ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300">System Alerts</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${(dashboard?.alerts?.length ?? 0) > 0 ? "bg-red-500/15 text-red-400" : "bg-zinc-800 text-zinc-600"}`}>
              {dashboard?.alerts?.length ?? 0}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!dashboard?.alerts?.length ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs text-emerald-400 font-medium">All systems normal</p>
                <p className="text-[10px] text-zinc-700 mt-1">No alerts detected</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {dashboard.alerts.map((a, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <span className={`text-xs mt-0.5 ${a.severity === "high" ? "text-red-400" : a.severity === "medium" ? "text-amber-400" : "text-zinc-400"}`}>●</span>
                    <div>
                      <p className="text-xs font-medium text-zinc-300">{a.type}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{a.message}</p>
                    </div>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${a.severity === "high" ? "bg-red-500/10 text-red-400" : a.severity === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-800 text-zinc-500"}`}>
                      {a.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 5: top processes ── */}
      {(dashboard?.top_processes?.length ?? 0) > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300">Top Processes</span>
            <span className="text-xs text-zinc-600">by CPU usage</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-zinc-800">
                {["PID", "Name", "CPU %", "CPU Bar", "Memory %"].map(h => (
                  <th key={h} className="text-left text-zinc-600 font-medium px-5 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-zinc-800/60">
                {dashboard!.top_processes.map((p) => (
                  <tr key={p.pid} className="hover:bg-zinc-800/30">
                    <td className="px-5 py-2.5 font-mono text-zinc-600">{p.pid}</td>
                    <td className="px-5 py-2.5 text-zinc-300 font-medium">{p.name}</td>
                    <td className="px-5 py-2.5 text-blue-400 font-mono">{p.cpu_percent.toFixed(1)}%</td>
                    <td className="px-5 py-2.5 w-32">
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(p.cpu_percent, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-violet-400 font-mono">{p.memory_percent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
