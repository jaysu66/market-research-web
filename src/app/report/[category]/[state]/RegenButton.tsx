"use client";

import { useState, useEffect } from "react";

interface RegenButtonProps {
  stateCode: string;
  stateName: string;
  categoryKey: string;
  categoryLabel: string;
}

export default function RegenButton({ stateCode, stateName, categoryKey, categoryLabel }: RegenButtonProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenTaskId, setRegenTaskId] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!confirm(`确认重新生成 ${stateName} 的${categoryLabel}报告？这将花费约15-20分钟。`)) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/proxy/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state_code: stateCode, product: categoryKey }),
      });
      if (res.ok) {
        const data = await res.json();
        setRegenTaskId(data.task_id);
      } else {
        setIsRegenerating(false);
      }
    } catch {
      setIsRegenerating(false);
    }
  };

  useEffect(() => {
    if (!regenTaskId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/proxy/status/${regenTaskId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed') {
            clearInterval(interval);
            setIsRegenerating(false);
            window.location.reload();
          } else if (data.status === 'error') {
            clearInterval(interval);
            setIsRegenerating(false);
            alert('报告生成失败，请重试');
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [regenTaskId]);

  return (
    <button
      onClick={handleRegenerate}
      disabled={isRegenerating}
      className="inline-flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb] hover:border-[#0ea5e9] hover:text-[#0ea5e9] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isRegenerating ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
          生成中...
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          重新生成
        </>
      )}
    </button>
  );
}
