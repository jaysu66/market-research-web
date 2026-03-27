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
  lang?: 'cn' | 'en';
}

const STATE_SHORT_CN: Record<string, string> = {
  AL: "阿拉巴马", AK: "阿拉斯加", AZ: "亚利桑那", AR: "阿肯色",
  CA: "加利福尼亚", CO: "科罗拉多", CT: "康涅狄格", DE: "特拉华",
  FL: "佛罗里达", GA: "佐治亚", HI: "夏威夷", ID: "爱达荷",
  IL: "伊利诺伊", IN: "印第安纳", IA: "艾奥瓦", KS: "堪萨斯",
  KY: "肯塔基", LA: "路易斯安那", ME: "缅因", MD: "马里兰",
  MA: "马萨诸塞", MI: "密歇根", MN: "明尼苏达", MS: "密西西比",
  MO: "密苏里", MT: "蒙大拿", NE: "内布拉斯加", NV: "内华达",
  NH: "新罕布什尔", NJ: "新泽西", NM: "新墨西哥", NY: "纽约",
  NC: "北卡", ND: "北达科他", OH: "俄亥俄", OK: "俄克拉荷马",
  OR: "俄勒冈", PA: "宾夕法尼亚", RI: "罗得岛", SC: "南卡",
  SD: "南达科他", TN: "田纳西", TX: "德克萨斯", UT: "犹他",
  VT: "佛蒙特", VA: "弗吉尼亚", WA: "华盛顿", WV: "西弗吉尼亚",
  WI: "威斯康星", WY: "怀俄明",
};

const STATE_FULL_EN: Record<string, string> = {
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

const ratingLabelMapCn: Record<string, string> = {
  strongly_recommended: "\u{1F7E2} 强烈推荐",
  recommended: "\u{1F7E1} 推荐",
  cautious: "\u{1F7E0} 谨慎",
  not_recommended: "\u{1F534} 不推荐",
  "强烈推荐": "\u{1F7E2} 强烈推荐",
  "推荐": "\u{1F7E1} 推荐",
  "一般": "\u{1F7E0} 谨慎",
  "不推荐": "\u{1F534} 不推荐",
};

const ratingLabelMapEn: Record<string, string> = {
  strongly_recommended: "\u{1F7E2} Strong Buy",
  recommended: "\u{1F7E1} Buy",
  cautious: "\u{1F7E0} Hold",
  not_recommended: "\u{1F534} Avoid",
  "强烈推荐": "\u{1F7E2} Strong Buy",
  "推荐": "\u{1F7E1} Buy",
  "一般": "\u{1F7E0} Hold",
  "不推荐": "\u{1F534} Avoid",
};

const ratingColor: Record<string, string> = {
  strongly_recommended: "#166534",  // 深绿
  recommended: "#a16207",           // 深琥珀
  cautious: "#c2410c",              // 深橙
  not_recommended: "#991b1b",       // 深红
  "强烈推荐": "#166534",
  "推荐": "#a16207",
  "一般": "#c2410c",
  "不推荐": "#991b1b",
  "A": "#166534",
  "B": "#a16207",
  "C": "#c2410c",
  "D": "#991b1b",
};

function getColor(rating: string): string {
  return ratingColor[rating] ?? "#0ea5e9";
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

export default function ScatterChart({ states, lang = 'cn' }: ScatterChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<EChartsInstance | null>(null);
  const hasAnimatedRef = useRef(false);
  const [ready, setReady] = useState(false);

  const t = (cn: string, en: string) => lang === 'cn' ? cn : en;
  const getLabel = (rating: string): string => {
    const map = lang === 'en' ? ratingLabelMapEn : ratingLabelMapCn;
    return map[rating] ?? rating;
  };

  const getStateName = (code: string, fullName: string): string => {
    if (lang === 'cn') {
      return STATE_SHORT_CN[code] ?? fullName;
    }
    return STATE_FULL_EN[code] ?? fullName;
  };

  const getStateTooltipName = (code: string, fullName: string): string => {
    if (lang === 'cn') {
      return `${STATE_SHORT_CN[code] ?? fullName}州 (${code})`;
    }
    return `${STATE_FULL_EN[code] ?? fullName} (${code})`;
  };

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
    // Reuse existing instance to avoid re-animation
    let chart = chartInstanceRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!chart || (chart as any)?._disposed) {
      chart = echarts.init(chartRef.current);
      chartInstanceRef.current = chart;
    }

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

    // Collect all points sorted by density to assign alternating label positions
    const allPoints = states.map(s => ({ code: s.code, density: s.density, tam: s.tam }));
    allPoints.sort((a, b) => a.density - b.density || a.tam - b.tam);
    const labelPositions: Record<string, string> = {};
    const positions = ['top', 'right', 'left', 'bottom'];
    allPoints.forEach((p, i) => {
      labelPositions[p.code] = positions[i % positions.length];
    });

    const series = Object.entries(groups).map(([rating, data]) => ({
      name: getLabel(rating),
      type: "scatter",
      symbolSize: (val: number[]) => val[2],
      data,
      itemStyle: { color: getColor(rating), opacity: 0.9 },
      label: {
        show: true,
        formatter: (p: { data: [number, number, number, string, string, number] }) => {
          const code = p.data[3];
          const fullName = p.data[4];
          return getStateName(code, fullName);
        },
        position: (p: { data: [number, number, number, string, string, number] }) => {
          return labelPositions[p.data[3]] || 'top';
        },
        distance: 10,
        fontSize: 11,
        fontWeight: 500,
        color: "#334155",
      },
    }));

    const sweetSpotLabel = t("\u{1F3AF} 甜蜜区", "\u{1F3AF} Sweet Spot");
    const sweetSpotSub = t("高TAM + 低密度", "High TAM + Low Density");

    // Sweet spot annotation
    series.push({
      name: sweetSpotLabel,
      type: "scatter" as const,
      symbolSize: () => 0,
      data: [],
      itemStyle: { color: "transparent", opacity: 0 },
      label: { show: false, formatter: () => "", position: "top", fontSize: 10, color: "transparent" },
    } as typeof series[number]);

    const isFirstRender = !hasAnimatedRef.current;
    hasAnimatedRef.current = true;

    chart.setOption({
      animation: isFirstRender,
      animationDuration: isFirstRender ? 600 : 0,
      animationEasing: 'cubicOut',
      backgroundColor: "transparent",
      title: {
        text: t("大市场 \u00D7 低竞争 散点图", "Large Market \u00D7 Low Competition"),
        subtext: t(
          "X轴=TAM市场规模，Y轴=竞争密度（越低越好），气泡大小=综合评分",
          "X=TAM, Y=Competition Density (lower=better), Size=Overall Score"
        ),
        left: "center",
        textStyle: { color: "#1e293b", fontSize: 16, fontWeight: "bold" },
        subtextStyle: { color: "#64748b", fontSize: 12 },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: { data: [number, number, number, string, string, number] }) => {
          const d = p.data;
          const stateLabel = getStateTooltipName(d[3], d[4]);
          return `<b>${stateLabel}</b><br/>TAM: $${d[0].toFixed(1)}B<br/>${t('竞争密度', 'Density')}: ${d[1].toFixed(1)} ${t('店/万人', 'stores/10K')}<br/>${t('收入中位数', 'Median Income')}: $${d[5].toLocaleString()}`;
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
        name: t("TAM 市场规模 ($B)", "TAM Market Size ($B)"),
        nameTextStyle: { color: "#64748b" },
        type: "value",
        axisLabel: { color: "#64748b", formatter: "${value}B" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },
      yAxis: {
        name: t("竞争密度 (店/万人)", "Density (stores/10K)"),
        nameTextStyle: { color: "#64748b" },
        type: "value",
        inverse: true,
        max: yMax,
        axisLabel: { color: "#64748b" },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },
      labelLayout: {
        hideOverlap: true,
        moveOverlap: 'shiftY',
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
            fill: "rgba(22,101,52,0.06)",
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
            text: `${sweetSpotLabel}\n${sweetSpotSub}`,
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
                  formatter: sweetSpotLabel,
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
      // Don't dispose here — we reuse the instance. Dispose on unmount only.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, states, lang]);

  return (
    <div ref={chartRef} style={{ width: "100%", height: 500 }} />
  );
}
