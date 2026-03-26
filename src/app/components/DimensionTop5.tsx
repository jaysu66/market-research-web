"use client";

import React from "react";

interface DimensionTop5Props {
  states: Array<{
    code: string;
    name: string;
    tam: number;
    income: number;
    growth: number;
    competition: number;
  }>;
  lang?: 'cn' | 'en';
}

interface DimensionConfig {
  title: string;
  titleEn: string;
  key: keyof DimensionTop5Props["states"][number];
  format: (v: number, lang: string) => string;
  borderColor: string;
  titleColor: string;
}

const dimensions: DimensionConfig[] = [
  {
    title: "市场规模",
    titleEn: "Market Size",
    key: "tam",
    format: (v) => `$${v.toFixed(1)}B`,
    borderColor: "border-l-blue-500",
    titleColor: "text-blue-700",
  },
  {
    title: "消费能力",
    titleEn: "Income",
    key: "income",
    format: (v) => `$${(v / 1000).toFixed(0)}K`,
    borderColor: "border-l-emerald-500",
    titleColor: "text-emerald-700",
  },
  {
    title: "增长潜力",
    titleEn: "Growth",
    key: "growth",
    format: (v, lang) => `${v.toFixed(0)}${lang === 'cn' ? '分' : 'pts'}`,
    borderColor: "border-l-amber-500",
    titleColor: "text-amber-700",
  },
  {
    title: "竞争友好度",
    titleEn: "Competition",
    key: "competition",
    format: (v, lang) => `${v.toFixed(0)}${lang === 'cn' ? '分' : 'pts'}`,
    borderColor: "border-l-sky-500",
    titleColor: "text-sky-700",
  },
];

const medals = ["🥇", "🥈", "🥉", "4th", "5th"];

export default function DimensionTop5({ states, lang = 'cn' }: DimensionTop5Props) {
  const t = (cn: string, en: string) => lang === 'cn' ? cn : en;

  return (
    <div>
      <h3 className="text-lg font-bold text-zinc-900 mb-1">{t('各维度 Top 5 对比', 'Dimension Top 5')}</h3>
      <p className="text-sm text-zinc-500 mb-5">
        {t(
          '从市场规模、消费能力、增长潜力、竞争友好度四个维度分别排名',
          'Ranked across market size, income, growth potential, and competition'
        )}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dimensions.map((dim) => {
          const sorted = [...states]
            .sort(
              (a, b) =>
                (b[dim.key] as number) - (a[dim.key] as number)
            )
            .slice(0, 5);

          return (
            <div
              key={dim.key}
              className={`bg-white border border-zinc-200 rounded-xl shadow-sm border-l-4 ${dim.borderColor} p-4`}
            >
              <h4 className={`text-sm font-semibold ${dim.titleColor} mb-3`}>
                {lang === 'cn' ? dim.title : dim.titleEn}
              </h4>
              <ul className="space-y-2">
                {sorted.map((state, idx) => (
                  <li
                    key={state.code}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base w-6 text-center">
                        {idx < 3 ? (
                          medals[idx]
                        ) : (
                          <span className="text-xs text-zinc-500">
                            {medals[idx]}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-zinc-600">
                        <span className="font-mono text-zinc-400 mr-1">
                          {state.code}
                        </span>
                        {state.name}
                      </span>
                    </div>
                    <span className="text-sm text-zinc-900 font-bold">
                      {dim.format(state[dim.key] as number, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
