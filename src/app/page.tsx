"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:8080";
const SUPABASE_URL = "https://bbfyfkjcvhpqmjticmsy.supabase.co";
const SUPABASE_BUCKET = "market-reports";

const US_STATES: Record<string, string> = {
  AL: "Alabama",   AK: "Alaska",       AZ: "Arizona",      AR: "Arkansas",
  CA: "California", CO: "Colorado",     CT: "Connecticut",  DE: "Delaware",
  FL: "Florida",   GA: "Georgia",      HI: "Hawaii",       ID: "Idaho",
  IL: "Illinois",  IN: "Indiana",      IA: "Iowa",         KS: "Kansas",
  KY: "Kentucky",  LA: "Louisiana",    ME: "Maine",        MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan",  MN: "Minnesota",    MS: "Mississippi",
  MO: "Missouri",  MT: "Montana",      NE: "Nebraska",     NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",  NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio",     OK: "Oklahoma",
  OR: "Oregon",    PA: "Pennsylvania", RI: "Rhode Island",  SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas",         UT: "Utah",
  VT: "Vermont",   VA: "Virginia",     WA: "Washington",   WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming",
};

const TOP10_STATES = [
  "CA", "TX", "NY", "FL", "IL", "PA", "OH", "GA", "NC", "NJ",
];

const STEPS = [
  { key: "collecting", label: "API 数据采集" },
  { key: "searching",  label: "市场搜索分析" },
  { key: "cleaning",   label: "数据清洗整合" },
  { key: "reporting",  label: "报告撰写生成" },
  { key: "exporting",  label: "文件导出完成" },
];

const COST_PER_STATE = 0.35; // approximate $ per state
const MINS_PER_STATE = 2.5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AppView = "empty" | "select" | "generating" | "reports";

interface ReportFile {
  html?: string;
  data_docx?: string;
  business_docx?: string;
  [key: string]: string | undefined;
}

interface Report {
  state_code: string;
  state_name: string;
  files: ReportFile;
  created_at: string;
  population?: string;
  gdp?: string;
  stores?: string;
  go_no_go?: string;
}

interface TaskStatus {
  task_id: string;
  status: string;
  progress: number;
  step: string;
  result?: Record<string, unknown>;
}

interface GeneratingTask {
  stateCode: string;
  taskId: string;
  status: TaskStatus | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function supabasePublicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
}

function stepIndex(step: string): number {
  const idx = STEPS.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : 0;
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function Home() {
  // -- State ---------------------------------------------------------------
  const [view, setView] = useState<AppView>("empty");
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // Select panel
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());

  // Generation
  const [tasks, setTasks] = useState<GeneratingTask[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -- Load existing reports on mount --------------------------------------
  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`${API_BASE}/reports?product=curtains`);
      if (res.ok) {
        const data: Report[] = await res.json();
        setReports(data);
        if (data.length > 0) {
          setView("reports");
        }
      }
    } catch {
      // API might not be running; stay in empty state
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // -- Selection helpers ---------------------------------------------------
  const toggleState = (code: string) => {
    setSelectedStates((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedStates(new Set(Object.keys(US_STATES)));
  const selectTop10 = () => setSelectedStates(new Set(TOP10_STATES));
  const clearSelection = () => setSelectedStates(new Set());

  // -- Generation ----------------------------------------------------------
  const startGeneration = async () => {
    const codes = Array.from(selectedStates);
    if (codes.length === 0) return;

    const newTasks: GeneratingTask[] = [];

    for (const code of codes) {
      try {
        const res = await fetch(`${API_BASE}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state_code: code, product: "curtains" }),
        });
        if (res.ok) {
          const data = await res.json();
          newTasks.push({
            stateCode: code,
            taskId: data.task_id,
            status: null,
          });
        } else {
          newTasks.push({
            stateCode: code,
            taskId: "",
            status: {
              task_id: "",
              status: "error",
              progress: 0,
              step: "collecting",
            },
          });
        }
      } catch {
        newTasks.push({
          stateCode: code,
          taskId: "",
          status: {
            task_id: "",
            status: "error",
            progress: 0,
            step: "collecting",
          },
        });
      }
    }

    setTasks(newTasks);
    setView("generating");
  };

  // -- Polling for generation status ---------------------------------------
  useEffect(() => {
    if (view !== "generating" || tasks.length === 0) return;

    const poll = async () => {
      const updated = await Promise.all(
        tasks.map(async (t) => {
          if (!t.taskId || t.status?.status === "completed" || t.status?.status === "error")
            return t;
          try {
            const res = await fetch(`${API_BASE}/status/${t.taskId}`);
            if (res.ok) {
              const s: TaskStatus = await res.json();
              return { ...t, status: s };
            }
          } catch {
            /* ignore */
          }
          return t;
        })
      );
      setTasks(updated);

      // Check if all done
      const allDone = updated.every(
        (t) => t.status?.status === "completed" || t.status?.status === "error"
      );
      if (allDone && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        // Refresh reports after short delay
        setTimeout(() => {
          fetchReports();
          setView("reports");
        }, 1500);
      }
    };

    pollingRef.current = setInterval(poll, 3000);
    // Run once immediately
    poll();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tasks.length]);

  // -- Computed values -----------------------------------------------------
  const completedCount = tasks.filter(
    (t) => t.status?.status === "completed"
  ).length;
  const overallProgress =
    tasks.length > 0
      ? Math.round(
          tasks.reduce((sum, t) => sum + (t.status?.progress ?? 0), 0) /
            tasks.length
        )
      : 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="flex flex-col min-h-screen">
      {/* ---- Header (shown when reports exist or generating) ---- */}
      {(view === "reports" || view === "generating") && (
        <header className="flex items-center justify-between px-6 py-4 border-b border-[--border]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[--accent] to-purple-500 flex items-center justify-center text-white text-sm font-bold">
              M
            </div>
            <span className="text-sm font-medium text-[--text-secondary]">
              市场调研系统
            </span>
          </div>
          {view === "reports" && (
            <button
              onClick={() => {
                setSelectedStates(new Set());
                setView("select");
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                         bg-[--accent] text-white hover:bg-[--accent-hover]
                         transition-colors cursor-pointer"
            >
              <PlusIcon />
              新建调研
            </button>
          )}
        </header>
      )}

      {/* ---- Main Content ---- */}
      <main className="flex-1 flex flex-col">
        {/* Loading spinner */}
        {loadingReports && view === "empty" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* STATE A: Empty */}
        {!loadingReports && view === "empty" && <EmptyState onNewResearch={() => setView("select")} />}

        {/* STATE B: Select Panel */}
        {view === "select" && (
          <SelectPanel
            selectedStates={selectedStates}
            toggleState={toggleState}
            selectAll={selectAll}
            selectTop10={selectTop10}
            clearSelection={clearSelection}
            onCancel={() =>
              setView(reports.length > 0 ? "reports" : "empty")
            }
            onStart={startGeneration}
          />
        )}

        {/* STATE C: Generating */}
        {view === "generating" && (
          <GeneratingView
            tasks={tasks}
            completedCount={completedCount}
            overallProgress={overallProgress}
          />
        )}

        {/* STATE D: Reports */}
        {view === "reports" && (
          <ReportsView reports={reports} />
        )}
      </main>
    </div>
  );
}

// ===========================================================================
// Sub-components (co-located in single file)
// ===========================================================================

// ---- Icons (inline SVG) --------------------------------------------------
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M2 7.5l3.5 3.5L12 4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 2v7.5M3.5 7L7 10.5 10.5 7M2.5 12h9" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <div className="w-3.5 h-3.5 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
  );
}

// ---- STATE A: Empty State ------------------------------------------------
function EmptyState({ onNewResearch }: { onNewResearch: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center relative state-enter">
      <div className="hero-glow" />
      <div className="text-center z-10 px-6">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[--accent] to-purple-500 flex items-center justify-center shadow-lg shadow-[--accent-glow]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M3 12h4l3-9 4 18 3-9h4" />
          </svg>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-white to-[--text-secondary] bg-clip-text text-transparent">
          市场调研系统
        </h1>
        <p className="text-[--text-secondary] text-lg mb-10 max-w-md mx-auto">
          美国窗帘 / 窗饰零售市场自动分析
        </p>
        <button
          onClick={onNewResearch}
          className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-semibold
                     bg-[--accent] text-white hover:bg-[--accent-hover]
                     shadow-lg shadow-[--accent-glow]
                     transition-all duration-200 hover:scale-[1.02] cursor-pointer"
        >
          <PlusIcon />
          新建调研
        </button>
        <p className="mt-6 text-xs text-[--text-muted]">
          支持 50 州独立报告 · 数据采集 · AI 分析 · 自动导出
        </p>
      </div>
    </div>
  );
}

// ---- STATE B: Select Panel -----------------------------------------------
function SelectPanel({
  selectedStates,
  toggleState,
  selectAll,
  selectTop10,
  clearSelection,
  onCancel,
  onStart,
}: {
  selectedStates: Set<string>;
  toggleState: (code: string) => void;
  selectAll: () => void;
  selectTop10: () => void;
  clearSelection: () => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  const count = selectedStates.size;
  const estMinutes = Math.ceil(count * MINS_PER_STATE);
  const estCost = (count * COST_PER_STATE).toFixed(2);

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 state-enter">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">选择调研州</h2>
        <p className="text-[--text-secondary] text-sm">
          品类：窗帘 / 窗饰（Curtains & Window Treatments） · 选择目标州开始生成报告
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-5">
        <QuickButton label="全部 50 州" onClick={selectAll} />
        <QuickButton label="Top 10 经济大州" onClick={selectTop10} />
        <QuickButton label="清空" onClick={clearSelection} variant="ghost" />
      </div>

      {/* States Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 mb-8">
        {Object.entries(US_STATES).map(([code, name]) => {
          const selected = selectedStates.has(code);
          return (
            <button
              key={code}
              onClick={() => toggleState(code)}
              title={name}
              className={`
                relative flex flex-col items-center justify-center py-2.5 px-1 rounded-lg text-center
                border transition-all duration-150 cursor-pointer
                ${
                  selected
                    ? "bg-[--accent]/15 border-[--accent] text-[--accent]"
                    : "bg-[--bg-card] border-[--border-subtle] text-[--text-secondary] hover:border-[--border] hover:bg-[--bg-card-hover]"
                }
              `}
            >
              <span className="text-xs font-bold leading-none">{code}</span>
              <span className="text-[10px] mt-0.5 leading-tight opacity-60 truncate w-full">
                {name}
              </span>
              {selected && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[--accent] flex items-center justify-center">
                  <CheckIcon className="text-white w-2 h-2" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-[--border] pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="text-sm text-[--text-secondary] flex flex-wrap gap-x-4 gap-y-1">
          <span>
            已选 <strong className="text-[--text-primary]">{count}</strong> 州
          </span>
          {count > 0 && (
            <>
              <span>预计 ~{estMinutes} 分钟</span>
              <span>~${estCost}</span>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm rounded-lg border border-[--border]
                       text-[--text-secondary] hover:text-[--text-primary] hover:border-[--text-muted]
                       transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            disabled={count === 0}
            onClick={onStart}
            className="px-5 py-2.5 text-sm font-medium rounded-lg
                       bg-[--accent] text-white hover:bg-[--accent-hover]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors cursor-pointer"
          >
            开始生成 {count} 份报告
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickButton({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer
        ${
          variant === "ghost"
            ? "text-[--text-muted] hover:text-[--text-secondary]"
            : "bg-[--bg-tertiary] text-[--text-secondary] hover:text-[--text-primary] border border-[--border-subtle] hover:border-[--border]"
        }
      `}
    >
      {label}
    </button>
  );
}

// ---- STATE C: Generating View --------------------------------------------
function GeneratingView({
  tasks,
  completedCount,
  overallProgress,
}: {
  tasks: GeneratingTask[];
  completedCount: number;
  overallProgress: number;
}) {
  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 state-enter">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">正在生成报告...</h2>
        <div className="flex items-center gap-4 text-sm text-[--text-secondary]">
          <span>
            {completedCount}/{tasks.length} 完成
          </span>
          <span>{overallProgress}%</span>
        </div>
        {/* Overall progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-[--bg-tertiary] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[--accent] to-purple-500 transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Task Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {tasks.map((task) => (
          <TaskCard key={task.stateCode} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: GeneratingTask }) {
  const st = task.status;
  const currentStep = st?.step ?? "collecting";
  const currentIdx = stepIndex(currentStep);
  const isCompleted = st?.status === "completed";
  const isError = st?.status === "error";

  return (
    <div
      className={`
        p-4 rounded-xl border transition-colors
        ${
          isCompleted
            ? "border-[--success]/30 bg-[--success]/5"
            : isError
            ? "border-[--danger]/30 bg-[--danger]/5"
            : "border-[--border] bg-[--bg-card]"
        }
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{task.stateCode}</span>
          <span className="text-xs text-[--text-muted]">
            {US_STATES[task.stateCode]}
          </span>
        </div>
        {isCompleted && (
          <span className="text-xs text-[--success] font-medium flex items-center gap-1">
            <CheckIcon /> 完成
          </span>
        )}
        {isError && (
          <span className="text-xs text-[--danger] font-medium">失败</span>
        )}
        {!isCompleted && !isError && (
          <span className="text-xs text-[--text-muted]">
            {st?.progress ?? 0}%
          </span>
        )}
      </div>

      {/* Mini timeline */}
      <div className="flex gap-1">
        {STEPS.map((step, i) => {
          const done = isCompleted || i < currentIdx;
          const active = !isCompleted && !isError && i === currentIdx;
          return (
            <div
              key={step.key}
              title={step.label}
              className={`
                flex-1 h-1 rounded-full transition-colors duration-300
                ${
                  done
                    ? "bg-[--success]"
                    : active
                    ? "bg-[--accent] animate-shimmer"
                    : "bg-[--bg-tertiary]"
                }
              `}
            />
          );
        })}
      </div>

      {!isCompleted && !isError && (
        <p className="mt-2 text-[10px] text-[--text-muted]">
          {STEPS[currentIdx]?.label ?? "准备中"}
        </p>
      )}
    </div>
  );
}

// ---- STATE D: Reports View -----------------------------------------------
function ReportsView({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[--text-muted] text-sm">
        暂无报告
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 state-enter">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">调研报告</h2>
          <p className="text-sm text-[--text-secondary] mt-1">
            共 {reports.length} 份已生成报告
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <ReportCard key={r.state_code} report={r} />
        ))}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  const r = report;
  const goNoGo = r.go_no_go?.toLowerCase();
  const isGo = goNoGo === "go";

  // Build download links from files object
  const downloads: { label: string; url: string }[] = [];
  if (r.files) {
    if (r.files.html) {
      downloads.push({
        label: "HTML 报告",
        url: r.files.html.startsWith("http")
          ? r.files.html
          : supabasePublicUrl(r.files.html),
      });
    }
    if (r.files.data_docx) {
      downloads.push({
        label: "数据报告",
        url: r.files.data_docx.startsWith("http")
          ? r.files.data_docx
          : supabasePublicUrl(r.files.data_docx),
      });
    }
    if (r.files.business_docx) {
      downloads.push({
        label: "商业分析",
        url: r.files.business_docx.startsWith("http")
          ? r.files.business_docx
          : supabasePublicUrl(r.files.business_docx),
      });
    }
  }

  return (
    <div className="card-hover p-5 rounded-xl border border-[--border] bg-[--bg-card]">
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold">{r.state_code}</span>
            <span className="text-sm text-[--text-secondary]">
              {r.state_name}
            </span>
          </div>
          <p className="text-[10px] text-[--text-muted]">
            {new Date(r.created_at).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        {r.go_no_go && (
          <span
            className={`
              px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide
              ${
                isGo
                  ? "bg-[--success]/15 text-[--success]"
                  : "bg-[--danger]/15 text-[--danger]"
              }
            `}
          >
            {r.go_no_go}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {r.population && (
          <StatBadge label="人口" value={r.population} />
        )}
        {r.gdp && <StatBadge label="GDP" value={r.gdp} />}
        {r.stores && (
          <StatBadge label="店铺" value={r.stores} />
        )}
      </div>

      {/* Download links */}
      {downloads.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-[--border-subtle]">
          {downloads.map((d) => (
            <a
              key={d.label}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md
                         bg-[--bg-tertiary] text-[--text-secondary] hover:text-[--text-primary]
                         border border-[--border-subtle] hover:border-[--border]
                         transition-colors"
            >
              <DownloadIcon />
              {d.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-[--bg-tertiary]/50">
      <p className="text-[10px] text-[--text-muted] mb-0.5">{label}</p>
      <p className="text-xs font-semibold text-[--text-primary] truncate">
        {value}
      </p>
    </div>
  );
}
