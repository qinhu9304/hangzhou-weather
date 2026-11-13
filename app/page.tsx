"use client";

import { useCallback, useEffect, useState } from "react";

import { CurrentWeatherCard } from "@/components/CurrentWeatherCard";
import { LifeStyleTips } from "@/components/LifeStyleTips";
import { TempTrendChart } from "@/components/TempTrendChart";
import { WeatherHeader } from "@/components/WeatherHeader";
import { WeatherMetrics } from "@/components/WeatherMetrics";
import type { CurrentWeatherResponse, WeatherHistoryPoint } from "@/types/weather";

type HistoryRange = "24h" | "7d";
type SkyTone = "dusk" | "night" | "day" | "mist";

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "天气数据加载失败");
  }
  return body;
}

function resolveSkyTone(condition: string | undefined, hour: number): SkyTone {
  if (condition && /雨|雪|雾|阴|霾/.test(condition)) return "mist";
  if (hour >= 19 || hour < 5) return "night";
  if (hour < 8 || hour >= 16) return "dusk";
  return "day";
}

export default function HomePage() {
  const [current, setCurrent] = useState<CurrentWeatherResponse | null>(null);
  const [points, setPoints] = useState<WeatherHistoryPoint[]>([]);
  const [range, setRange] = useState<HistoryRange>("24h");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skyTone, setSkyTone] = useState<SkyTone>("dusk");

  const loadHistory = useCallback(async (nextRange: HistoryRange) => {
    setHistoryLoading(true);
    try {
      const history = await readJson<{ points: WeatherHistoryPoint[] }>(`/api/weather/history?range=${nextRange}`);
      setPoints(history.points);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(
    async (nextRange: HistoryRange, silent = false) => {
      if (!silent) setRefreshing(true);
      setError(null);
      try {
        const [weather] = await Promise.all([
          readJson<CurrentWeatherResponse>("/api/weather/current"),
          loadHistory(nextRange),
        ]);
        setCurrent(weather);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "天气数据加载失败");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadHistory],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard(range);
    }, 0);
    const poll = window.setInterval(() => {
      void loadDashboard(range, true);
    }, 5 * 60 * 1000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [loadDashboard, range]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Shanghai",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      );
      setSkyTone(resolveSkyTone(current?.weather.conditionText, hour));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current?.weather.conditionText]);

  return (
    <div className="relative min-h-full flex-1 overflow-hidden">
      <div className="sky-glow pointer-events-none absolute inset-x-0 top-0 h-[560px]" data-tone={skyTone} />
      <div className="starfield pointer-events-none absolute inset-0" />
      <main className="relative mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
        <section className="hero-card relative overflow-hidden rounded-3xl border border-white/10 px-6 py-7 backdrop-blur-xl sm:px-8">
          <WeatherHeader
            updatedAt={current?.updatedAt ?? null}
            weather={current?.weather ?? null}
            refreshing={refreshing}
            alerts={current?.alerts ?? []}
            onRefresh={() => void loadDashboard(range)}
          />
          {loading && !current ? (
            <div className="mt-10 h-40 animate-pulse rounded-3xl bg-white/[0.04]" />
          ) : current ? (
            <CurrentWeatherCard weather={current.weather} />
          ) : null}
        </section>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-xl">
            <p className="text-sm text-white/70">{error}</p>
            <button
              type="button"
              onClick={() => void loadDashboard(range)}
              className="rounded-full border border-white/10 px-4 py-2 text-xs text-white"
            >
              重试
            </button>
          </div>
        )}

        {loading && !current ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
            ))}
          </div>
        ) : current ? (
          <>
            <TempTrendChart range={range} points={points} loading={historyLoading} onRangeChange={setRange} />
            <div className="grid grid-cols-2 gap-3">
              <WeatherMetrics weather={current.weather} airQuality={current.airQuality} />
              <LifeStyleTips lifeIndices={current.lifeIndices} />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
