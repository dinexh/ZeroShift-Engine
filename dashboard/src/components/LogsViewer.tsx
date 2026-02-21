"use client";
import { useEffect, useRef } from "react";

interface Props {
  lines: string[];
  loading: boolean;
  lastUpdated: Date | null;
}

export function LogsViewer({ lines, loading, lastUpdated }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
            Logs
          </span>
          <span className="text-xs text-zinc-600">
            (last 200 lines · auto-refreshes every 15s)
          </span>
          {loading && (
            <span className="text-xs text-zinc-600 animate-pulse">
              refreshing...
            </span>
          )}
        </div>
        {lastUpdated && (
          <span className="text-xs text-zinc-600">
            {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-lg h-80 overflow-y-auto p-4">
        {lines.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-xs text-zinc-700">
              No log output — container may not be running
            </span>
          </div>
        ) : (
          <div>
            {lines.map((line, i) => (
              <pre
                key={i}
                className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all leading-relaxed"
              >
                {line}
              </pre>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
