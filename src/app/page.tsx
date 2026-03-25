"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { US_MAP_VIEWBOX, US_STATE_PATHS } from "./us-map-paths";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API = "/api/proxy";

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming",
};

const STATE_CODES = Object.keys(US_STATES);

// US Tile Map positions: [col, row] 1-indexed for CSS grid (12 cols x 8 rows)
const US_MAP_POSITIONS: Record<string, [number, number]> = {
  ME: [12, 1],
  VT: [10, 1], NH: [11, 1],
  WA: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], WI: [7, 2], MI: [8, 2], NY: [10, 2], MA: [11, 2],
  OR: [2, 3], ID: [3, 3], SD: [4, 3], IA: [5, 3], IL: [6, 3], IN: [7, 3], OH: [8, 3], PA: [9, 3], NJ: [10, 3], CT: [11, 3], RI: [12, 3],
  NV: [2, 4], WY: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
  CA: [1, 5], UT: [3, 5], CO: [4, 5], KS: [5, 5], AR: [6, 5], TN: [7, 5], NC: [8, 5], SC: [9, 5],
  AZ: [3, 6], NM: [4, 6], OK: [5, 6], LA: [6, 6], MS: [7, 6], AL: [8, 6], GA: [9, 6],
  TX: [5, 7], FL: [9, 7],
  AK: [1, 8], HI: [2, 8],
};

const CATEGORIES = [
  { key: "curtains", label: "窗帘/窗饰" },
  { key: "blinds", label: "百叶窗" },
  { key: "shutters", label: "卷帘" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ReportFiles {
  "report.html"?: string;
  "report_a.docx"?: string;
  "report_b.docx"?: string;
  "data_pool.json"?: string;
  [key: string]: string | undefined;
}

interface ReportData {
  state_code: string;
  state_name: string;
  product: string;
  timestamp?: string;
  created_at: string;
  files: ReportFiles;
}

interface DataPoolState {
  overall_score?: number;
  market_size_score?: number;
  competition_score?: number;
  operating_cost_score?: number;
  growth_potential_score?: number;
  recommendation?: string;
  population?: string;
  store_count?: number;
  estimated_revenue?: string;
  go_nogo?: string;
}

interface StateInfo {
  code: string;
  name: string;
  report: ReportData | null;
  pool: DataPoolState | null;
  generating: boolean;
  taskId: string | null;
  progress: number;
  step: string;
}

type SortKey = "rank" | "state" | "overall" | "market" | "competition" | "cost" | "growth" | "recommendation";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const [category, setCategory] = useState("curtains");
  const [states, setStates] = useState<Record<string, StateInfo>>({});
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<string | null>(null);
  const [confirmPos, setConfirmPos] = useState({ x: 0, y: 0 });
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [mapView, setMapView] = useState<"tile" | "svg">("tile");
  const pollingRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize state map
  useEffect(() => {
    const init: Record<string, StateInfo> = {};
    for (const code of STATE_CODES) {
      init[code] = {
        code,
        name: US_STATES[code],
        report: null,
        pool: null,
        generating: false,
        taskId: null,
        progress: 0,
        step: "",
      };
    }
    setStates(init);
  }, []);

  // Fetch reports for category
  const fetchReports = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reports?product=${cat}`);
      if (!res.ok) throw new Error("fetch failed");
      const reports: ReportData[] = await res.json();

      // Load data pools for each report
      const poolPromises = reports.map(async (r) => {
        const poolUrl = r.files?.["data_pool.json"];
        if (!poolUrl) return { code: r.state_code, pool: null };
        try {
          const pRes = await fetch(poolUrl);
          if (pRes.ok) {
            const pool = await pRes.json();
            return { code: r.state_code, pool: pool as DataPoolState };
          }
        } catch { /* ignore */ }
        return { code: r.state_code, pool: null };
      });

      const pools = await Promise.all(poolPromises);
      const poolMap: Record<string, DataPoolState | null> = {};
      for (const p of pools) poolMap[p.code] = p.pool;

      setStates((prev) => {
        const next = { ...prev };
        // Reset all non-generating states
        for (const code of STATE_CODES) {
          if (!next[code].generating) {
            next[code] = { ...next[code], report: null, pool: null };
          }
        }
        for (const r of reports) {
          const code = r.state_code;
          if (next[code]) {
            next[code] = {
              ...next[code],
              report: r,
              pool: poolMap[code] ?? null,
              generating: false,
              taskId: null,
              progress: 0,
              step: "",
            };
          }
        }
        return next;
      });
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(category);
  }, [category, fetchReports]);

  // Polling for generating tasks
  useEffect(() => {
    const poll = async () => {
      const codes = Array.from(pollingRef.current);
      if (codes.length === 0) return;

      for (const code of codes) {
        const st = states[code];
        if (!st?.taskId) continue;
        try {
          const res = await fetch(`${API}/status/${st.taskId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === "completed" || data.status === "error") {
              pollingRef.current.delete(code);
              if (data.status === "completed") {
                // Refresh all reports
                setTimeout(() => fetchReports(category), 1000);
              }
              setStates((prev) => ({
                ...prev,
                [code]: {
                  ...prev[code],
                  generating: data.status !== "completed",
                  progress: data.progress ?? 100,
                  step: data.step ?? "",
                },
              }));
            } else {
              setStates((prev) => ({
                ...prev,
                [code]: {
                  ...prev[code],
                  progress: data.progress ?? 0,
                  step: data.step ?? "",
                },
              }));
            }
          }
        } catch { /* ignore */ }
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [states, category, fetchReports]);

  // Start generation for a state
  const startGeneration = async (code: string) => {
    setConfirmState(null);
    setStates((prev) => ({
      ...prev,
      [code]: { ...prev[code], generating: true, progress: 0, step: "collecting" },
    }));

    try {
      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_code: code, product: category }),
      });
      if (res.ok) {
        const data = await res.json();
        setStates((prev) => ({
          ...prev,
          [code]: { ...prev[code], taskId: data.task_id },
        }));
        pollingRef.current.add(code);
      } else {
        setStates((prev) => ({
          ...prev,
          [code]: { ...prev[code], generating: false },
        }));
      }
    } catch {
      setStates((prev) => ({
        ...prev,
        [code]: { ...prev[code], generating: false },
      }));
    }
  };

  // Handle state card click
  const handleCardClick = (code: string, e: React.MouseEvent) => {
    const info = states[code];
    if (!info) return;

    if (info.report) {
      window.open(`/report/${category}/${code}`, "_blank");
      return;
    }

    if (info.generating) return;

    // Show confirm popup near click position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setConfirmPos({
      x: Math.min(rect.left, window.innerWidth - 300),
      y: rect.bottom + 8,
    });
    setConfirmState(code);
  };

  // Computed: researched states for table
  const researchedStates = STATE_CODES
    .filter((code) => states[code]?.report && states[code]?.pool)
    .map((code) => states[code]);

  // Sort
  const sortedStates = [...researchedStates].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "state": return dir * a.name.localeCompare(b.name);
      case "overall": return dir * ((a.pool?.overall_score ?? 0) - (b.pool?.overall_score ?? 0));
      case "market": return dir * ((a.pool?.market_size_score ?? 0) - (b.pool?.market_size_score ?? 0));
      case "competition": return dir * ((a.pool?.competition_score ?? 0) - (b.pool?.competition_score ?? 0));
      case "cost": return dir * ((a.pool?.operating_cost_score ?? 0) - (b.pool?.operating_cost_score ?? 0));
      case "growth": return dir * ((a.pool?.growth_potential_score ?? 0) - (b.pool?.growth_potential_score ?? 0));
      default: return dir * ((a.pool?.overall_score ?? 0) - (b.pool?.overall_score ?? 0));
    }
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Stats
  const researchedCount = STATE_CODES.filter((c) => states[c]?.report).length;
  const generatingCount = STATE_CODES.filter((c) => states[c]?.generating).length;
  const recommendCount = researchedStates.filter(
    (s) => s.pool?.recommendation?.includes("推荐") || s.pool?.go_nogo?.toLowerCase() === "go"
  ).length;

  const lastUpdate = researchedStates.length > 0
    ? researchedStates.reduce((latest, s) => {
        const d = s.report?.created_at;
        return d && d > latest ? d : latest;
      }, "")
    : "";

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e7eb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                   style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                M
              </div>
              <span className="font-semibold text-[#111827] text-base hidden sm:inline">MarketScope</span>
            </div>
            <div className="h-6 w-px bg-[#e5e7eb] hidden sm:block" />
            {/* Category Tabs */}
            <div className="flex gap-1 bg-[#f3f4f6] p-1 rounded-full">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`tab ${category === cat.key ? "tab-active" : ""}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <a href="/workspace" className="btn-secondary text-sm">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
            工作台
          </a>
        </div>
      </header>

      {/* ---- Main ---- */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {/* Section: Executive Summary */}
            <section className="mb-10">
              <div className="card p-6" style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #e0e7ff 100%)" }}>
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <SummaryCard label="已调研" value={`${researchedCount}/50`} sub="州" color="#6366f1" />
                  <SummaryCard label="推荐进入" value={`${recommendCount}`} sub="州" color="#10b981" />
                  <SummaryCard
                    label="最高评分"
                    value={
                      researchedStates.length > 0
                        ? researchedStates.reduce((best, s) => ((s.pool?.overall_score ?? 0) > (best.pool?.overall_score ?? 0) ? s : best), researchedStates[0]).code
                        : "--"
                    }
                    sub={
                      researchedStates.length > 0
                        ? `${researchedStates.reduce((best, s) => ((s.pool?.overall_score ?? 0) > (best.pool?.overall_score ?? 0) ? s : best), researchedStates[0]).pool?.overall_score ?? 0}分`
                        : ""
                    }
                    color="#8b5cf6"
                  />
                  <SummaryCard
                    label="平均分"
                    value={
                      researchedStates.length > 0
                        ? `${Math.round(researchedStates.reduce((sum, s) => sum + (s.pool?.overall_score ?? 0), 0) / researchedStates.length)}`
                        : "--"
                    }
                    sub="分"
                    color="#f59e0b"
                  />
                </div>
                {/* AI Summary */}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 text-sm text-[#374151] leading-relaxed">
                  <span className="text-[#6366f1] font-semibold">AI 分析摘要：</span>
                  {researchedStates.length === 0
                    ? "尚未开始调研，点击下方州卡片开始首次调研。"
                    : (() => {
                        const topState = researchedStates.reduce((best, s) =>
                          (s.pool?.overall_score ?? 0) > (best.pool?.overall_score ?? 0) ? s : best,
                          researchedStates[0]
                        );
                        const goStates = researchedStates.filter(
                          (s) => s.pool?.recommendation?.includes("推荐") || s.pool?.go_nogo?.toLowerCase() === "go"
                        );
                        const goNames = goStates.slice(0, 5).map((s) => s.name).join("、");
                        const marketScore = topState.pool?.market_size_score ?? 0;
                        const marketLabel = marketScore >= 70 ? "大" : marketScore >= 40 ? "中" : "小";
                        const compScore = topState.pool?.competition_score ?? 0;
                        const compLabel = compScore >= 70 ? "弱" : compScore >= 40 ? "适中" : "强";
                        return `基于对 ${researchedStates.length} 个州的深度调研分析${goNames ? `，推荐优先进入 ${goNames}` : ""}。${topState.name} 综合评分最高（${topState.pool?.overall_score ?? 0}分），市场规模${marketLabel}且竞争${compLabel}。`;
                      })()
                  }
                </div>
              </div>
            </section>

            {/* Section: US Map */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#111827]">地理分布</h2>
                <div className="map-view-toggle">
                  <button
                    className={mapView === "tile" ? "active" : ""}
                    onClick={() => setMapView("tile")}
                  >
                    方块
                  </button>
                  <button
                    className={mapView === "svg" ? "active" : ""}
                    onClick={() => setMapView("svg")}
                  >
                    地图
                  </button>
                </div>
              </div>
              <div className="card p-6">
                {mapView === "tile" ? (
                  <>
                    <div className="us-tile-map">
                      {STATE_CODES.map((code) => {
                        const pos = US_MAP_POSITIONS[code];
                        if (!pos) return null;
                        const info = states[code];
                        const hasReport = !!info?.report;
                        const isGenerating = info?.generating;
                        const score = info?.pool?.overall_score;
                        const rec = info?.pool?.recommendation ?? info?.pool?.go_nogo ?? "";

                        let bgColor = "#f3f4f6";
                        if (hasReport) {
                          if (rec.includes("推荐") || rec.toLowerCase() === "go") bgColor = "#10b981";
                          else if (rec.includes("谨慎") || rec.includes("观望")) bgColor = "#f59e0b";
                          else if (rec.includes("不推荐") || rec.toLowerCase().includes("no")) bgColor = "#ef4444";
                          else bgColor = "#6366f1";
                        }
                        if (isGenerating) bgColor = "#c7d2fe";

                        return (
                          <div
                            key={code}
                            className="map-tile"
                            style={{
                              gridColumn: pos[0],
                              gridRow: pos[1],
                              backgroundColor: bgColor,
                            }}
                            onClick={(e) => handleCardClick(code, e)}
                            title={`${US_STATES[code]} ${score ? `(${score}分)` : hasReport ? "(已调研)" : "(未调研)"}`}
                          >
                            <span className={`text-[10px] font-bold ${hasReport ? "text-white" : "text-[#9ca3af]"}`}>
                              {code}
                            </span>
                            {hasReport && score !== undefined && (
                              <span className="text-[8px] text-white/80">{score}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <SvgMapView
                    states={states}
                    onCardClick={handleCardClick}
                  />
                )}
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 text-xs text-[#6b7280]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#10b981]"></span> 推荐进入</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#f59e0b]"></span> 谨慎评估</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#ef4444]"></span> 不推荐</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#6366f1]"></span> 已调研</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#c7d2fe]"></span> 生成中</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#e5e7eb]"></span> 未调研</span>
                </div>
              </div>
            </section>

            {/* Section: 50-State Grid */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#111827]">美国50州调研总览</h2>
                  <p className="text-sm text-[#6b7280] mt-1">
                    点击已调研州查看报告 / 点击未调研州发起调研
                  </p>
                </div>
                {generatingCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-[#6366f1]">
                    <div className="w-4 h-4 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                    {generatingCount} 个州正在生成中
                  </div>
                )}
              </div>

              <div className="state-grid grid gap-2.5" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                {STATE_CODES.map((code) => {
                  const info = states[code];
                  if (!info) return null;
                  const hasReport = !!info.report;
                  const isGenerating = info.generating;
                  const score = info.pool?.overall_score;
                  const rec = info.pool?.recommendation ?? info.pool?.go_nogo ?? "";
                  const isRecommend = rec.includes("推荐") || rec.toLowerCase() === "go";
                  const isCaution = rec.includes("谨慎") || rec.includes("观望");
                  const isNotRecommend = rec.includes("不推荐") || rec.toLowerCase() === "no-go" || rec.toLowerCase() === "nogo";

                  let barColor = "#10b981"; // green default
                  if (isCaution) barColor = "#f59e0b";
                  if (isNotRecommend) barColor = "#ef4444";

                  return (
                    <div
                      key={code}
                      onClick={(e) => handleCardClick(code, e)}
                      className={`
                        relative flex flex-col items-center justify-center py-3 px-2 transition-all cursor-pointer
                        ${hasReport ? "state-card" : isGenerating ? "state-card state-card-generating" : "state-card state-card-empty"}
                      `}
                      style={{ minHeight: 80 }}
                    >
                      {/* Left bar for researched states */}
                      {hasReport && (
                        <div className="state-card-bar" style={{ backgroundColor: barColor }} />
                      )}

                      <span className={`text-base font-bold leading-none ${
                        hasReport ? "text-[#111827]" : isGenerating ? "text-[#6366f1]" : "text-[#9ca3af]"
                      }`}>
                        {code}
                      </span>
                      <span className="text-[10px] text-[#9ca3af] mt-1 leading-tight truncate w-full text-center">
                        {US_STATES[code]}
                      </span>

                      {hasReport && score !== undefined && (
                        <span className="text-xs font-semibold mt-1.5" style={{ color: barColor }}>
                          {score}
                        </span>
                      )}

                      {isGenerating && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <div className="w-3 h-3 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] text-[#6366f1]">生成中</span>
                        </div>
                      )}

                      {!hasReport && !isGenerating && (
                        <span className="text-[10px] text-transparent group-hover:text-[#9ca3af] mt-1.5 opacity-0 hover:opacity-100 transition-opacity">
                          点击生成
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Confirm Popup */}
            {confirmState && (
              <>
                <div className="confirm-popup-overlay" onClick={() => setConfirmState(null)} />
                <div
                  className="confirm-popup"
                  style={{ left: confirmPos.x, top: confirmPos.y }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base font-bold">{confirmState}</span>
                    <span className="text-sm text-[#6b7280]">{US_STATES[confirmState]}</span>
                  </div>
                  <p className="text-sm text-[#6b7280] mb-4">
                    确认为该州生成 <strong className="text-[#111827]">{CATEGORIES.find(c => c.key === category)?.label}</strong> 市场调研报告？
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setConfirmState(null)} className="btn-ghost text-sm">
                      取消
                    </button>
                    <button onClick={() => startGeneration(confirmState)} className="btn-primary text-sm">
                      确认生成
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Section: Ranking Table */}
            {sortedStates.length > 0 && (
              <section className="mb-12">
                <h2 className="text-xl font-bold text-[#111827] mb-6">州排名</h2>
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr className="bg-[#f9fafb]">
                          <th className="w-16">#</th>
                          <SortHeader label="州" sortKey="state" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <SortHeader label="综合评分" sortKey="overall" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <SortHeader label="市场规模" sortKey="market" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <SortHeader label="竞争强度" sortKey="competition" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <SortHeader label="运营成本" sortKey="cost" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <SortHeader label="增长潜力" sortKey="growth" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <th>建议</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedStates.map((s, i) => {
                          const p = s.pool;
                          const rec = p?.recommendation ?? p?.go_nogo ?? "--";
                          const isGo = rec.includes("推荐") || rec.toLowerCase() === "go";
                          const isNo = rec.includes("不推荐") || rec.toLowerCase().includes("no");
                          return (
                            <tr
                              key={s.code}
                              className="cursor-pointer"
                              onClick={() => window.open(`/report/${category}/${s.code}`, "_blank")}
                            >
                              <td className="text-[#9ca3af] font-medium">{i + 1}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#111827]">{s.code}</span>
                                  <span className="text-[#6b7280] text-xs">{s.name}</span>
                                </div>
                              </td>
                              <td><ScoreCell value={p?.overall_score} /></td>
                              <td><ScoreCell value={p?.market_size_score} /></td>
                              <td><ScoreCell value={p?.competition_score} /></td>
                              <td><ScoreCell value={p?.operating_cost_score} /></td>
                              <td><ScoreCell value={p?.growth_potential_score} /></td>
                              <td>
                                <span className={`badge ${isGo ? "badge-success" : isNo ? "badge-danger" : "badge-warning"}`}>
                                  {rec}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Footer Stats */}
            <footer className="text-center text-sm text-[#9ca3af] py-6 border-t border-[#e5e7eb]">
              已调研 <span className="text-[#111827] font-medium">{researchedCount}/50</span> 州
              {recommendCount > 0 && (
                <> &middot; 推荐进入 <span className="text-[#10b981] font-medium">{recommendCount}</span> 州</>
              )}
              {lastUpdate && (
                <> &middot; 数据更新于 {new Date(lastUpdate).toLocaleDateString("zh-CN")}</>
              )}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 text-center">
      <p className="text-xs text-[#6b7280] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-[#9ca3af]">{sub}</p>
    </div>
  );
}

function SortHeader({
  label,
  sortKey: key,
  current,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  const active = current === key;
  return (
    <th onClick={() => onClick(key)} className={active ? "text-[#6366f1]" : ""}>
      <div className="flex items-center gap-1">
        {label}
        {active && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            {dir === "asc"
              ? <path d="M6 3L10 8H2L6 3Z" />
              : <path d="M6 9L2 4H10L6 9Z" />
            }
          </svg>
        )}
      </div>
    </th>
  );
}

function ScoreCell({ value }: { value?: number }) {
  if (value === undefined || value === null) {
    return <span className="text-[#9ca3af]">--</span>;
  }

  let color = "#10b981";
  if (value < 40) color = "#ef4444";
  else if (value < 60) color = "#f59e0b";
  else if (value < 75) color = "#6366f1";

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold w-8" style={{ color }}>{value}</span>
      <div className="score-bar flex-1">
        <div className="score-bar-fill" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Map View
// ---------------------------------------------------------------------------
function getStateFillColor(info: StateInfo | undefined): string {
  if (!info) return "#e5e7eb";
  if (info.generating) return "#c7d2fe";
  if (!info.report) return "#e5e7eb";
  const rec = info.pool?.recommendation ?? info.pool?.go_nogo ?? "";
  if (rec.includes("推荐") || rec.toLowerCase() === "go") return "#10b981";
  if (rec.includes("谨慎") || rec.includes("观望")) return "#f59e0b";
  if (rec.includes("不推荐") || rec.toLowerCase().includes("no")) return "#ef4444";
  return "#6366f1";
}

function getRecommendationLabel(info: StateInfo): string {
  if (!info.report) return "未调研";
  const rec = info.pool?.recommendation ?? info.pool?.go_nogo ?? "";
  if (rec.includes("推荐") || rec.toLowerCase() === "go") return "\u2705 推荐进入";
  if (rec.includes("谨慎") || rec.includes("观望")) return "\u26a0\ufe0f 谨慎评估";
  if (rec.includes("不推荐") || rec.toLowerCase().includes("no")) return "\u274c 不推荐";
  return "\ud83d\udcca 已调研";
}

function SvgMapView({
  states,
  onCardClick,
}: {
  states: Record<string, StateInfo>;
  onCardClick: (code: string, e: React.MouseEvent) => void;
}) {
  const [tooltip, setTooltip] = useState<{
    code: string;
    x: number;
    y: number;
  } | null>(null);

  const handleMouseEnter = (code: string, e: React.MouseEvent) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    setTooltip({
      code,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const tooltipInfo = tooltip ? states[tooltip.code] : null;

  return (
    <div className="svg-map-container">
      <svg viewBox={US_MAP_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
        {Object.entries(US_STATE_PATHS).map(([code, pathD]) => {
          const info = states[code];
          const fillColor = getStateFillColor(info);
          const isGenerating = info?.generating;
          return (
            <path
              key={code}
              d={pathD}
              fill={fillColor}
              className={isGenerating ? "svg-map-generating" : ""}
              onMouseEnter={(e) => handleMouseEnter(code, e)}
              onMouseLeave={handleMouseLeave}
              onClick={(e) => onCardClick(code, e as unknown as React.MouseEvent)}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && tooltipInfo && (
        <div
          className="map-tooltip"
          style={{
            left: Math.min(tooltip.x - 90, window.innerWidth - 200),
            top: Math.max(tooltip.y - 100, 10),
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-[#111827] text-base">{US_STATES[tooltip.code]}</span>
            <span className="text-xs text-[#9ca3af]">({tooltip.code})</span>
          </div>
          {tooltipInfo.report ? (
            <>
              {tooltipInfo.pool?.overall_score !== undefined && (
                <div className="text-sm text-[#6b7280] mb-1">
                  综合评分: <span className="font-semibold text-[#111827]">{tooltipInfo.pool.overall_score}</span>
                </div>
              )}
              <div className="text-sm mb-1.5">{getRecommendationLabel(tooltipInfo)}</div>
              <div className="text-xs text-[#6366f1] font-medium">点击查看报告 →</div>
            </>
          ) : tooltipInfo.generating ? (
            <div className="flex items-center gap-1.5 text-sm text-[#6366f1]">
              <div className="w-3 h-3 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
              报告生成中...
            </div>
          ) : (
            <div className="text-sm text-[#9ca3af]">点击生成报告</div>
          )}
        </div>
      )}
    </div>
  );
}
