"use client";

/**
 * 顶部 Hero。
 * 左上角是更新时间与城市，右上角是今日高低温度和湿度。
 * 有预警时在卡片下方展开横幅。刷新按钮保持手动更新。
 */
import { AlertTriangle, RefreshCw } from "lucide-react";

import { formatBeijingTime } from "@/lib/utils";
import type { CurrentWeather, WeatherAlert } from "@/types/weather";

type WeatherHeaderProps = {
  /** 最近一次数据更新时间，ISO 8601。加载中为 null */
  updatedAt: string | null;
  weather: CurrentWeather | null;
  refreshing: boolean;
  alerts: WeatherAlert[];
  onRefresh: () => void;
};

function formatDegree(value: number | null) {
  return value == null ? "--" : `${Math.round(value)}°`;
}

export function WeatherHeader({ updatedAt, weather, refreshing, alerts, onRefresh }: WeatherHeaderProps) {
  const updatedLabel = updatedAt ? formatBeijingTime(updatedAt, "HH:mm") : "--:--";

  return (
    <header>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-white/50">更新于 {updatedLabel}</p>
          <h1 className="mt-2 text-5xl font-extralight tracking-wide text-white sm:text-6xl">杭州</h1>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right text-sm tabular-nums text-white/50">
            <p>
              最高 <span className="text-white">{formatDegree(weather?.tempMax ?? null)}</span>
            </p>
            <p className="mt-1">
              最低 <span className="text-white">{formatDegree(weather?.tempMin ?? null)}</span>
            </p>
            <p className="mt-1">
              湿度 <span className="text-white">{weather?.humidity == null ? "--" : `${weather.humidity}%`}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="刷新"
            className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:text-white disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      {alerts.length > 0 && (
        <div className="mt-5 space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id ?? alert.title}
              className="flex gap-3 rounded-2xl border border-[#F5B041]/30 bg-[#F5B041]/10 px-4 py-3 text-[#F8E2BC]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm text-white">
                  {alert.severity ? `${alert.severity} · ` : ""}
                  {alert.title}
                </p>
                {alert.description && <p className="mt-1 text-xs leading-5 text-white/50">{alert.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
