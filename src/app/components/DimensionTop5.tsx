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
}

interface DimensionConfig {
  title: string;
  key: keyof DimensionTop5Props["states"][number];
  format: (v: number) => string;
  color: string;
  bgColor: string;
}

const dimensions: DimensionConfig[] = [
  {
    title: "市场规模",
    key: "tam",
    format: (v) => `$${v.toFixed(1)}B`,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "消费能力",
    key: "income",
    format: (v) => `$${(v / 1000).toFixed(0)}K`,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "增长潜力",
    key: "growth",
    format: (v) => `${v.toFixed(0)}分`,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    title: "竞争友好度",
    key: "competition",
    format: (v) => `${v.toFixed(0)}分`,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
];

const medals = ["🥇", "🥈", "🥉", "4th", "5th"];

export default function DimensionTop5({ states }: DimensionTop5Props) {
  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
      <h3 className="text-lg font-bold text-white mb-1">各维度 Top 5 对比</h3>
      <p className="text-sm text-slate-400 mb-5">
        从市场规模、消费能力、增长潜力、竞争友好度四个维度分别排名
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
              className={`rounded-xl border border-slate-700/50 ${dim.bgColor} p-4`}
            >
              <h4 className={`text-sm font-semibold ${dim.color} mb-3`}>
                {dim.title}
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
                          <span className="text-xs text-slate-500">
                            {medals[idx]}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-slate-300">
                        <span className="font-mono text-slate-400 mr-1">
                          {state.code}
                        </span>
                        {state.name}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${dim.color}`}
                    >
                      {dim.format(state[dim.key] as number)}
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
