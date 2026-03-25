"use client";

import React, { useEffect, useRef, useState } from "react";

interface ScatterChartProps {
  states: Array<{
    code: string;
    name: string;
    tam: number;
    density: number;
    income: number;
    rating: string;
  }>;
}

const ratingLabelMap: Record<string, string> = {
  strongly_recommended: "\u{1F7E2} 强烈推荐",
  recommended: "\u{1F7E1} 推荐",
  cautious: "\u{1F7E0} 谨慎",
  not_recommended: "\u{1F534} 不推荐",
  // Chinese fallbacks
  "强烈推荐": "\u{1F7E2} 强烈推荐",
  "推荐": "\u{1F7E1} 推荐",
  "一般": "\u{1F7E0} 谨慎",
  "不推荐": "\u{1F534} 不推荐",
};

const ratingColor: Record<string, string> = {
  strongly_recommended: "#22c55e",
  recommended: "#eab308",
  cautious: "#f97316",
  not_recommended: "#ef4444",
  // Chinese fallbacks
  "强烈推荐": "#22c55e",
  "推荐": "#eab308",
  "一般": "#f97316",
  "不推荐": "#ef4444",
  // Letter fallbacks
  "A": "#22c55e",
  "B": "#eab308",
  "C": "#f97316",
  "D": "#ef4444",
};

function getColor(rating: string): string {
  return ratingColor[rating] ?? "#6366f1";
}

function getLabel(rating: string): string {
  return ratingLabelMap[rating] ?? rating;
}

declare global {
  interface Window {
    echarts?: {
      init: (el: HTMLElement) => EChartsInstance;
      getInstanceByDom: (el: HTMLElement) => EChartsInstance | undefined;
    };
  }
}

interface EChartsInstance {
  setOption: (opt: Record<string, unknown>) => void;
  resize: () => void;
  dispose: () => void;
}

export default function ScatterChart({ states }: ScatterChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Load ECharts CDN
  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = document.querySelector('script[src*="echarts"]');
    if (existing) {
      if (window.echarts) {
        setReady(true);
      } else {
        existing.addEventListener("load", () => setReady(true));
      }
    } else {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js";
      script.onload = () => setReady(true);
      document.head.appendChild(script);
    }
  }, []);

  // Render chart
  useEffect(() => {
    if (!ready || !chartRef.current || !window.echarts) return;

    const echarts = window.echarts;
    const existingInstance = echarts.getInstanceByDom(chartRef.current);
    if (existingInstance) existingInstance.dispose();

    const chart = echarts.init(chartRef.current);

    // Normalize income for bubble size
    const incomes = states.map((s) => s.income);
    const minIncome = Math.min(...incomes);
    const maxIncome = Math.max(...incomes);
    const normalize = (v: number) =>
      10 + ((v - minIncome) / (maxIncome - minIncome || 1)) * 40;

    // Group by rating for legend
    const groups: Record<string, Array<[number, number, number, string, string, number]>> = {};
    states.forEach((s) => {
      const key = s.rating;
      if (!groups[key]) groups[key] = [];
      groups[key].push([s.tam, s.density, normalize(s.income), s.code, s.name, s.income]);
    });

    const maxTam = Math.max(...states.map((s) => s.tam));
    const maxDensity = Math.max(...states.map((s) => s.density));
    const minDensity = Math.min(...states.map((s) => s.density));

    // If all densities are 0, set a reasonable y-axis range
    const yMax = maxDensity === 0 ? 1 : undefined;

    const series = Object.entries(groups).map(([rating, data]) => ({
      name: getLabel(rating),
      type: "scatter",
      symbolSize: (val: number[]) => val[2],
      data,
      itemStyle: { color: getColor(rating), opacity: 0.8 },
      label: {
        show: true,
        formatter: (p: { data: [number, number, number, string] }) => p.data[3],
        position: "top",
        fontSize: 10,
        color: "#64748b",
      },
    }));

    // Sweet spot annotation
    series.push({
      name: "\u{1F3AF} 甜蜜区",
      type: "scatter" as const,
      symbolSize: () => 0,
      data: [],
      itemStyle: { color: "transparent", opacity: 0 },
      label: { show: false, formatter: () => "", position: "top", fontSize: 10, color: "transparent" },
    } as typeof series[number]);

    chart.setOption({
      backgroundColor: "transparent",
      title: {
        text: "大市场 \u00D7 低竞争 散点图",
        subtext: "X轴=TAM市场规模，Y轴=竞争密度（越低越好），气泡大小=综合评分",
        left: "center",
        textStyle: { color: "#1e293b", fontSize: 16, fontWeight: "bold" },
        subtextStyle: { color: "#64748b", fontSize: 12 },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: { data: [number, number, number, string, string, number] }) => {
          const d = p.data;
          return `<b>${d[4]} (${d[3]})</b><br/>TAM: $${d[0].toFixed(1)}B<br/>竞争密度: ${d[1].toFixed(1)} 店/万人<br/>综合评分: ${d[5].toFixed(0)}`;
        },
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        textStyle: { color: "#1e293b" },
      },
      legend: {
        top: 60,
        textStyle: { color: "#475569" },
      },
      grid: {
        left: 60,
        right: 40,
        top: 110,
        bottom: 60,
      },
      xAxis: {
        name: "TAM 市场规模 ($B)",
        nameTextStyle: { color: "#64748b" },
        type: "value",
        axisLabel: { color: "#64748b", formatter: "${value}B" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },
      yAxis: {
        name: "竞争密度 (店/万人)",
        nameTextStyle: { color: "#64748b" },
        type: "value",
        inverse: true,
        max: yMax,
        axisLabel: { color: "#64748b" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },
      graphic: [
        {
          type: "rect",
          shape: {
            x: 0,
            y: 0,
            width: 120,
            height: 60,
          },
          left: "70%",
          bottom: "10%",
          style: {
            fill: "rgba(34,197,94,0.08)",
            stroke: "#22c55e",
            lineWidth: 1,
            lineDash: [4, 4],
          },
        },
        {
          type: "text",
          left: "72%",
          bottom: "12%",
          style: {
            text: "\u{1F3AF} 甜蜜区\n高TAM + 低密度",
            fill: "#22c55e",
            fontSize: 12,
            fontWeight: "bold",
          },
        },
      ],
      // Mark area for sweet spot
      series: series.map((s, i) =>
        i === 0
          ? {
              ...s,
              markArea: {
                silent: true,
                itemStyle: {
                  color: "rgba(34,197,94,0.06)",
                  borderColor: "#22c55e",
                  borderWidth: 1,
                  borderType: "dashed",
                },
                data: [
                  [
                    { xAxis: maxTam * 0.6, yAxis: minDensity },
                    { xAxis: maxTam * 1.1, yAxis: minDensity + (maxDensity - minDensity) * 0.35 || 0.35 },
                  ],
                ],
                label: {
                  show: true,
                  position: "inside",
                  formatter: "\u{1F3AF} 甜蜜区",
                  color: "#22c55e",
                  fontSize: 13,
                  fontWeight: "bold",
                },
              },
            }
          : s
      ),
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [ready, states]);

  return (
    <div ref={chartRef} style={{ width: "100%", height: 500 }} />
  );
}
