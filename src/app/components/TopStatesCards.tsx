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
  "强烈推荐": "bg-green-100 text-green-700 border-green-300",
  "推荐": "bg-yellow-100 text-yellow-700 border-yellow-300",
  "谨慎": "bg-orange-100 text-orange-700 border-orange-300",
  "不推荐": "bg-red-100 text-red-700 border-red-300",
};

function getBadgeClass(label: string): string {
  return ratingBadgeColor[label] ?? "bg-gray-100 text-gray-600 border-gray-300";
}

export default function TopStatesCards({
  states,
  onStateClick,
}: TopStatesCardsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-gray-900 mb-1">Top 10 推荐州</h3>
      <p className="text-sm text-gray-500 mb-2">
        点击卡片查看详细信息
      </p>
      {states.map((state) => (
        <button
          key={state.code}
          onClick={() => onStateClick(state.code)}
          className="w-full text-left bg-white hover:shadow-lg border border-gray-200 hover:border-gray-300 rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 group"
        >
          <div className="flex items-start gap-3">
            {/* Rank number */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                {state.rank}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-900 font-bold text-sm group-hover:text-indigo-600 transition-colors">
                  {state.rating_emoji} {state.name}
                </span>
                <span className="font-mono text-xs text-gray-400">
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

              <div className="text-xs text-gray-500 mb-2">
                📍 推荐城市: {state.recommended_city}
              </div>

              <div className="flex gap-4 text-xs">
                <div>
                  <span className="text-gray-400">TAM </span>
                  <span className="text-indigo-600 font-bold">
                    ${state.tam.toFixed(1)}B
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">竞争密度 </span>
                  <span className="text-indigo-600 font-bold">
                    {state.competition_density.toFixed(1)} 店/万人
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 text-gray-300 group-hover:text-indigo-500 transition-colors mt-1">
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
