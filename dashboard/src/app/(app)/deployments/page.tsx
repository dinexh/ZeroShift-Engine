"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api, type Deployment, type Project } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_TABS = [
  { key: "all",         label: "All" },
  { key: "ACTIVE",      label: "Active" },
  { key: "FAILED",      label: "Failed" },
  { key: "ROLLED_BACK", label: "Rolled back" },
  { key: "DEPLOYING",   label: "Deploying" },
] as const;

type StatusKey = typeof STATUS_TABS[number]["key"];

export default function DeploymentsPage() {
  const [deployments, setDeployments]     = useState<Deployment[]>([]);
  const [projects, setProjects]           = useState<Project[]>([]);
  const [loading, setLoading]             = useState(true);
  const [statusFilter, setStatusFilter]   = useState<StatusKey>("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      const [{ deployments: d }, { projects: p }] = await Promise.all([
        api.deployments.list(),
        api.projects.list(),
      ]);
      setDeployments([...d].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setProjects(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const filtered = deployments
    .filter(d => projectFilter === "all" || d.projectId === projectFilter)
    .filter(d => statusFilter === "all"  || d.status    === statusFilter);

  const statusCounts = {
    ACTIVE:      deployments.filter(d => d.status === "ACTIVE").length,
    FAILED:      deployments.filter(d => d.status === "FAILED").length,
    DEPLOYING:   deployments.filter(d => d.status === "DEPLOYING").length,
    ROLLED_BACK: deployments.filter(d => d.status === "ROLLED_BACK").length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",       value: deployments.length,       className: "text-foreground" },
          { label: "Active",      value: statusCounts.ACTIVE,      className: "text-indigo-400" },
          { label: "Failed",      value: statusCounts.FAILED,      className: statusCounts.FAILED > 0 ? "text-red-400" : "text-muted-foreground/40" },
          { label: "Rolled back", value: statusCounts.ROLLED_BACK, className: "text-muted-foreground" },
        ].map(({ label, value, className }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className={`text-3xl font-bold tracking-tight ${className}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
          {/* Status filter tabs */}
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusKey)}>
            <TabsList className="h-8">
              {STATUS_TABS.map(({ key, label }) => {
                const count = key === "all" ? deployments.length : statusCounts[key as keyof typeof statusCounts];
                return (
                  <TabsTrigger key={key} value={key} className="gap-1.5 text-xs px-3">
                    {label}
                    {count > 0 && (
                      <span className="text-[10px] tabular-nums opacity-60">{count}</span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Project filter */}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-14 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-muted-foreground/50">No deployments found</p>
            {(statusFilter !== "all" || projectFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStatusFilter("all"); setProjectFilter("all"); }}
                className="mt-2 text-xs text-muted-foreground/50"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {["Project", "Version", "Slot", "Container", "Status", "Port", "Deployed"].map(h => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(d => {
                const proj = projectMap[d.projectId];
                return (
                  <TableRow
                    key={d.id}
                    className={cn(d.status === "FAILED" && "bg-red-950/10")}
                  >
                    <TableCell>
                      {proj ? (
                        <Link href={`/projects/${proj.id}`} className="text-foreground hover:text-foreground/80 font-medium transition-colors">
                          {proj.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/50 font-mono text-[10px]">{d.projectId.slice(0, 8)}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">v{d.version}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${d.color === "BLUE" ? "text-blue-400" : "text-indigo-400"}`}>
                        {d.color}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground/60 max-w-[140px] truncate">{d.containerName}</TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                    <TableCell className="font-mono text-muted-foreground/60">{d.port}</TableCell>
                    <TableCell className="text-muted-foreground/60">{timeAgo(d.updatedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
