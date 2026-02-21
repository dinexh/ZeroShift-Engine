"use client";
import { useState, useEffect } from "react";

export interface MetricSample {
  time: string;
  cpu: number;
  memoryPercent: number;
  memoryMB: number;
}

interface Props {
  data: MetricSample[];
}

// Recharts is loaded only in the browser to avoid SSR/static-export issues
// with its dependency on browser globals.
export function MetricsChart({ data }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <ChartSkeleton label="Loading charts..." />;
  }

  if (data.length === 0) {
    return <ChartSkeleton label="Waiting for metrics — polls every 30s" />;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
  } = require("recharts");

  const tooltipStyle = {
    contentStyle: {
      background: "#18181b",
      border: "1px solid #3f3f46",
      borderRadius: 6,
      fontSize: 11,
    },
    labelStyle: { color: "#a1a1aa" },
  };

  return (
    <div className="space-y-6">
      {/* CPU */}
      <div>
        <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">
          CPU %
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={data} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(v: number) => [`${v.toFixed(2)}%`, "CPU"]}
            />
            <Line
              type="monotone"
              dataKey="cpu"
              stroke="#60a5fa"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Memory */}
      <div>
        <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">
          Memory (MB)
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={data} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(v: number) => [`${v.toFixed(1)} MB`, "Memory"]}
            />
            <Line
              type="monotone"
              dataKey="memoryMB"
              stroke="#a78bfa"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartSkeleton({ label }: { label: string }) {
  return (
    <div className="h-40 bg-zinc-800/40 rounded-lg flex items-center justify-center">
      <span className="text-xs text-zinc-600">{label}</span>
    </div>
  );
}
