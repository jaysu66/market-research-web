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
  { key: "blinds", label: "百叶窗" },
  { key: "shutters", label: "卷帘" },
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface QueueTask {
  stateCode: string;
  taskId: string;
  status: "pending" | "running" | "completed" | "error";
  progress: number;
  step: string;
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved categories on mount
  useEffect(() => {
    setCatList(loadCategories());
  }, []);

  // Add new category
  const addCategory = () => {
    if (!newCatLabel.trim()) return;
    const key = newCatLabel.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "_");
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
          });
        } else {
          newQueue.push({
            stateCode: code,
            taskId: "",
            status: "error",
            progress: 0,
            step: "",
          });
        }
      } catch {
        newQueue.push({
          stateCode: code,
          taskId: "",
          status: "error",
          progress: 0,
          step: "",
        });
      }
    }

    setQueue(newQueue);
    setSelected(new Set());
  };

  // Poll queue
  useEffect(() => {
    if (queue.length === 0 || queue.every((t) => t.status === "completed" || t.status === "error")) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (queue.length > 0 && queue.every((t) => t.status === "completed" || t.status === "error")) {
        setIsBatchRunning(false);
        fetchCategories();
      }
      return;
    }

    const poll = async () => {
      setQueue((prev) => {
        const running = prev.filter((t) => t.status === "running" && t.taskId);
        if (running.length === 0) return prev;

        // Fire off async status checks and update state when they resolve
        // (we return prev unchanged here; updates happen via separate setQueue calls)
        for (const t of running) {
          fetch(`${API}/status/${t.taskId}`)
            .then((res) => (res.ok ? res.json() : null))
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
                      }
                    : item
                )
              );
            })
            .catch(() => { /* ignore */ });
        }
        return prev;
      });
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
              {queue.map((task) => (
                <div
                  key={task.stateCode}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    task.status === "completed"
                      ? "bg-[#ecfdf5] border-[#d1fae5]"
                      : task.status === "error"
                      ? "bg-[#fef2f2] border-[#fee2e2]"
                      : "bg-white border-[#e5e7eb]"
                  }`}
                >
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
                    ) : (
                      <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>

                  {/* State info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#111827]">{task.stateCode}</span>
                      <span className="text-xs text-[#6b7280]">{US_STATES[task.stateCode]}</span>
                    </div>
                    {task.status === "running" && task.step && (
                      <p className="text-xs text-[#9ca3af] mt-0.5">{task.step}</p>
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
                  </div>
                </div>
              ))}
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
