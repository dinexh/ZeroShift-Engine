"use client";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  lines: string[];
  updatedAt: Date | null;
  loading: boolean;
}

export function LogsViewer({ lines, updatedAt, loading }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Container Logs</p>
        {updatedAt && (
          <span className="text-[10px] text-muted-foreground/50">
            Updated {updatedAt.toLocaleTimeString()}
          </span>
        )}
        {loading && (
          <span className="text-[10px] text-muted-foreground/50 animate-pulse">Refreshing…</span>
        )}
      </div>
      <ScrollArea className="h-64 w-full rounded-lg border border-border bg-black/40">
        <div className="p-3 font-mono text-[11px] leading-relaxed space-y-0.5">
          {lines.length === 0 ? (
            <p className="text-muted-foreground/40 py-8 text-center">No logs yet</p>
          ) : (
            lines.map((line, i) => {
              const isError = /error|fail|fatal|panic/i.test(line);
              const isWarn  = /warn|warning/i.test(line);
              return (
                <p
                  key={i}
                  className={
                    isError ? "text-red-400/80" :
                    isWarn  ? "text-amber-400/80" :
                    "text-muted-foreground/70"
                  }
                >
                  {line}
                </p>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
