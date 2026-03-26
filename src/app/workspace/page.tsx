"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
const TOP10 = ["CA", "TX", "NY", "FL", "IL", "PA", "OH", "GA", "NC", "MI"];

const DEFAULT_CATEGORIES = [
  { key: "curtains", label: "窗帘/窗饰" },
];

function loadCategories(): { key: string; label: string }[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const saved = localStorage.getItem("market_categories");
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return DEFAULT_CATEGORIES;
}

function saveCategories(cats: { key: string; label: string }[]) {
  try {
    localStorage.setItem("market_categories", JSON.stringify(cats));
  } catch { /* ignore */ }
}

const COST_PER_STATE = 0.35;
const MINS_PER_STATE = 2.5;

// Task timeout: 30 minutes in milliseconds
const TASK_TIMEOUT_MS = 30 * 60 * 1000;
// Max consecutive 404s before auto-cleaning a task
const MAX_404_COUNT = 3;

// Data sources that appear during report generation
const DATA_SOURCES = [
  { key: "census", label: "Census" },
  { key: "fred", label: "FRED" },
  { key: "bls", label: "BLS" },
  { key: "google_trends", label: "Trends" },
  { key: "ai", label: "AI" },
];

// Map stage number to which data sources are relevant
function getSourceStatusFromStep(step: string, progress: number): Record<string, "done" | "active" | "pending"> {
  const result: Record<string, "done" | "active" | "pending"> = {};
  DATA_SOURCES.forEach((s) => (result[s.key] = "pending"));

  // Parse stage from step text like "Stage 2/5: ..."
  const stageMatch = step.match(/Stage\s+(\d+)\/(\d+)/i);
  const stageNum = stageMatch ? parseInt(stageMatch[1], 10) : 0;

  if (stageNum >= 1) {
    // Stage 1: collecting API data (Census, FRED, BLS)
    if (stageNum === 1) {
      result["census"] = "active";
      result["fred"] = "active";
      result["bls"] = "active";
    } else {
      result["census"] = "done";
      result["fred"] = "done";
      result["bls"] = "done";
    }
  }
  if (stageNum >= 2) {
    // Stage 2: Google Trends
    if (stageNum === 2) {
      result["google_trends"] = "active";
    } else {
      result["google_trends"] = "done";
    }
  }
  if (stageNum >= 3) {
    // Stage 3: analyzing data (no new source)
  }
  if (stageNum >= 4) {
    // Stage 4: AI generation
    if (stageNum === 4) {
      result["ai"] = "active";
    } else {
      result["ai"] = "done";
    }
  }
  if (stageNum >= 5) {
    // Stage 5: exporting / finalizing
    result["ai"] = "done";
  }

  // If completed (progress === 100), mark all done
  if (progress >= 100) {
    DATA_SOURCES.forEach((s) => (result[s.key] = "done"));
  }

  return result;
}

// Format elapsed time as "Xm Ys"
function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

// Parse the 5-stage pipeline into a checklist
function parseStages(currentStep: string, progress: number): { label: string; status: "done" | "active" | "pending" }[] {
  const stages = [
    { label: "采集 API 数据", stageNum: 1 },
    { label: "采集搜索趋势", stageNum: 2 },
    { label: "数据分析处理", stageNum: 3 },
    { label: "AI 生成报告", stageNum: 4 },
    { label: "导出报告文件", stageNum: 5 },
  ];

  const stageMatch = currentStep.match(/Stage\s+(\d+)\/(\d+)/i);
  const currentStage = stageMatch ? parseInt(stageMatch[1], 10) : 0;

  return stages.map((s) => {
    if (progress >= 100) return { ...s, status: "done" as const };
    if (s.stageNum < currentStage) return { ...s, status: "done" as const };
    if (s.stageNum === currentStage) return { ...s, status: "active" as const };
    return { ...s, status: "pending" as const };
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface QueueTask {
  stateCode: string;
  taskId: string;
  status: "pending" | "running" | "completed" | "error" | "expired" | "timeout";
  progress: number;
  step: string;
  startedAt: number;        // timestamp when task started
  notFoundCount: number;    // consecutive 404 count
}

interface CategoryInfo {
  key: string;
  label: string;
  reportCount: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function WorkspacePage() {
  const [category, setCategory] = useState("curtains");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<QueueTask[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [catList, setCatList] = useState(DEFAULT_CATEGORIES);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved categories on mount
  useEffect(() => {
    setCatList(loadCategories());
  }, []);

  // Tick every second for elapsed time display
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Add new category
  const addCategory = () => {
    if (!newCatLabel.trim()) return;
    // Key must be ASCII-only to work as URL path and match backend product names
    // Chinese input like "地毯" needs manual English key - prompt user or use pinyin
    const raw = newCatLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    // If key is empty (all Chinese), use a common mapping
    const CHINESE_TO_KEY: Record<string, string> = {
      "地毯": "carpet", "窗帘": "curtains", "墙纸": "wallpaper", "壁纸": "wallpaper",
      "灯具": "lighting", "家具": "furniture", "瓷砖": "tiles", "地板": "flooring",
      "卫浴": "bathroom", "厨具": "kitchen", "油漆": "paint", "五金": "hardware",
    };
    const key = raw || CHINESE_TO_KEY[newCatLabel.trim()] || `cat_${Date.now()}`;
    if (catList.some((c) => c.key === key)) return;
    const updated = [...catList, { key, label: newCatLabel.trim() }];
    setCatList(updated);
    saveCategories(updated);
    setNewCatLabel("");
    setShowAddModal(false);
    fetchCategories();
  };

  // Delete category
  const deleteCategory = (key: string) => {
    const updated = catList.filter((c) => c.key !== key);
    setCatList(updated);
    saveCategories(updated);
    setDeleteConfirm(null);
    if (category === key && updated.length > 0) setCategory(updated[0].key);
    fetchCategories();
  };

  // Fetch category report counts
  const fetchCategories = useCallback(async () => {
    const currentCats = loadCategories();
    const results: CategoryInfo[] = [];
    for (const cat of currentCats) {
      try {
        const res = await fetch(`${API}/reports?product=${cat.key}`);
        if (res.ok) {
          const data = await res.json();
          results.push({ ...cat, reportCount: Array.isArray(data) ? data.length : 0 });
        } else {
          results.push({ ...cat, reportCount: 0 });
        }
      } catch {
        results.push({ ...cat, reportCount: 0 });
      }
    }
    setCategories(results);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Toggle selection
  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(STATE_CODES));
  const selectTop10 = () => setSelected(new Set(TOP10));
  const clearAll = () => setSelected(new Set());

  // Start batch generation
  const startBatch = async () => {
    if (selected.size === 0) return;
    setIsBatchRunning(true);

    const codes = Array.from(selected);
    const newQueue: QueueTask[] = [];
    const startTime = Date.now();

    for (const code of codes) {
      try {
        const res = await fetch(`${API}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state_code: code, product: category }),
        });
        if (res.ok) {
          const data = await res.json();
          newQueue.push({
            stateCode: code,
            taskId: data.task_id,
            status: "running",
            progress: 0,
            step: "collecting",
            startedAt: startTime,
            notFoundCount: 0,
          });
        } else {
          newQueue.push({
            stateCode: code,
            taskId: "",
            status: "error",
            progress: 0,
            step: "",
            startedAt: startTime,
            notFoundCount: 0,
          });
        }
      } catch {
        newQueue.push({
          stateCode: code,
          taskId: "",
          status: "error",
          progress: 0,
          step: "",
          startedAt: startTime,
          notFoundCount: 0,
        });
      }
    }

    setQueue(newQueue);
    setSelected(new Set());
  };

  // Check if a task is in a terminal state
  const isTerminal = (status: string) =>
    status === "completed" || status === "error" || status === "expired" || status === "timeout";

  // Poll queue
  useEffect(() => {
    if (queue.length === 0 || queue.every((t) => isTerminal(t.status))) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (queue.length > 0 && queue.every((t) => isTerminal(t.status))) {
        setIsBatchRunning(false);
        fetchCategories();
      }
      return;
    }

    const poll = async () => {
      // Read current queue snapshot outside setState to avoid nested setState calls
      let snapshot: QueueTask[] = [];
      setQueue((prev) => { snapshot = prev; return prev; });

      const running = snapshot.filter((t) => t.status === "running" && t.taskId);
      if (running.length === 0) return;

      for (const t of running) {
        // Check for timeout (30 minutes)
        if (Date.now() - t.startedAt > TASK_TIMEOUT_MS) {
          setQueue((cur) =>
            cur.map((item) =>
              item.stateCode === t.stateCode
                ? { ...item, status: "timeout" as const, step: "任务超时（超过30分钟）" }
                : item
            )
          );
          continue;
        }

        fetch(`${API}/status/${t.taskId}`)
          .then((res) => {
            if (res.status === 404) {
              // Handle 404: increment counter, expire if threshold reached
              setQueue((cur) =>
                cur.map((item) => {
                  if (item.stateCode !== t.stateCode) return item;
                  const newCount = item.notFoundCount + 1;
                  if (newCount >= MAX_404_COUNT) {
                    return {
                      ...item,
                      status: "expired" as const,
                      step: "任务已失效（服务端无此任务）",
                      notFoundCount: newCount,
                    };
                  }
                  return { ...item, notFoundCount: newCount };
                })
              );
              return null;
            }
            if (!res.ok) return null;
            return res.json();
          })
          .then((data) => {
            if (!data) return;
            setQueue((cur) =>
              cur.map((item) =>
                item.stateCode === t.stateCode
                  ? {
                      ...item,
                      progress: data.progress ?? 0,
                      step: data.step ?? "",
                      status: data.status === "completed" ? "completed" : data.status === "error" ? "error" : "running",
                      notFoundCount: 0, // reset on successful response
                    }
                  : item
              )
            );
          })
          .catch(() => { /* ignore network errors */ });
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    poll();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [queue, fetchCategories]);

  const estMinutes = Math.ceil(selected.size * MINS_PER_STATE);
  const estCost = (selected.size * COST_PER_STATE).toFixed(2);

  const completedInQueue = queue.filter((t) => t.status === "completed").length;
  const totalInQueue = queue.length;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#e5e7eb]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 3L5 8l5 5" />
            </svg>
            返回总览
          </a>
          <div className="h-5 w-px bg-[#e5e7eb]" />
          <h1 className="text-sm font-semibold text-[#111827]">工作台</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Section 1: Batch Generation */}
        <section className="card p-6">
          <h2 className="text-lg font-bold text-[#111827] mb-1">批量生成</h2>
          <p className="text-sm text-[#6b7280] mb-5">选择品类和目标州，一键批量生成调研报告</p>

          {/* Category select */}
          <div className="mb-5">
            <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wide mb-2 block">品类选择</label>
            <div className="flex flex-wrap gap-2">
              {catList.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                    category === cat.key
                      ? "bg-[#eef2ff] border-[#6366f1] text-[#6366f1] font-medium"
                      : "bg-white border-[#e5e7eb] text-[#6b7280] hover:border-[#d1d5db]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={selectAll} className="btn-ghost text-xs">全选 50 州</button>
            <button onClick={selectTop10} className="btn-ghost text-xs">Top 10 大州</button>
            <button onClick={clearAll} className="btn-ghost text-xs">清空</button>
          </div>

          {/* States grid */}
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 mb-6">
            {STATE_CODES.map((code) => {
              const isSelected = selected.has(code);
              return (
                <button
                  key={code}
                  onClick={() => toggle(code)}
                  className={`flex flex-col items-center py-2 px-1 rounded-lg border text-center transition-all text-xs ${
                    isSelected
                      ? "bg-[#eef2ff] border-[#6366f1] text-[#6366f1]"
                      : "bg-white border-[#e5e7eb] text-[#6b7280] hover:border-[#d1d5db]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(code)}
                    className="custom-checkbox mb-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="font-bold text-[11px] leading-none">{code}</span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#e5e7eb] pt-4">
            <div className="text-sm text-[#6b7280] flex flex-wrap gap-x-4 gap-y-1">
              <span>已选 <strong className="text-[#111827]">{selected.size}</strong> 州</span>
              {selected.size > 0 && (
                <>
                  <span>预计 ~{estMinutes} 分钟</span>
                  <span>~${estCost}</span>
                </>
              )}
            </div>
            <button
              onClick={startBatch}
              disabled={selected.size === 0 || isBatchRunning}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isBatchRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  生成中...
                </>
              ) : (
                <>开始批量生成</>
              )}
            </button>
          </div>
        </section>

        {/* Section 2: Generation Queue */}
        {queue.length > 0 && (
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#111827]">生成队列</h2>
              <span className="text-sm text-[#6b7280]">
                {completedInQueue}/{totalInQueue} 完成
              </span>
            </div>

            {/* Overall progress */}
            <div className="progress-bar mb-5">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${totalInQueue > 0 ? (completedInQueue / totalInQueue) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                }}
              />
            </div>

            <div className="space-y-3">
              {queue.map((task) => {
                const elapsed = now - task.startedAt;
                const sourceStatus = getSourceStatusFromStep(task.step, task.progress);
                const stages = parseStages(task.step, task.progress);

                return (
                  <div
                    key={task.stateCode}
                    className={`p-4 rounded-lg border ${
                      task.status === "completed"
                        ? "bg-[#ecfdf5] border-[#d1fae5]"
                        : task.status === "error"
                        ? "bg-[#fef2f2] border-[#fee2e2]"
                        : task.status === "expired"
                        ? "bg-[#fffbeb] border-[#fde68a]"
                        : task.status === "timeout"
                        ? "bg-[#fffbeb] border-[#fde68a]"
                        : "bg-white border-[#e5e7eb]"
                    }`}
                  >
                    {/* Top row: status icon, state info, progress */}
                    <div className="flex items-center gap-4">
                      {/* Status icon */}
                      <div className="flex-shrink-0">
                        {task.status === "completed" ? (
                          <div className="w-6 h-6 rounded-full bg-[#10b981] flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          </div>
                        ) : task.status === "error" ? (
                          <div className="w-6 h-6 rounded-full bg-[#ef4444] flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                              <path d="M3 3l6 6M9 3l-6 6" />
                            </svg>
                          </div>
                        ) : task.status === "expired" || task.status === "timeout" ? (
                          <div className="w-6 h-6 rounded-full bg-[#f59e0b] flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                              <path d="M6 3v4M6 9h.01" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>

                      {/* State info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#111827]">{task.stateCode}</span>
                          <span className="text-xs text-[#6b7280]">{US_STATES[task.stateCode]}</span>
                          {task.status === "running" && (
                            <span className="text-xs text-[#9ca3af] ml-auto mr-2">
                              {formatElapsed(elapsed)}
                            </span>
                          )}
                        </div>
                        {task.status === "running" && task.step && (
                          <p className="text-xs text-[#6366f1] mt-0.5 font-medium">{task.step}</p>
                        )}
                        {task.status === "expired" && (
                          <p className="text-xs text-[#f59e0b] mt-0.5">{task.step || "任务已失效"}</p>
                        )}
                        {task.status === "timeout" && (
                          <p className="text-xs text-[#f59e0b] mt-0.5">{task.step || "任务超时"}</p>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {task.status === "running" && (
                          <>
                            <div className="w-24 progress-bar">
                              <div
                                className="progress-bar-fill"
                                style={{
                                  width: `${task.progress}%`,
                                  background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                                }}
                              />
                            </div>
                            <span className="text-xs text-[#6b7280] w-8 text-right">{task.progress}%</span>
                          </>
                        )}
                        {task.status === "completed" && (
                          <span className="text-xs text-[#10b981] font-medium">完成</span>
                        )}
                        {task.status === "error" && (
                          <span className="text-xs text-[#ef4444] font-medium">失败</span>
                        )}
                        {task.status === "expired" && (
                          <span className="text-xs text-[#f59e0b] font-medium">已失效</span>
                        )}
                        {task.status === "timeout" && (
                          <span className="text-xs text-[#f59e0b] font-medium">超时</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail: data sources + stage checklist (only for running tasks) */}
                    {task.status === "running" && (
                      <div className="mt-3 pt-3 border-t border-[#e5e7eb]/60">
                        {/* Data source icons */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider">数据源</span>
                          <div className="flex items-center gap-2">
                            {DATA_SOURCES.map((src) => {
                              const st = sourceStatus[src.key];
                              return (
                                <span
                                  key={src.key}
                                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                                    st === "done"
                                      ? "bg-[#ecfdf5] border-[#d1fae5] text-[#10b981]"
                                      : st === "active"
                                      ? "bg-[#eef2ff] border-[#c7d2fe] text-[#6366f1]"
                                      : "bg-[#f9fafb] border-[#e5e7eb] text-[#d1d5db]"
                                  }`}
                                >
                                  {st === "done" ? (
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M1.5 5l2.5 2.5 4.5-4.5" />
                                    </svg>
                                  ) : st === "active" ? (
                                    <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                                      <circle cx="5" cy="5" r="3.5" />
                                    </svg>
                                  )}
                                  {src.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Stage checklist */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider">阶段</span>
                          {stages.map((s, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 text-[11px] ${
                                s.status === "done"
                                  ? "text-[#10b981]"
                                  : s.status === "active"
                                  ? "text-[#6366f1] font-medium"
                                  : "text-[#d1d5db]"
                              }`}
                            >
                              {s.status === "done" ? (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1.5 5l2.5 2.5 4.5-4.5" />
                                </svg>
                              ) : s.status === "active" ? (
                                <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <circle cx="5" cy="5" r="3.5" />
                                </svg>
                              )}
                              {s.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Section 3: Category Management */}
        <section className="card p-6">
          <h2 className="text-lg font-bold text-[#111827] mb-1">品类管理</h2>
          <p className="text-sm text-[#6b7280] mb-5">查看各品类调研进度</p>

          <div className="space-y-3">
            {(categories.length > 0 ? categories : catList.map((c) => ({ ...c, reportCount: 0 }))).map((cat) => (
              <div
                key={cat.key}
                className="flex items-center justify-between p-4 rounded-lg border border-[#e5e7eb] bg-white hover:bg-[#f9fafb] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                  >
                    {cat.label.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[#111827]">{cat.label}</p>
                    <p className="text-xs text-[#6b7280]">已调研 {cat.reportCount} 州</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deleteConfirm === cat.key ? (
                    <div className="flex items-center gap-1.5 bg-[#fef2f2] border border-[#fee2e2] rounded-lg px-3 py-1.5">
                      <span className="text-xs text-[#ef4444]">确认删除？</span>
                      <button
                        onClick={() => deleteCategory(cat.key)}
                        className="text-xs font-medium text-[#ef4444] hover:text-[#dc2626] px-1.5"
                      >
                        删除
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs text-[#6b7280] hover:text-[#111827] px-1.5"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setDeleteConfirm(cat.key)}
                        className="opacity-0 group-hover:opacity-100 text-[#9ca3af] hover:text-[#ef4444] transition-all p-1"
                        title="删除品类"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M4 3.5l.5 8a1 1 0 001 1h3a1 1 0 001-1l.5-8" />
                        </svg>
                      </button>
                      <a
                        href={`/?category=${cat.key}`}
                        className="btn-ghost text-xs"
                      >
                        查看
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M5 3l4 4-4 4" />
                        </svg>
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add new category */}
          <button
            className="mt-4 w-full py-3 rounded-lg border-2 border-dashed border-[#d1d5db] text-sm text-[#9ca3af]
                       hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#eef2ff] transition-all cursor-pointer"
            onClick={() => setShowAddModal(true)}
          >
            + 添加新品类
          </button>

          {/* Add Category Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-w-[90vw]">
                <h3 className="text-base font-bold text-[#111827] mb-1">添加新品类</h3>
                <p className="text-xs text-[#6b7280] mb-4">输入你要调研的产品品类名称</p>
                <input
                  type="text"
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  placeholder="例如：地毯、壁纸、灯具..."
                  className="w-full px-4 py-2.5 rounded-lg border border-[#d1d5db] text-sm text-[#111827]
                             placeholder-[#9ca3af] focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 outline-none transition-all"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => { setShowAddModal(false); setNewCatLabel(""); }}
                    className="px-4 py-2 text-sm text-[#6b7280] hover:text-[#111827] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={addCategory}
                    disabled={!newCatLabel.trim()}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
