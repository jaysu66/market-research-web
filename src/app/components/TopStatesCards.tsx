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
  }>;
  onStateClick: (code: string) => void;
}

const ratingBadgeColor: Record<string, string> = {
  "强烈推荐": "bg-green-500/20 text-green-400 border-green-500/30",
  "推荐": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "一般": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "不推荐": "bg-red-500/20 text-red-400 border-red-500/30",
};

function getBadgeClass(label: string): string {
  return ratingBadgeColor[label] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

export default function TopStatesCards({
  states,
  onStateClick,
}: TopStatesCardsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-white mb-1">Top 10 推荐州</h3>
      <p className="text-sm text-slate-400 mb-2">
        点击卡片查看详细信息
      </p>
      {states.map((state) => (
        <button
          key={state.code}
          onClick={() => onStateClick(state.code)}
          className="w-full text-left bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600/60 rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/5 group"
        >
          <div className="flex items-start gap-3">
            {/* Rank number */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <span
                className="text-sm font-bold"
                style={{ color: "#6366f1" }}
              >
                #{state.rank}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-semibold text-sm group-hover:text-indigo-300 transition-colors">
                  {state.rating_emoji} {state.name}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {state.code}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${getBadgeClass(
                    state.rating_label
                  )}`}
                >
                  {state.rating_label}
                </span>
              </div>

              <div className="text-xs text-slate-400 mb-2">
                📍 推荐城市: {state.recommended_city}
              </div>

              <div className="flex gap-4 text-xs">
                <div>
                  <span className="text-slate-500">TAM </span>
                  <span className="text-blue-400 font-semibold">
                    ${state.tam.toFixed(1)}B
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">竞争密度 </span>
                  <span className="text-emerald-400 font-semibold">
                    {state.competition_density.toFixed(1)} 店/万人
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 text-slate-600 group-hover:text-indigo-400 transition-colors mt-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
