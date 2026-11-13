import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const BEIJING_TIME_ZONE = "Asia/Shanghai";

/** 合并 Tailwind 类名，后传入的冲突样式会覆盖先传入的样式。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type BeijingTimePattern = "HH:mm" | "HH:mm:ss" | "MM-DD HH:mm" | "YYYY-MM-DD HH:mm" | "YYYY-MM-DD HH:mm:ss";

/**
 * 把 UTC 或其他可解析时间格式化为北京时间（Asia/Shanghai）。
 * 24 小时历史图使用 HH:mm，7 天历史图使用 MM-DD HH:mm。
 * 无法解析时返回空字符串，避免页面直接抛出异常。
 */
export function formatBeijingTime(
  input: string | number | Date,
  pattern: BeijingTimePattern = "YYYY-MM-DD HH:mm",
) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const hour = value("hour");
  const minute = value("minute");
  const second = value("second");
  const month = value("month");
  const day = value("day");
  const year = value("year");
  const clock = pattern.includes("ss") ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;

  if (pattern === "HH:mm" || pattern === "HH:mm:ss") {
    return clock;
  }

  if (pattern === "MM-DD HH:mm") {
    return `${month}-${day} ${clock}`;
  }

  return `${year}-${month}-${day} ${clock}`;
}
