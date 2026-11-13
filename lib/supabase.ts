import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CurrentWeather, WeatherAlert, WeatherLog } from "@/types/weather";

const serverAuth = {
  persistSession: false,
  autoRefreshToken: false,
};

function readEnv(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return trimmed;
}

function toNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

/** 只读客户端，使用 anon key。查询受 RLS 限制，可供前端或服务端读取。 */
export const supabase = createClient(
  supabaseUrl,
  readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  {
    auth: serverAuth,
  },
);

/**
 * 写入客户端，使用 service role key，仅能在服务端绕过 RLS。
 * 浏览器端不会创建该客户端，避免把密钥带进前端包。
 */
export const supabaseAdmin: SupabaseClient =
  typeof window === "undefined"
    ? createClient(
        supabaseUrl,
        readEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
        {
          auth: serverAuth,
        },
      )
    : new Proxy({} as SupabaseClient, {
        get() {
          throw new Error("supabaseAdmin 只能在服务端使用");
        },
      });

type WeatherLogRow = {
  id: string;
  city: string;
  temperature: number | string;
  feels_like: number | string | null;
  humidity: number | string | null;
  wind_speed: number | string | null;
  wind_dir: string | null;
  aqi: number | string | null;
  condition_text: string | null;
  condition_icon: string | null;
  recorded_at: string;
};

function mapWeatherLog(row: WeatherLogRow): WeatherLog {
  const temperature = toNumber(row.temperature);
  if (temperature == null) {
    throw new Error("天气日志中的温度无效");
  }

  return {
    id: row.id,
    city: row.city,
    temperature,
    feels_like: toNumber(row.feels_like),
    humidity: toNumber(row.humidity),
    wind_speed: toNumber(row.wind_speed),
    wind_dir: row.wind_dir,
    aqi: toNumber(row.aqi),
    condition_text: row.condition_text,
    condition_icon: row.condition_icon,
    recorded_at: row.recorded_at,
  };
}

/** 读取最新一条天气日志。没有记录时返回 null。 */
export async function getLatestWeatherLog() {
  const { data, error } = await supabase
    .from("weather_logs")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`查询最新天气日志失败：${error.message}`);
  }

  return data ? mapWeatherLog(data as WeatherLogRow) : null;
}

/** 按时间正序读取指定时刻之后的历史日志，供趋势图使用。 */
export async function listWeatherLogsSince(since: Date) {
  const { data, error } = await supabase
    .from("weather_logs")
    .select("id, city, temperature, feels_like, humidity, wind_speed, wind_dir, aqi, condition_text, condition_icon, recorded_at")
    .gte("recorded_at", since.toISOString())
    .order("recorded_at", { ascending: true });

  if (error) {
    throw new Error(`查询历史天气失败：${error.message}`);
  }

  return (data ?? []).map((row) => mapWeatherLog(row as WeatherLogRow));
}

/** 读取当前保存在库里的生效预警。同步任务会用最新预警覆盖这张表。 */
export async function listWeatherAlerts() {
  const { data, error } = await supabase
    .from("weather_alerts")
    .select("id, title, severity, description, effective_time")
    .order("effective_time", { ascending: false });

  if (error) {
    throw new Error(`查询气象预警失败：${error.message}`);
  }

  return (data ?? []).map(
    (row): WeatherAlert => ({
      id: row.id,
      title: row.title,
      severity: row.severity,
      description: row.description,
      effectiveTime: row.effective_time,
    }),
  );
}

/**
 * 把一次实况采集写入 weather_logs，并用本次预警覆盖 weather_alerts。
 * 预警表只保留当前生效的记录，避免过期预警继续显示。
 */
export async function archiveWeatherSnapshot(input: {
  weather: CurrentWeather;
  aqi: number | null;
  alerts: WeatherAlert[];
}) {
  const recordedAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("weather_logs").insert({
    city: input.weather.city,
    temperature: input.weather.temperature,
    feels_like: input.weather.feelsLike,
    humidity: input.weather.humidity,
    wind_speed: input.weather.windSpeed,
    wind_dir: input.weather.windDir,
    aqi: input.aqi,
    condition_text: input.weather.conditionText,
    condition_icon: input.weather.conditionIcon,
    recorded_at: recordedAt,
  });

  if (error) {
    throw new Error(`写入天气日志失败：${error.message}`);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("weather_alerts")
    .delete()
    .not("id", "is", null);

  if (deleteError) {
    throw new Error(`清理气象预警失败：${deleteError.message}`);
  }

  if (input.alerts.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("weather_alerts").insert(
      input.alerts.map((alert) => ({
        title: alert.title,
        severity: alert.severity,
        description: alert.description,
        effective_time: alert.effectiveTime,
      })),
    );

    if (insertError) {
      throw new Error(`写入气象预警失败：${insertError.message}`);
    }
  }

  return recordedAt;
}
