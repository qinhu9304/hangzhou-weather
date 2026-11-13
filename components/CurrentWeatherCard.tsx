/**
 * 实时温度主读数。
 * 用超细大号数字展示气温，天气现象用暖金色，体感温度作为次级精密读数。
 */
import type { CurrentWeather } from "@/types/weather";

type CurrentWeatherCardProps = {
  weather: CurrentWeather;
};

function formatTemp(value: number | null, digits = 1) {
  return value == null ? "--" : `${value.toFixed(digits)}°`;
}

export function CurrentWeatherCard({ weather }: CurrentWeatherCardProps) {
  return (
    <div className="mt-10">
      <p className="text-8xl font-extralight leading-none tabular-nums tracking-tight text-white sm:text-9xl">
        {Math.round(weather.temperature)}
        <span className="text-5xl font-light text-white/80">°</span>
      </p>
      <p className="mt-4 text-2xl font-light text-[#F5B041]">{weather.conditionText}</p>
      <p className="mt-3 text-sm tabular-nums text-white/50">
        体感 <span className="text-lg font-light text-white">{formatTemp(weather.feelsLike)}</span>
      </p>
    </div>
  );
}
