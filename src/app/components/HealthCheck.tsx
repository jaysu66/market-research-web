"use client";

import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DataSource {
  id: string;
  name: string;
  description: string;
  url: string;
}

interface HealthResult {
  id: string;
  online: boolean;
  responseTime: number;
  checkedAt: string;
}

interface HealthCheckProps {
  /** Override the default data sources to check */
  sources?: DataSource[];
}

// ---------------------------------------------------------------------------
// Default data sources
// ---------------------------------------------------------------------------
const DEFAULT_SOURCES: DataSource[] = [
  {
    id: "ecs",
    name: "ECS API",
    description: "报告生成服务",
    url: "http://8.140.216.113/",
  },
  {
    id: "census",
    name: "Census 代理",
    description: "美国人口普查数据",
    url: "https://jansonhub.shop/api/census-proxy?url=https://api.census.gov/data.json",
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "报告存储服务",
    url: "/api/proxy/reports?product=curtains",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCheckTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function HealthCheck({ sources }: HealthCheckProps) {
  const dataSources = sources ?? DEFAULT_SOURCES;

  const [results, setResults] = useState<Record<string, HealthResult>>({});
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [isCheckingAll, setIsCheckingAll] = useState(false);

  const checkSource = useCallback(
    async (source: DataSource) => {
      setChecking((prev) => new Set(prev).add(source.id));

      const start = performance.now();
      let online = false;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(source.url, {
          method: "GET",
          mode: "cors",
          signal: controller.signal,
        }).catch(() => null);

        clearTimeout(timeout);
        online = res !== null && res.ok;
      } catch {
        online = false;
      }

      const responseTime = Math.round(performance.now() - start);

      setResults((prev) => ({
        ...prev,
        [source.id]: {
          id: source.id,
          online,
          responseTime,
          checkedAt: new Date().toISOString(),
        },
      }));

      setChecking((prev) => {
        const next = new Set(prev);
        next.delete(source.id);
        return next;
      });
    },
    []
  );

  const checkAll = useCallback(async () => {
    setIsCheckingAll(true);
    await Promise.all(dataSources.map((s) => checkSource(s)));
    setIsCheckingAll(false);
  }, [dataSources, checkSource]);

  const onlineCount = Object.values(results).filter((r) => r.online).length;
  const totalChecked = Object.keys(results).length;

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-[#111827]">数据源健康检查</h2>
        {totalChecked > 0 && (
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              onlineCount === totalChecked
                ? "text-[#10b981] bg-[#ecfdf5]"
                : onlineCount > 0
                ? "text-[#f59e0b] bg-[#fffbeb]"
                : "text-[#ef4444] bg-[#fef2f2]"
            }`}
          >
            {onlineCount}/{totalChecked} 在线
          </span>
        )}
      </div>
      <p className="text-sm text-[#6b7280] mb-5">检测各数据源的连接状态和响应速度</p>

      {/* Check all button */}
      <button
        onClick={checkAll}
        disabled={isCheckingAll}
        className="mb-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                   rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
      >
        {isCheckingAll ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            检测中...
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2" />
            </svg>
            一键检测
          </>
        )}
      </button>

      {/* Sources grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {dataSources.map((source) => {
          const result = results[source.id];
          const isChecking = checking.has(source.id);

          return (
            <div
              key={source.id}
              className={`relative p-4 rounded-xl border transition-all ${
                isChecking
                  ? "bg-white border-[#e5e7eb]"
                  : result
                  ? result.online
                    ? "bg-[#ecfdf5] border-[#d1fae5]"
                    : "bg-[#fef2f2] border-[#fee2e2]"
                  : "bg-white border-[#e5e7eb]"
              }`}
            >
              {/* Status dot */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#111827]">
                    {source.name}
                  </h3>
                  <p className="text-xs text-[#9ca3af] mt-0.5">
                    {source.description}
                  </p>
                </div>
                <div className="flex-shrink-0 mt-0.5">
                  {isChecking ? (
                    <div className="w-3 h-3 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                  ) : result ? (
                    <div
                      className={`w-3 h-3 rounded-full ${
                        result.online ? "bg-[#10b981]" : "bg-[#ef4444]"
                      }`}
                    >
                      {result.online && (
                        <div className="w-3 h-3 rounded-full bg-[#10b981] animate-ping opacity-40" />
                      )}
                    </div>
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-[#d1d5db]" />
                  )}
                </div>
              </div>

              {/* Result info */}
              {result && !isChecking && (
                <div className="flex items-center gap-3 text-[11px]">
                  <span
                    className={`font-medium ${
                      result.online ? "text-[#10b981]" : "text-[#ef4444]"
                    }`}
                  >
                    {result.online ? "在线" : "离线"}
                  </span>
                  <span className="text-[#9ca3af]">
                    {result.responseTime}ms
                  </span>
                  <span className="text-[#9ca3af]">
                    {formatCheckTime(result.checkedAt)}
                  </span>
                </div>
              )}

              {!result && !isChecking && (
                <div className="text-[11px] text-[#d1d5db]">未检测</div>
              )}

              {isChecking && (
                <div className="text-[11px] text-[#6366f1]">正在检测...</div>
              )}

              {/* Individual check button */}
              <button
                onClick={() => checkSource(source)}
                disabled={isChecking}
                className="absolute top-3.5 right-10 opacity-0 hover:opacity-100 focus:opacity-100
                           text-[#9ca3af] hover:text-[#6366f1] transition-all disabled:opacity-0"
                title={`检测 ${source.name}`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M1.5 7a5.5 5.5 0 1011 0 5.5 5.5 0 10-11 0" />
                  <path d="M7 3.5V7l2.5 1.5" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
