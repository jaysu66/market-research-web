"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function PreviewContent() {
  const params = useSearchParams();
  const url = params.get("url");
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    fetch(url)
      .then((r) => r.text())
      .then(setHtml)
      .catch(() => setError("加载失败"));
  }, [url]);

  if (!url) return <div style={{ color: "#999", padding: 40 }}>缺少 url 参数</div>;
  if (error) return <div style={{ color: "#f66", padding: 40 }}>{error}</div>;
  if (!html) return <div style={{ color: "#999", padding: 40 }}>加载中...</div>;

  return (
    <iframe
      srcDoc={html}
      style={{ width: "100%", height: "100vh", border: "none" }}
      sandbox="allow-scripts allow-same-origin"
      title="报告预览"
    />
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div style={{ color: "#999", padding: 40 }}>加载中...</div>}>
      <PreviewContent />
    </Suspense>
  );
}
