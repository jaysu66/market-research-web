"use client";

import React from "react";

interface TopStatesCardsProps {
  states: Array<{
    rank: number;
    code: string;
    name: string;
    rating_label: string;
    rating_emoji: string;
    recommended_city: string;
    tam: number;
    competition_density: number;
    overall_score?: number;
  }>;
  onStateClick: (code: string) => void;
  lang?: 'cn' | 'en';
}

const ratingBarColor: Record<string, string> = {
  "强烈推荐": "#16a34a",
  "推荐": "#4ade80",
  "谨慎": "#f97316",
  "不推荐": "#dc2626",
};

const ratingBadgeClass: Record<string, string> = {
  "强烈推荐": "bg-green-100 text-green-700",
  "推荐": "bg-emerald-50 text-emerald-600",
  "谨慎": "bg-orange-100 text-orange-700",
  "不推荐": "bg-red-100 text-red-700",
};

const ratingEnMap: Record<string, string> = {
  '强烈推荐': 'Strong Buy',
  '推荐': 'Buy',
  '谨慎': 'Hold',
  '不推荐': 'Avoid',
};

function getBarColor(label: string): string {
  return ratingBarColor[label] ?? "#9ca3af";
}

function getBadgeClass(label: string): string {
  return ratingBadgeClass[label] ?? "bg-gray-100 text-gray-600";
}

function getScore(state: TopStatesCardsProps["states"][number]): number {
  if (state.overall_score != null && state.overall_score > 0) return state.overall_score;
  // Fallback: derive from rank
  return Math.max(10, Math.min(100, 95 - (state.rank - 1) * 5));
}

export default function TopStatesCards({
  states,
  onStateClick,
  lang = 'cn',
}: TopStatesCardsProps) {
  const t = (cn: string, en: string) => lang === 'cn' ? cn : en;
  const displayRating = (label: string) => lang === 'en' ? (ratingEnMap[label] || label) : label;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
      <h3 className="text-lg font-bold text-zinc-900 mb-1">{t('Top 10 推荐州', 'Top 10 Recommended States')}</h3>
      <p className="text-sm text-zinc-500 mb-5">{t('按综合评分排名，点击查看详情', 'Ranked by overall score. Click for details.')}</p>

      <div className="space-y-3">
        {states.map((state) => {
          const score = getScore(state);
          const barColor = getBarColor(state.rating_label);
          const badgeCls = getBadgeClass(state.rating_label);

          return (
            <button
              key={state.code}
              onClick={() => onStateClick(state.code)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer"
            >
              {/* Rank */}
              <span className="text-zinc-400 font-mono text-sm w-6 text-right flex-shrink-0">
                #{state.rank}
              </span>

              {/* State code + name */}
              <span className="text-zinc-900 font-medium text-sm w-28 text-left flex-shrink-0 truncate">
                <span className="font-mono text-zinc-400 mr-1">{state.code}</span>
                {state.name}
              </span>

              {/* Progress bar */}
              <div className="flex-1 h-3 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>

              {/* Score */}
              <span className="text-zinc-900 font-bold font-mono text-sm w-8 text-right flex-shrink-0">
                {score}
              </span>

              {/* Rating badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${badgeCls}`}>
                {state.rating_emoji} {displayRating(state.rating_label)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
