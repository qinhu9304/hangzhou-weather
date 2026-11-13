/**
 * 双列气象卡片。
 * 展示湿度、风速和空气质量。气压、能见度作为辅助读数保留在对应卡片里。
 */
import { Droplets, Wind } from "lucide-react";

import type { AirQuality, CurrentWeather } from "@/types/weather";

type WeatherMetricsProps = {
  weather: CurrentWeather;
  airQuality: AirQuality | null;
};

const cardClass = "rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl";

export function WeatherMetrics({ weather, airQuality }: WeatherMetricsProps) {
  const category = airQuality?.category;
  const categoryClass = category === "优" || category === "良" ? "text-[#F5B041]" : "text-white";

  return (
    <>
      <article className={cardClass}>
        <div className="flex items-center justify-between text-white/50">
          <p className="text-xs tracking-[0.16em]">湿度</p>
          <Droplets className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <p className="mt-6 text-4xl font-extralight tabular-nums text-white">
          {weather.humidity == null ? "--" : weather.humidity}
          <span className="ml-1 text-lg text-white/50">%</span>
        </p>
      </article>
      <article className={cardClass}>
        <div className="flex items-center justify-between text-white/50">
          <p className="text-xs tracking-[0.16em]">风速</p>
          <Wind className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <p className="mt-6 text-4xl font-extralight tabular-nums text-white">
          {weather.windSpeed == null ? "--" : weather.windSpeed}
          <span className="ml-1 text-lg text-white/50">km/h</span>
        </p>
        <p className="mt-2 text-sm text-white/50">
          {weather.windDir ?? "风向未知"}
          {weather.pressure == null ? "" : ` · ${Math.round(weather.pressure)} hPa`}
        </p>
      </article>
      <article className={cardClass}>
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-[0.16em] text-white/50">空气质量</p>
          <p className={`text-sm ${categoryClass}`}>{category ?? "暂无"}</p>
        </div>
        <p className="mt-6 text-4xl font-extralight tabular-nums text-white">{airQuality ? airQuality.aqi : "--"}</p>
        <p className="mt-2 text-sm text-white/50">
          AQI{weather.visibility == null ? "" : ` · 能见度 ${weather.visibility} km`}
        </p>
      </article>
    </>
  );
}
