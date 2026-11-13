/**
 * 前后端共享的天气数据契约。
 * 和风天气的原始字段先在 lib/qweather.ts 中清洗，再转换成这里的结构。
 * 时间字段统一使用 ISO 8601；展示给用户前，用 lib/utils.ts 转成北京时间。
 */

/** 杭州实时天气。数值字段在上游缺失时为 null，避免把缺测伪装成 0。 */
export interface CurrentWeather {
  /** 城市名称，当前固定为杭州 */
  city: string;
  /** 和风天气 Location ID，杭州为 101210101 */
  locationId: string;
  /** 气温，单位 ℃ */
  temperature: number;
  /** 体感温度，单位 ℃ */
  feelsLike: number | null;
  /** 相对湿度，单位 % */
  humidity: number | null;
  /** 风速，单位 km/h */
  windSpeed: number | null;
  /** 风向文字，例如“东北风” */
  windDir: string | null;
  /** 天气现象文字，例如“多云” */
  conditionText: string;
  /** 和风天气图标代码，例如 100 表示晴 */
  conditionIcon: string;
  /** 气压，单位 hPa */
  pressure: number | null;
  /** 能见度，单位 km */
  visibility: number | null;
  /** 今日最高气温，单位 ℃。数据库缓存里没有该字段时为 null */
  tempMax: number | null;
  /** 今日最低气温，单位 ℃。数据库缓存里没有该字段时为 null */
  tempMin: number | null;
  /** 实况观测时间，ISO 8601 */
  observedAt: string;
}

/**
 * weather_logs 表中的一条历史记录。
 * 字段名与 Supabase 列名一致，方便查询结果直接满足该类型。
 */
export interface WeatherLog {
  id: string;
  city: string;
  /** 气温，单位 ℃ */
  temperature: number;
  /** 体感温度，单位 ℃ */
  feels_like: number | null;
  /** 相对湿度，单位 % */
  humidity: number | null;
  /** 风速，单位 km/h */
  wind_speed: number | null;
  wind_dir: string | null;
  /** 空气质量指数。采集时若未取到 AQI，则为 null */
  aqi: number | null;
  condition_text: string | null;
  condition_icon: string | null;
  /** 入库时间，数据库以 UTC 存储 */
  recorded_at: string;
}

/** 供图表使用的历史点。时间已经格式化为北京时间。 */
export interface WeatherHistoryPoint {
  /** 北京时间。24 小时视图为 HH:mm，7 天视图为 MM-DD HH:mm */
  time: string;
  temperature: number;
  feelsLike: number | null;
  humidity: number | null;
  aqi: number | null;
}

/** 实时空气质量。 */
export interface AirQuality {
  /** 空气质量指数 */
  aqi: number;
  /** 空气质量类别，例如“优”“良” */
  category: string;
  /** 观测时间，ISO 8601 */
  observedAt: string;
}

/** 当前生效的气象预警，对应 weather_alerts 的业务字段。 */
export interface WeatherAlert {
  id?: string;
  title: string;
  /** 预警等级，例如“黄色”“橙色”；上游未提供时为 null */
  severity: string | null;
  description: string | null;
  /** 预警生效时间，ISO 8601 */
  effectiveTime: string | null;
}

/** 单项生活指数，例如穿衣、紫外线或洗车。 */
export interface LifeIndex {
  /** 指数名称 */
  name: string;
  /** 指数等级，例如“舒适”“弱”“适宜” */
  category: string;
  /** 面向用户的简短建议 */
  text: string;
}

/** 当天需要展示的三项生活指数。 */
export interface LifeIndices {
  /** 指数对应的日期，北京时间 YYYY-MM-DD */
  date: string;
  clothing: LifeIndex;
  uv: LifeIndex;
  carWash: LifeIndex;
}

/** /api/weather/current 返回给大盘的聚合数据。 */
export interface CurrentWeatherResponse {
  weather: CurrentWeather;
  airQuality: AirQuality | null;
  alerts: WeatherAlert[];
  lifeIndices: LifeIndices | null;
  /** 数据来自 30 分钟内的数据库缓存，还是刚刚请求的和风天气 */
  source: "cache" | "live";
  /** 这条实况写入或观测的时间，ISO 8601 */
  updatedAt: string;
}
