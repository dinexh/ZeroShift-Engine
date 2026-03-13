"use client";
import { useEffect, useState, useCallback } from "react";
import { api, type ServerStats, type ServerDashboard } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";

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

interface Sample {
  time: string;
  cpu: number;
  mem: number;
  sentRate: number;
  recvRate: number;
}

function DonutChart({ percent, color, label, sublabel }: { percent: number; color: string; label: string; sublabel: string }) {
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (Math.min(percent, 100) / 100) * circ;
  const strokeColor = percent >= 90 ? "#ef4444" : percent >= 70 ? "#f59e0b" : color;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1a1a1a" strokeWidth="8" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={strokeColor} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.7s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-foreground">{percent.toFixed(0)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/50">{sublabel}</p>
      </div>
    </div>
  );
}

function Charts({ history }: { history: Sample[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || history.length < 2) {
    return (
      <div className="space-y-6">
        {["CPU & Memory History", "Network Rate (KB/s)"].map(title => (
          <div key={title}>
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">{title}</p>
            <div className="h-36 rounded-lg border border-border bg-muted/10 flex items-center justify-center">
              <span className="text-xs text-muted-foreground/40">
                {history.length === 0 ? "Waiting for first sample…" : "Collecting data — 1 sample so far…"}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RC = require("recharts");
  const tooltip = {
    contentStyle: { background: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, fontSize: 11, fontFamily: "var(--font-poppins)" },
    labelStyle: { color: "#71717a" },
  };
  const axis = { tick: { fontSize: 10, fill: "#52525b", fontFamily: "var(--font-poppins)" }, tickLine: false, axisLine: false };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">CPU & Memory History</p>
        <RC.ResponsiveContainer width="100%" height={160}>
          <RC.AreaChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gsCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gsMem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <RC.CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <RC.XAxis dataKey="time" {...axis} />
            <RC.YAxis {...axis} domain={[0, 100]} />
            <RC.Tooltip {...tooltip} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n === "cpu" ? "CPU" : "Memory"]} />
            <RC.Legend wrapperStyle={{ fontSize: 10, color: "#52525b", fontFamily: "var(--font-poppins)" }} formatter={(v: string) => v === "cpu" ? "CPU %" : "Memory %"} />
            <RC.Area type="monotone" dataKey="cpu" stroke="#60a5fa" strokeWidth={1.5} fill="url(#gsCpu)" dot={false} isAnimationActive={false} />
            <RC.Area type="monotone" dataKey="mem" stroke="#a78bfa" strokeWidth={1.5} fill="url(#gsMem)" dot={false} isAnimationActive={false} />
          </RC.AreaChart>
        </RC.ResponsiveContainer>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Network Rate (KB/s)</p>
        <RC.ResponsiveContainer width="100%" height={140}>
          <RC.AreaChart data={history.map(s => ({ ...s, rx: +(s.recvRate / 1024).toFixed(2), tx: +(s.sentRate / 1024).toFixed(2) }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gsRx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gsTx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <RC.CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <RC.XAxis dataKey="time" {...axis} />
            <RC.YAxis {...axis} />
            <RC.Tooltip {...tooltip} formatter={(v: number, n: string) => [`${v.toFixed(2)} KB/s`, n === "rx" ? "RX" : "TX"]} />
            <RC.Legend wrapperStyle={{ fontSize: 10, color: "#52525b", fontFamily: "var(--font-poppins)" }} formatter={(v: string) => v === "rx" ? "RX (in)" : "TX (out)"} />
            <RC.Area type="monotone" dataKey="rx" stroke="#818cf8" strokeWidth={1.5} fill="url(#gsRx)" dot={false} isAnimationActive={false} />
            <RC.Area type="monotone" dataKey="tx" stroke="#f97316" strokeWidth={1.5} fill="url(#gsTx)" dot={false} isAnimationActive={false} />
          </RC.AreaChart>
        </RC.ResponsiveContainer>
      </div>
    </div>
  );
}

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
        <Card className="p-12 text-center">
          <Activity className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm font-medium">Server metrics unavailable</p>
          <p className="text-muted-foreground/40 text-xs mt-2">Start monix to enable server monitoring</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Row 1: stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "CPU",       value: `${stats.cpu_percent.toFixed(1)}%`,    className: stats.cpu_percent >= 90 ? "text-red-400" : stats.cpu_percent >= 70 ? "text-amber-400" : "text-blue-400" },
          { label: "Memory",    value: `${stats.memory_percent.toFixed(1)}%`, className: "text-violet-400" },
          { label: "Disk",      value: `${stats.disk_percent.toFixed(1)}%`,   className: stats.disk_percent >= 90 ? "text-red-400" : "text-orange-400" },
          { label: "Uptime",    value: formatUptime(stats.uptime),            className: "text-foreground" },
          { label: "Processes", value: String(stats.process_count),           className: "text-foreground" },
          { label: "Load (1m)", value: stats.load_avg[0].toFixed(2),         className: "text-foreground" },
        ].map(({ label, value, className }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className={`text-xl font-semibold ${className}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: donuts + network */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Resource Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <DonutChart percent={stats.cpu_percent}    color="#60a5fa" label="CPU"    sublabel={`${stats.cpu_percent.toFixed(1)}% used`} />
              <DonutChart percent={stats.memory_percent} color="#a78bfa" label="Memory" sublabel={`${formatBytes(stats.memory_used)} used`} />
              <DonutChart percent={stats.disk_percent}   color="#f97316" label="Disk"   sublabel={`${formatBytes(stats.disk_used)} used`} />
            </div>
            <Separator />
            <div className="space-y-3 pt-4">
              {[
                { label: "CPU",    value: stats.cpu_percent,    indicatorClassName: "bg-blue-500" },
                { label: "Memory", value: stats.memory_percent, indicatorClassName: stats.memory_percent >= 90 ? "bg-red-500" : stats.memory_percent >= 70 ? "bg-amber-500" : "bg-violet-500" },
                { label: "Disk",   value: stats.disk_percent,   indicatorClassName: stats.disk_percent >= 90 ? "bg-red-500" : stats.disk_percent >= 70 ? "bg-amber-500" : "bg-orange-500" },
              ].map(({ label, value, indicatorClassName }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground font-medium">{value.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(value, 100)} indicatorClassName={indicatorClassName} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Network (Total)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Total Received", value: formatBytes(stats.network_recv),           color: "text-indigo-400" },
                { label: "Total Sent",     value: formatBytes(stats.network_sent),           color: "text-orange-400" },
                { label: "RX Rate",        value: `${formatBytes(stats.network_recv_rate)}/s`, color: "text-indigo-300" },
                { label: "TX Rate",        value: `${formatBytes(stats.network_sent_rate)}/s`, color: "text-orange-300" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground/60">{label}</span>
                  <span className={`font-medium font-mono ${color}`}>{value}</span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">Load (1m / 5m / 15m)</span>
              </div>
              <div className="flex gap-2">
                {stats.load_avg.map((v, i) => (
                  <div key={i} className="flex-1 bg-muted rounded-lg p-2 text-center">
                    <p className="font-semibold text-foreground">{v.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground/50">{["1m","5m","15m"][i]}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: history charts */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-sm font-medium text-foreground">Live History</span>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
            <span>{history.length}/60 samples · 10s interval</span>
            {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
          </div>
        </div>
        <CardContent className="pt-5">
          <Charts history={history} />
        </CardContent>
      </Card>

      {/* Row 4: connections + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="text-sm font-medium text-foreground">Active Connections</span>
            <Badge variant="secondary" className="rounded-full text-[10px]">{dashboard?.connections?.length ?? 0}</Badge>
          </div>
          {!dashboard?.connections?.length ? (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-muted-foreground/40">No active connections</p>
            </div>
          ) : (
            <ScrollArea className="h-56">
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Remote", "Local", "State"].map(h => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.connections.slice(0, 25).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-muted-foreground max-w-[120px] truncate">{c.remote_address ?? "—"}</TableCell>
                      <TableCell className="font-mono text-muted-foreground/60 max-w-[100px] truncate">{c.local_address ?? "—"}</TableCell>
                      <TableCell className="text-indigo-400 font-medium">{c.state ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="text-sm font-medium text-foreground">System Alerts</span>
            <Badge
              variant={(dashboard?.alerts?.length ?? 0) > 0 ? "failed" : "secondary"}
              className="rounded-full text-[10px]"
            >
              {dashboard?.alerts?.length ?? 0}
            </Badge>
          </div>
          {!dashboard?.alerts?.length ? (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-indigo-400 font-medium">All systems normal</p>
              <p className="text-[10px] text-muted-foreground/40 mt-1">No alerts detected</p>
            </div>
          ) : (
            <ScrollArea className="h-56">
              <div className="divide-y divide-border/60">
                {dashboard.alerts.map((a, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <span className={`text-xs mt-0.5 ${a.severity === "high" ? "text-red-400" : a.severity === "medium" ? "text-amber-400" : "text-muted-foreground"}`}>●</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{a.type}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{a.message}</p>
                    </div>
                    <Badge
                      variant={a.severity === "high" ? "failed" : a.severity === "medium" ? "deploying" : "outline"}
                      className="rounded text-[10px]"
                    >
                      {a.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>
      </div>

      {/* Row 5: top processes */}
      {(dashboard?.top_processes?.length ?? 0) > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="text-sm font-medium text-foreground">Top Processes</span>
            <span className="text-xs text-muted-foreground/50">by CPU usage</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {["PID", "Name", "CPU %", "CPU Bar", "Memory %"].map(h => <TableHead key={h}>{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard!.top_processes.map(p => (
                <TableRow key={p.pid}>
                  <TableCell className="font-mono text-muted-foreground/60">{p.pid}</TableCell>
                  <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                  <TableCell className="text-blue-400 font-mono">{p.cpu_percent.toFixed(1)}%</TableCell>
                  <TableCell className="w-32">
                    <Progress value={Math.min(p.cpu_percent, 100)} indicatorClassName="bg-blue-500" />
                  </TableCell>
                  <TableCell className="text-violet-400 font-mono">{p.memory_percent.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
