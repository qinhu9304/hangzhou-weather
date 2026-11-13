/**
 * GET/POST /api/weather/sync
 * 定时采集入口。请求头必须携带 Authorization: Bearer ${CRON_SECRET}，与 Vercel Cron 的鉴权头一致。
 * 拉取实时天气、空气质量和预警后，写入 weather_logs，并覆盖 weather_alerts。
 */
import { fetchAirQuality, fetchRealtimeWeather, fetchWeatherAlerts, QWeatherError } from "@/lib/qweather";
import { archiveWeatherSnapshot } from "@/lib/supabase";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "同步天气数据失败";
  const status = error instanceof QWeatherError ? error.status : 500;
  return Response.json({ error: message }, { status });
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function syncWeather() {
  const [weather, airQuality, alerts] = await Promise.all([
    fetchRealtimeWeather(),
    fetchAirQuality(),
    fetchWeatherAlerts(),
  ]);
  const recordedAt = await archiveWeatherSnapshot({
    weather,
    aqi: airQuality?.aqi ?? null,
    alerts,
  });

  return {
    ok: true,
    recordedAt,
    summary: {
      city: weather.city,
      temperature: weather.temperature,
      conditionText: weather.conditionText,
      aqi: airQuality?.aqi ?? null,
      alertCount: alerts.length,
    },
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  try {
    return Response.json(await syncWeather());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  try {
    return Response.json(await syncWeather());
  } catch (error) {
    return errorResponse(error);
  }
}
