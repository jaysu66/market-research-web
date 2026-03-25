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

const ratingColor: Record<string, string> = {
  "强烈推荐": "#22c55e",
  "推荐": "#eab308",
  "一般": "#f97316",
  "不推荐": "#ef4444",
  // English fallbacks
  "A": "#22c55e",
  "B": "#eab308",
  "C": "#f97316",
  "D": "#ef4444",
};

function getColor(rating: string): string {
  return ratingColor[rating] ?? "#6366f1";
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
    const minDensity = Math.min(...states.map((s) => s.density));

    const series = Object.entries(groups).map(([rating, data]) => ({
      name: rating,
      type: "scatter",
      symbolSize: (val: number[]) => val[2],
      data,
      itemStyle: { color: getColor(rating), opacity: 0.8 },
      label: {
        show: true,
        formatter: (p: { data: [number, number, number, string] }) => p.data[3],
        position: "top",
        fontSize: 10,
        color: "#94a3b8",
      },
    }));

    // Sweet spot annotation
    series.push({
      name: "甜蜜区",
      type: "scatter" as const,
      symbolSize: () => 0,
      data: [],
      itemStyle: { color: "transparent", opacity: 0 },
      label: { show: false, formatter: () => "", position: "top", fontSize: 10, color: "transparent" },
    } as typeof series[number]);

    chart.setOption({
      backgroundColor: "transparent",
      title: {
        text: "大市场 × 低竞争 散点图",
        subtext: "X轴=TAM市场规模，Y轴=竞争密度（越低越好），气泡大小=收入中位数",
        left: "center",
        textStyle: { color: "#e2e8f0", fontSize: 16, fontWeight: "bold" },
        subtextStyle: { color: "#94a3b8", fontSize: 12 },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: { data: [number, number, number, string, string, number] }) => {
          const d = p.data;
          return `<b>${d[4]} (${d[3]})</b><br/>TAM: $${d[0].toFixed(1)}B<br/>竞争密度: ${d[1].toFixed(1)} 店/万人<br/>收入中位数: $${(d[5] / 1000).toFixed(0)}K`;
        },
        backgroundColor: "#1e293b",
        borderColor: "#334155",
        textStyle: { color: "#e2e8f0" },
      },
      legend: {
        top: 60,
        textStyle: { color: "#94a3b8" },
      },
      grid: {
        left: 60,
        right: 40,
        top: 110,
        bottom: 60,
      },
      xAxis: {
        name: "TAM 市场规模 ($B)",
        nameTextStyle: { color: "#94a3b8" },
        type: "value",
        axisLabel: { color: "#94a3b8", formatter: "${value}B" },
        axisLine: { lineStyle: { color: "#334155" } },
        splitLine: { lineStyle: { color: "#1e293b" } },
      },
      yAxis: {
        name: "竞争密度 (店/万人)",
        nameTextStyle: { color: "#94a3b8" },
        type: "value",
        inverse: true,
        axisLabel: { color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#334155" } },
        splitLine: { lineStyle: { color: "#1e293b" } },
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
            text: "🎯 甜蜜区\n高TAM + 低密度",
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
                    { xAxis: maxTam * 1.1, yAxis: minDensity + (Math.max(...states.map((s) => s.density)) - minDensity) * 0.35 },
                  ],
                ],
                label: {
                  show: true,
                  position: "inside",
                  formatter: "🎯 甜蜜区",
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
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
      <div ref={chartRef} style={{ width: "100%", height: 500 }} />
    </div>
  );
}
