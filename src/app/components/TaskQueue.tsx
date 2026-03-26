"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TaskRecord {
  task_id: string;
  state_code: string;
  product: string;
  started_at: string;
  status: "pending" | "running" | "completed" | "error" | "timeout";
  progress?: number;
  step?: string;
}

interface TaskQueueProps {
  /** API base URL, defaults to the ECS endpoint */
  apiBase?: string;
  /** localStorage key, defaults to "market_research_tasks" */
  storageKey?: string;
  /** Polling interval in ms, defaults to 5000 */
  pollInterval?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  running: {
    label: "进行中",
    color: "text-[#3b82f6]",
    bg: "bg-[#eff6ff]",
    border: "border-[#bfdbfe]",
    dot: "bg-[#3b82f6]",
  },
  pending: {
    label: "等待中",
    color: "text-[#3b82f6]",
    bg: "bg-[#eff6ff]",
    border: "border-[#bfdbfe]",
    dot: "bg-[#3b82f6]",
  },
  completed: {
    label: "已完成",
    color: "text-[#10b981]",
    bg: "bg-[#ecfdf5]",
    border: "border-[#d1fae5]",
    dot: "bg-[#10b981]",
  },
  error: {
    label: "失败",
    color: "text-[#ef4444]",
    bg: "bg-[#fef2f2]",
    border: "border-[#fee2e2]",
    dot: "bg-[#ef4444]",
  },
  timeout: {
    label: "超时",
    color: "text-[#9ca3af]",
    bg: "bg-[#f9fafb]",
    border: "border-[#e5e7eb]",
    dot: "bg-[#9ca3af]",
  },
};

function loadTasks(key: string): TaskRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function saveTasks(key: string, tasks: TaskRecord[]) {
  try {
    localStorage.setItem(key, JSON.stringify(tasks));
  } catch {
    /* ignore */
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function elapsed(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 0) return "--";
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    if (mins < 60) return `${mins}m ${rem}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  } catch {
    return "--";
  }
}

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TaskQueue({
  apiBase = "http://8.140.216.113",
  storageKey = "market_research_tasks",
  pollInterval = 5000,
}: TaskQueueProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "running" | "completed" | "error">("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setTasks(loadTasks(storageKey));
  }, [storageKey]);

  // Persist to localStorage whenever tasks change (skip initial empty)
  const initialLoad = useRef(true);
  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    saveTasks(storageKey, tasks);
  }, [tasks, storageKey]);

  // Poll running tasks
  const pollRunning = useCallback(async () => {
    // Read current tasks snapshot without side effects in setState
    let snapshot: TaskRecord[] = [];
    setTasks((prev) => { snapshot = prev; return prev; });

    const running = snapshot.filter(
      (t) => t.status === "running" || t.status === "pending"
    );
    if (running.length === 0) return;

    for (const t of running) {
      fetch(`${apiBase}/status/${t.task_id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          setTasks((cur) =>
            cur.map((item) =>
              item.task_id === t.task_id
                ? {
                    ...item,
                    progress: data.progress ?? item.progress ?? 0,
                    step: data.step ?? item.step,
                    status:
                      data.status === "completed"
                        ? "completed"
                        : data.status === "error"
                        ? "error"
                        : data.status === "timeout"
                        ? "timeout"
                        : item.status,
                  }
                : item
            )
          );
        })
        .catch(() => {
          /* network error — leave status unchanged */
        });
    }
  }, [apiBase]);

  useEffect(() => {
    const hasActive = tasks.some(
      (t) => t.status === "running" || t.status === "pending"
    );
    if (hasActive) {
      if (!pollRef.current) {
        pollRef.current = setInterval(pollRunning, pollInterval);
        pollRunning();
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tasks, pollRunning, pollInterval]);

  // Retry a failed task
  const handleRetry = async (task: TaskRecord) => {
    setRetrying((prev) => new Set(prev).add(task.task_id));
    try {
      const res = await fetch(`${apiBase}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state_code: task.state_code,
          product: task.product,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks((prev) =>
          prev.map((t) =>
            t.task_id === task.task_id
              ? {
                  ...t,
                  task_id: data.task_id ?? t.task_id,
                  status: "running" as const,
                  progress: 0,
                  step: "collecting",
                  started_at: new Date().toISOString(),
                }
              : t
          )
        );
      }
    } catch {
      /* ignore */
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(task.task_id);
        return next;
      });
    }
  };

  // Cancel a running task (remove from queue — API has no cancel endpoint)
  const handleCancel = (task: TaskRecord) => {
    setCancelling((prev) => new Set(prev).add(task.task_id));
    setTasks((prev) =>
      prev.map((t) =>
        t.task_id === task.task_id ? { ...t, status: "timeout" as const } : t
      )
    );
    setCancelling((prev) => {
      const next = new Set(prev);
      next.delete(task.task_id);
      return next;
    });
  };

  // Clear completed/failed
  const clearFinished = () => {
    setTasks((prev) =>
      prev.filter(
        (t) => t.status === "running" || t.status === "pending"
      )
    );
  };

  // Filtered view
  const filtered =
    filter === "all"
      ? tasks
      : tasks.filter((t) =>
          filter === "running"
            ? t.status === "running" || t.status === "pending"
            : filter === "error"
            ? t.status === "error" || t.status === "timeout"
            : t.status === filter
        );

  const counts = {
    all: tasks.length,
    running: tasks.filter((t) => t.status === "running" || t.status === "pending").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    error: tasks.filter((t) => t.status === "error" || t.status === "timeout").length,
  };

  if (tasks.length === 0) {
    return (
      <section className="card p-6">
        <h2 className="text-lg font-bold text-[#111827] mb-1">生成队列</h2>
        <p className="text-sm text-[#6b7280] mb-5">管理所有调研报告生成任务</p>
        <div className="flex flex-col items-center justify-center py-12 text-[#9ca3af]">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
          <p className="mt-3 text-sm">暂无任务记录</p>
          <p className="text-xs mt-1">在工作台中启动批量生成后，任务将出现在此处</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-[#111827]">生成队列</h2>
        {counts.running > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3b82f6] bg-[#eff6ff] px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
            {counts.running} 个进行中
          </span>
        )}
      </div>
      <p className="text-sm text-[#6b7280] mb-5">管理所有调研报告生成任务</p>

      {/* Filter tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-[#f3f4f6] rounded-lg p-0.5">
          {(
            [
              { key: "all", label: "全部" },
              { key: "running", label: "进行中" },
              { key: "completed", label: "已完成" },
              { key: "error", label: "失败" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                filter === tab.key
                  ? "bg-white text-[#111827] font-medium shadow-sm"
                  : "text-[#6b7280] hover:text-[#111827]"
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className="ml-1 text-[10px] opacity-60">
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {(counts.completed > 0 || counts.error > 0) && (
          <button
            onClick={clearFinished}
            className="text-xs text-[#9ca3af] hover:text-[#ef4444] transition-colors"
          >
            清除已结束
          </button>
        )}
      </div>

      {/* Task list */}
      <div className="space-y-2.5">
        {filtered.map((task) => {
          const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.timeout;
          return (
            <div
              key={task.task_id}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${cfg.bg} ${cfg.border}`}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {task.status === "running" || task.status === "pending" ? (
                  <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                ) : task.status === "completed" ? (
                  <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                    >
                      <path d="M2.5 7l3 3 6-6" />
                    </svg>
                  </div>
                ) : task.status === "error" ? (
                  <div className="w-8 h-8 rounded-full bg-[#ef4444] flex items-center justify-center">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                    >
                      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#d1d5db] flex items-center justify-center">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                    >
                      <circle cx="7" cy="7" r="5" />
                      <path d="M7 4.5V7.5L9 9" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#111827]">
                    {task.state_code}
                  </span>
                  <span className="text-xs text-[#6b7280]">
                    {US_STATES[task.state_code] ?? task.state_code}
                  </span>
                  <span className="text-[10px] text-[#9ca3af]">
                    {task.product}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">
                    {formatTime(task.started_at)}
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">
                    {elapsed(task.started_at)}
                  </span>
                  {task.step && (task.status === "running" || task.status === "pending") && (
                    <span className="text-[11px] text-[#9ca3af] truncate max-w-[120px]">
                      {task.step}
                    </span>
                  )}
                </div>
                {/* Progress bar for running tasks */}
                {(task.status === "running" || task.status === "pending") && (
                  <div className="mt-2 h-1.5 w-full bg-[#e5e7eb] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${task.progress ?? 0}%`,
                        background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {(task.status === "running" || task.status === "pending") && (
                  <>
                    <span className="text-xs text-[#6b7280] font-medium w-8 text-right">
                      {task.progress ?? 0}%
                    </span>
                    <button
                      onClick={() => handleCancel(task)}
                      disabled={cancelling.has(task.task_id)}
                      className="px-2.5 py-1 text-xs text-[#6b7280] hover:text-[#ef4444] border border-[#e5e7eb]
                                 hover:border-[#fee2e2] rounded-lg transition-all"
                    >
                      取消
                    </button>
                  </>
                )}
                {task.status === "completed" && (
                  <a
                    href={`/report/${encodeURIComponent(task.product)}/${task.state_code}`}
                    className="px-3 py-1.5 text-xs font-medium text-[#6366f1] bg-white border border-[#e5e7eb]
                               hover:border-[#6366f1] hover:bg-[#eef2ff] rounded-lg transition-all"
                  >
                    查看报告
                  </a>
                )}
                {(task.status === "error" || task.status === "timeout") && (
                  <button
                    onClick={() => handleRetry(task)}
                    disabled={retrying.has(task.task_id)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[#6366f1] hover:bg-[#4f46e5]
                               rounded-lg transition-all disabled:opacity-50"
                  >
                    {retrying.has(task.task_id) ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        重试中
                      </span>
                    ) : (
                      "重试"
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-[#9ca3af]">
          该分类下暂无任务
        </div>
      )}
    </section>
  );
}
