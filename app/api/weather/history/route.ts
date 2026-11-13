/**
 * GET /api/weather/history?range=24h|7d
 * 按时间正序返回天气日志，供气温趋势图使用。
 * 24 小时视图的时间格式为 HH:mm，7 天视图为 MM-DD HH:mm，均为北京时间。
 */
import { listWeatherLogsSince } from "@/lib/supabase";
import { formatBeijingTime } from "@/lib/utils";
import type { WeatherHistoryPoint } from "@/types/weather";

const DAY_MS = 24 * 60 * 60 * 1000;

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "查询历史天气失败";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const rangeParam = new URL(request.url).searchParams.get("range");
    const range = rangeParam === "7d" ? "7d" : "24h";
    const since = new Date(Date.now() - (range === "7d" ? 7 : 1) * DAY_MS);
    const logs = await listWeatherLogsSince(since);
    const pattern = range === "7d" ? "MM-DD HH:mm" : "HH:mm";

    const points: WeatherHistoryPoint[] = logs.map((log) => ({
      time: formatBeijingTime(log.recorded_at, pattern),
      temperature: log.temperature,
      feelsLike: log.feels_like,
      humidity: log.humidity,
      aqi: log.aqi,
    }));

    return Response.json({ range, points });
  } catch (error) {
    return errorResponse(error);
  }
}
