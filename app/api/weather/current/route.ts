/**
 * GET /api/weather/current
 * 优先返回 30 分钟内的天气日志，避免重复消耗和风天气额度。
 * 缓存过期或数据库为空时，实时拉取天气、空气质量、预警和生活指数，并在响应返回后写入 Supabase。
 */
import { after } from "next/server";

import { describeAqi, fetchAirQuality, fetchLifeIndices, fetchRealtimeWeather, fetchTodayRange, fetchWeatherAlerts, QWeatherError } from "@/lib/qweather";
import { archiveWeatherSnapshot, getLatestWeatherLog, listWeatherAlerts } from "@/lib/supabase";
import type { CurrentWeather, CurrentWeatherResponse, WeatherLog } from "@/types/weather";

const CACHE_TTL_MS = 30 * 60 * 1000;

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "获取实时天气失败";
  const status = error instanceof QWeatherError ? error.status : 500;
  return Response.json({ error: message }, { status });
}

function weatherFromLog(log: WeatherLog): CurrentWeather {
  return {
    city: log.city,
    locationId: process.env.HANGZHOU_LOCATION_ID?.trim() || "101210101",
    temperature: log.temperature,
    feelsLike: log.feels_like,
    humidity: log.humidity,
    windSpeed: log.wind_speed,
    windDir: log.wind_dir,
    conditionText: log.condition_text || "未知",
    conditionIcon: log.condition_icon || "",
    pressure: null,
    visibility: null,
    tempMax: null,
    tempMin: null,
    observedAt: log.recorded_at,
  };
}

export async function GET() {
  try {
    const latest = await getLatestWeatherLog();
    const recordedAt = latest ? new Date(latest.recorded_at).getTime() : Number.NaN;
    const cacheIsFresh = Number.isFinite(recordedAt) && Date.now() - recordedAt <= CACHE_TTL_MS;

    if (latest && cacheIsFresh) {
      const [alerts, lifeIndices, today] = await Promise.all([
        listWeatherAlerts(),
        // 生活指数和今日高低温度没有入库，缓存命中时单独补拉，避免大盘卡片空白。
        fetchLifeIndices().catch(() => null),
        fetchTodayRange().catch(() => ({ tempMax: null, tempMin: null })),
      ]);
      const response: CurrentWeatherResponse = {
        weather: { ...weatherFromLog(latest), tempMax: today.tempMax, tempMin: today.tempMin },
        airQuality:
          latest.aqi == null
            ? null
            : {
                aqi: latest.aqi,
                category: describeAqi(latest.aqi),
                observedAt: latest.recorded_at,
              },
        alerts,
        lifeIndices,
        source: "cache",
        updatedAt: latest.recorded_at,
      };
      return Response.json(response);
    }

    const [weather, airQuality, alerts, lifeIndices] = await Promise.all([
      fetchRealtimeWeather(),
      fetchAirQuality(),
      fetchWeatherAlerts(),
      fetchLifeIndices(),
    ]);

    after(async () => {
      try {
        await archiveWeatherSnapshot({
          weather,
          aqi: airQuality?.aqi ?? null,
          alerts,
        });
      } catch (error) {
        console.error("归档实时天气失败", error);
      }
    });

    const response: CurrentWeatherResponse = {
      weather,
      airQuality,
      alerts,
      lifeIndices,
      source: "live",
      updatedAt: new Date().toISOString(),
    };
    return Response.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
