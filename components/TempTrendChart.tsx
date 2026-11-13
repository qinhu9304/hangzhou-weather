"use client";

/**
 * 日轨与温度趋势。
 * 曲线从暖橙过渡到暮光紫，最后一个时间点用发光圆点标出当前位置。
 */
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { WeatherHistoryPoint } from "@/types/weather";

type HistoryRange = "24h" | "7d";

type TempTrendChartProps = {
  range: HistoryRange;
  points: WeatherHistoryPoint[];
  loading: boolean;
  onRangeChange: (range: HistoryRange) => void;
};

const RANGES: { id: HistoryRange; label: string }[] = [
  { id: "24h", label: "24 小时" },
  { id: "7d", label: "7 天" },
];

type DotProps = {
  cx?: number;
  cy?: number;
  index?: number;
};

function pointOnArc(progress: number) {
  const start = { x: 18, y: 78 };
  const control = { x: 150, y: 8 };
  const end = { x: 282, y: 78 };
  const t = Math.min(1, Math.max(0, progress));
  const u = 1 - t;
  return {
    x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
  };
}

function SunArc() {
  const [progress, setProgress] = useState(0.5);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Shanghai",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      );
      setProgress((hour - 5) / 14);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const sun = pointOnArc(progress);

  return (
    <svg viewBox="0 0 300 96" className="h-24 w-full" aria-hidden="true">
      <path d="M18 78 Q150 8 282 78" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      <circle cx={sun.x} cy={sun.y} r="10" fill="rgba(245,176,65,0.22)" />
      <circle cx={sun.x} cy={sun.y} r="4.5" fill="#F5B041" />
    </svg>
  );
}

export function TempTrendChart({ range, points, loading, onRangeChange }: TempTrendChartProps) {
  const lastIndex = points.length - 1;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-5 backdrop-blur-xl sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-light tracking-[0.16em] text-white/80">温度轨迹</h2>
          <p className="mt-1 text-xs text-white/50">北京时间 · 气温与体感</p>
        </div>
        <div className="flex rounded-full border border-white/10 p-1">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRangeChange(item.id)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                range === item.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <SunArc />
      <div className="h-52">
        {loading ? (
          <div className="h-full animate-pulse rounded-2xl bg-white/[0.04]" />
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/50">这个时段还没有采集记录</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 18, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="orbitStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#F5B041" />
                  <stop offset="100%" stopColor="#B7A1E8" />
                </linearGradient>
                <linearGradient id="orbitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5B041" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#B7A1E8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(11,14,23,0.92)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 16,
                  color: "#fff",
                }}
              />
              <Area
                type="monotone"
                dataKey="feelsLike"
                name="体感"
                stroke="rgba(183,161,232,0.45)"
                fill="transparent"
                strokeWidth={1}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="temperature"
                name="气温"
                stroke="url(#orbitStroke)"
                fill="url(#orbitFill)"
                strokeWidth={2}
                dot={(dotProps: DotProps) => {
                  const { cx, cy, index } = dotProps;
                  if (cx == null || cy == null || index !== lastIndex) return <g key={index} />;
                  return (
                    <g key={index}>
                      <circle cx={cx} cy={cy} r={9} fill="rgba(245,176,65,0.28)" />
                      <circle cx={cx} cy={cy} r={3.5} fill="#fff" />
                    </g>
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
