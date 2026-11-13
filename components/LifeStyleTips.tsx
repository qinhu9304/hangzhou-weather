/**
 * 生活指数卡片。
 * 以克制的双列信息展示穿衣、紫外线和洗车结论，说明文字保持低饱和。
 */
import { CarFront, Shirt, SunMedium } from "lucide-react";

import type { LifeIndex, LifeIndices } from "@/types/weather";

type LifeStyleTipsProps = {
  lifeIndices: LifeIndices | null;
};

const ITEMS: { key: keyof Pick<LifeIndices, "clothing" | "uv" | "carWash">; icon: typeof Shirt }[] = [
  { key: "clothing", icon: Shirt },
  { key: "uv", icon: SunMedium },
  { key: "carWash", icon: CarFront },
];

function Tip({ index, icon: Icon }: { index: LifeIndex; icon: typeof Shirt }) {
  return (
    <div className="border-t border-white/10 py-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs tracking-[0.14em] text-white/50">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
          {index.name}
        </p>
        <p className="text-sm text-[#F5B041]">{index.category}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/50">{index.text}</p>
    </div>
  );
}

export function LifeStyleTips({ lifeIndices }: LifeStyleTipsProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <p className="text-xs tracking-[0.16em] text-white/50">生活指数</p>
      {lifeIndices ? (
        <div className="mt-4">
          {ITEMS.map((item) => (
            <Tip key={item.key} index={lifeIndices[item.key]} icon={item.icon} />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-white/50">生活指数暂时没有返回。</p>
      )}
    </section>
  );
}
