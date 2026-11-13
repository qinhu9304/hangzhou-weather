import type {
  AirQuality,
  CurrentWeather,
  LifeIndex,
  LifeIndices,
  WeatherAlert,
} from "@/types/weather";

const REQUEST_TIMEOUT_MS = 5000;
const CITY_NAME = "杭州";
/** 杭州中心点，供只接受经纬度的 v1 接口使用。 */
const HANGZHOU_LATITUDE = "30.27";
const HANGZHOU_LONGITUDE = "120.16";

const COMPASS_LABELS: Record<string, string> = {
  n: "北风",
  nne: "东北风",
  ne: "东北风",
  ene: "东北风",
  e: "东风",
  ese: "东南风",
  se: "东南风",
  sse: "东南风",
  s: "南风",
  ssw: "西南风",
  sw: "西南风",
  wsw: "西南风",
  w: "西风",
  wnw: "西北风",
  nw: "西北风",
  nnw: "西北风",
};

/** 和风生活指数类型：2 洗车、3 穿衣、5 紫外线。 */
const LIFE_INDEX_TYPES = "2,3,5";

const SEVERITY_LABELS: Record<string, string> = {
  blue: "蓝色",
  yellow: "黄色",
  orange: "橙色",
  red: "红色",
  white: "白色",
  蓝色: "蓝色",
  黄色: "黄色",
  橙色: "橙色",
  红色: "红色",
  白色: "白色",
};

export class QWeatherError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "QWeatherError";
    this.status = status;
  }
}

function readEnv(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new QWeatherError(`缺少环境变量 ${name}`, 500);
  }
  return trimmed;
}

/** 控制台里的 API Host 可能没写协议，这里统一补成 URL。 */
function getApiOrigin() {
  const raw = readEnv("QWEATHER_API_HOST", process.env.QWEATHER_API_HOST);
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    throw new QWeatherError("QWEATHER_API_HOST 不是合法地址", 500);
  }
}

function getLocationId() {
  return process.env.HANGZHOU_LOCATION_ID?.trim() || "101210101";
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** 从和风的错误体里取出可读原因，不回传请求地址和密钥。 */
function readErrorDetail(body: unknown, status: number) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { title?: unknown; detail?: unknown } }).error;
    const title = typeof error?.title === "string" ? error.title : "";
    const detail = typeof error?.detail === "string" ? error.detail : "";
    const message = [title, detail].filter(Boolean).join("：");
    if (message) return message;
  }

  if (body && typeof body === "object" && "code" in body) {
    return `和风天气错误码 ${String((body as { code: unknown }).code)}`;
  }

  return `和风天气请求失败（HTTP ${status}）`;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 和风 v1 的湿度是 0 到 1 的小数，入库和展示统一成百分比。 */
function toPercent(value: number | null) {
  if (value == null) return null;
  return Math.round(value <= 1 ? value * 100 : value);
}

/** 和风 v1 风速单位是 m/s，页面和数据库使用 km/h。 */
function metersPerSecondToKmh(value: number | null) {
  if (value == null) return null;
  return roundTo(value * 3.6, 1);
}

function compassLabel(value: unknown) {
  const raw = readText(value).toLowerCase();
  if (!raw) return null;
  return COMPASS_LABELS[raw] ?? readText(value);
}

/**
 * 请求和风天气。超时 5 秒，HTTP 失败和网络失败都转成 QWeatherError。
 * v7 接口用 code 表示结果；v1 接口成功时没有 code，直接返回业务字段。
 */
async function requestQWeather(pathname: string, params: Record<string, string> = {}) {
  const url = new URL(pathname, getApiOrigin());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, {
      headers: {
        "X-QW-Api-Key": readEnv("QWEATHER_API_KEY", process.env.QWEATHER_API_KEY),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new QWeatherError(readErrorDetail(body, response.status));
    }

    const record = asRecord(body);
    if (!record) {
      throw new QWeatherError("和风天气返回了无法识别的数据");
    }

    if ("code" in record) {
      const code = String(record.code);
      if (code !== "200" && code !== "204") {
        throw new QWeatherError(readErrorDetail(body, response.status));
      }
    }

    return record;
  } catch (error) {
    if (error instanceof QWeatherError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new QWeatherError("和风天气请求超时");
    }
    throw new QWeatherError("无法连接和风天气服务");
  }
}

/** 今日最高、最低温来自逐日预报。预报失败时不阻断实况。 */
export async function fetchTodayRange() {
  try {
    const body = await requestQWeather("/v7/weather/3d", {
      location: getLocationId(),
      lang: "zh",
    });
    const today = Array.isArray(body.daily) ? asRecord(body.daily[0]) : null;
    return {
      tempMax: toNumber(today?.tempMax),
      tempMin: toNumber(today?.tempMin),
    };
  } catch {
    return { tempMax: null, tempMin: null };
  }
}

/** 按中国 AQI 分段给出优、良或污染等级。 */
export function describeAqi(aqi: number) {
  if (aqi <= 50) return "优";
  if (aqi <= 100) return "良";
  if (aqi <= 150) return "轻度污染";
  if (aqi <= 200) return "中度污染";
  if (aqi <= 300) return "重度污染";
  return "严重污染";
}

/** 获取杭州实时天气，并映射为 CurrentWeather。 */
export async function fetchRealtimeWeather(): Promise<CurrentWeather> {
  const locationId = getLocationId();
  const [body, today] = await Promise.all([
    requestQWeather(`/weather/v1/current/${HANGZHOU_LATITUDE}/${HANGZHOU_LONGITUDE}`, {
      localTime: "true",
      lang: "zh",
    }),
    fetchTodayRange(),
  ]);

  const condition = asRecord(body.condition);
  const wind = asRecord(body.wind);
  const direction = asRecord(wind?.direction);
  const temperature = nestedValue(body.temperature);
  if (temperature == null) {
    throw new QWeatherError("暂无杭州实时天气");
  }

  const visibilityMeters = nestedValue(body.visibility);

  return {
    city: CITY_NAME,
    locationId,
    temperature: roundTo(temperature, 1),
    feelsLike: roundNullable(nestedValue(body.feelsLike), 1),
    humidity: toPercent(toNumber(body.humidity)),
    windSpeed: metersPerSecondToKmh(nestedValue(wind?.speed)),
    windDir: compassLabel(direction?.compass),
    conditionText: readText(condition?.text) || "未知",
    conditionIcon: readText(condition?.code),
    pressure: roundNullable(nestedValue(body.pressure), 0),
    visibility: visibilityMeters == null ? null : roundTo(visibilityMeters / 1000, 1),
    tempMax: today.tempMax,
    tempMin: today.tempMin,
    observedAt: readText(body.validTime),
  };
}

function nestedValue(record: unknown) {
  return toNumber(asRecord(record)?.value);
}

function roundNullable(value: number | null, digits: number) {
  return value == null ? null : roundTo(value, digits);
}

/** 获取杭州实时 AQI。优先使用中国标准 cn-mee，上游没有数据时返回 null。 */
export async function fetchAirQuality(): Promise<AirQuality | null> {
  const body = await requestQWeather(
    `/airquality/v1/current/${HANGZHOU_LATITUDE}/${HANGZHOU_LONGITUDE}`,
    { lang: "zh" },
  );
  const indexes = Array.isArray(body.indexes)
    ? body.indexes.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const current = indexes.find((item) => item.code === "cn-mee") ?? indexes[0];
  const aqi = toNumber(current?.aqi);
  if (!current || aqi == null) return null;

  const category = readText(current.category);
  return {
    aqi: Math.round(aqi),
    category: category || describeAqi(aqi),
    observedAt: new Date().toISOString(),
  };
}

function normalizeSeverity(alert: Record<string, unknown>) {
  const color = asRecord(alert.color);
  const raw = readText(color?.code) || readText(alert.severity);
  if (!raw) return null;
  return SEVERITY_LABELS[raw] ?? SEVERITY_LABELS[raw.toLowerCase()] ?? raw;
}

/** 获取杭州当前生效的气象预警。没有预警时返回空数组。 */
export async function fetchWeatherAlerts(): Promise<WeatherAlert[]> {
  const body = await requestQWeather(
    `/weatheralert/v1/current/${HANGZHOU_LATITUDE}/${HANGZHOU_LONGITUDE}`,
    { localTime: "true", lang: "zh" },
  );
  if (!Array.isArray(body.alerts)) return [];

  return body.alerts
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((alert) => ({
      id: readText(alert.id) || undefined,
      title: readText(alert.headline) || readText(asRecord(alert.eventType)?.name) || "气象预警",
      severity: normalizeSeverity(alert),
      description: readText(alert.description) || null,
      effectiveTime: readText(alert.effectiveTime) || readText(alert.issuedTime) || null,
    }));
}

function toLifeIndex(item: Record<string, unknown> | undefined, fallbackName: string): LifeIndex {
  return {
    name: readText(item?.name) || fallbackName,
    category: readText(item?.category) || "暂无",
    text: readText(item?.text) || "今天暂无该项指数",
  };
}

/** 获取当天穿衣、紫外线和洗车指数。上游没有数据时返回 null。 */
export async function fetchLifeIndices(): Promise<LifeIndices | null> {
  const body = await requestQWeather("/v7/indices/1d", {
    location: getLocationId(),
    type: LIFE_INDEX_TYPES,
    lang: "zh",
  });

  if (String(body.code) === "204" || !Array.isArray(body.daily)) return null;

  const daily = body.daily.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
  );
  const byType = new Map(daily.map((item) => [readText(item.type), item]));
  const date = readText(daily[0]?.date);

  return {
    date,
    clothing: toLifeIndex(byType.get("3"), "穿衣指数"),
    carWash: toLifeIndex(byType.get("2"), "洗车指数"),
    uv: toLifeIndex(byType.get("5"), "紫外线指数"),
  };
}
