"use client";

import React, { useState, useCallback, useRef } from "react";

interface StateData {
  score?: number;
  recommendation?: string;
  population?: string;
  income?: string;
  status: "researched" | "generating" | "none";
}

interface USMapProps {
  states: Record<string, StateData>;
  onStateClick: (stateCode: string) => void;
}

interface TooltipInfo {
  x: number;
  y: number;
  stateCode: string;
  stateName: string;
  data?: StateData;
}

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

const STATE_NAMES_CN: Record<string, string> = {
  AL: "阿拉巴马州", AK: "阿拉斯加州", AZ: "亚利桑那州", AR: "阿肯色州",
  CA: "加利福尼亚州", CO: "科罗拉多州", CT: "康涅狄格州", DE: "特拉华州",
  FL: "佛罗里达州", GA: "佐治亚州", HI: "夏威夷州", ID: "爱达荷州",
  IL: "伊利诺伊州", IN: "印第安纳州", IA: "艾奥瓦州", KS: "堪萨斯州",
  KY: "肯塔基州", LA: "路易斯安那州", ME: "缅因州", MD: "马里兰州",
  MA: "马萨诸塞州", MI: "密歇根州", MN: "明尼苏达州", MS: "密西西比州",
  MO: "密苏里州", MT: "蒙大拿州", NE: "内布拉斯加州", NV: "内华达州",
  NH: "新罕布什尔州", NJ: "新泽西州", NM: "新墨西哥州", NY: "纽约州",
  NC: "北卡罗来纳州", ND: "北达科他州", OH: "俄亥俄州", OK: "俄克拉荷马州",
  OR: "俄勒冈州", PA: "宾夕法尼亚州", RI: "罗得岛州", SC: "南卡罗来纳州",
  SD: "南达科他州", TN: "田纳西州", TX: "德克萨斯州", UT: "犹他州",
  VT: "佛蒙特州", VA: "弗吉尼亚州", WA: "华盛顿州", WV: "西弗吉尼亚州",
  WI: "威斯康星州", WY: "怀俄明州", DC: "华盛顿特区",
};

// SVG path data for US states — simplified polygonal outlines in a 960x600 viewport
const STATE_PATHS: Record<string, string> = {
  AL: "M628,425 L628,468 L622,502 L618,510 L631,512 L633,495 L641,495 L641,425Z",
  AK: "M161,485 L183,485 L183,493 L193,493 L193,485 L224,485 L224,493 L236,493 L236,502 L224,512 L204,512 L193,520 L172,516 L161,508Z",
  AZ: "M205,410 L270,410 L280,500 L218,500 L205,470Z",
  AR: "M565,425 L628,425 L628,468 L565,468Z",
  CA: "M120,285 L140,280 L165,320 L175,370 L185,420 L165,450 L140,460 L120,440 L105,400 L95,350 L100,310Z",
  CO: "M295,310 L380,310 L380,370 L295,370Z",
  CT: "M852,195 L876,188 L882,204 L862,214 L852,208Z",
  DE: "M810,310 L822,305 L826,325 L816,332Z",
  FL: "M660,490 L730,470 L755,490 L758,530 L730,560 L700,565 L680,545 L660,530 L645,515Z",
  GA: "M660,425 L710,420 L730,470 L660,490 L641,495 L641,425Z",
  HI: "M260,525 L300,520 L305,535 L280,545 L260,540Z",
  ID: "M200,175 L240,165 L250,220 L255,275 L225,275 L200,240Z",
  IL: "M580,270 L610,265 L615,290 L620,340 L610,375 L595,390 L570,385 L565,340 L575,300Z",
  IN: "M615,290 L650,285 L655,340 L650,375 L610,375 L620,340Z",
  IA: "M505,255 L575,250 L580,270 L575,300 L565,310 L510,310 L500,280Z",
  KS: "M400,345 L500,345 L500,400 L400,400Z",
  KY: "M610,375 L700,350 L710,365 L695,390 L650,400 L610,400 L595,390Z",
  LA: "M565,468 L622,468 L622,502 L618,510 L600,530 L575,530 L560,515 L555,490Z",
  ME: "M870,115 L890,105 L900,130 L895,165 L878,175 L862,160 L865,135Z",
  MD: "M770,310 L810,310 L816,332 L800,340 L785,345 L760,335 L758,320Z",
  MA: "M858,185 L890,178 L893,188 L876,196 L852,195 L852,190Z",
  MI: "M600,175 L620,165 L640,180 L660,200 L670,230 L655,260 L635,260 L615,245 L605,220 L595,200Z",
  MN: "M480,140 L545,135 L550,175 L555,225 L540,245 L505,255 L500,230 L490,185Z",
  MS: "M595,425 L628,425 L628,502 L618,510 L600,510 L590,490 L590,450Z",
  MO: "M510,310 L565,310 L575,340 L565,385 L565,425 L510,425 L500,400 L500,345Z",
  MT: "M245,130 L365,120 L370,180 L355,195 L295,195 L255,185 L245,165Z",
  NE: "M380,280 L480,275 L500,280 L500,320 L500,345 L400,345 L385,325Z",
  NV: "M165,250 L200,240 L225,275 L220,360 L185,370 L165,340Z",
  NH: "M862,140 L878,135 L878,175 L862,185 L855,170 L858,150Z",
  NJ: "M822,265 L835,255 L840,280 L835,310 L822,305 L818,285Z",
  NM: "M260,400 L345,395 L355,490 L265,500Z",
  NY: "M760,175 L840,165 L852,195 L852,208 L835,230 L835,255 L822,265 L800,255 L770,245 L760,210Z",
  NC: "M700,380 L790,365 L800,380 L780,400 L730,415 L700,420 L680,408 L695,390Z",
  ND: "M380,140 L475,135 L480,140 L480,195 L380,200Z",
  OH: "M655,280 L700,270 L715,300 L710,340 L700,350 L655,340 L650,285Z",
  OK: "M370,395 L400,395 L500,400 L500,425 L510,425 L510,440 L460,440 L400,445 L370,440Z",
  OR: "M115,170 L195,155 L200,175 L200,240 L165,250 L125,240 L110,210Z",
  PA: "M730,250 L800,240 L810,255 L810,290 L810,310 L770,310 L730,300Z",
  RI: "M876,196 L886,192 L888,205 L878,210 L873,205Z",
  SC: "M710,420 L730,415 L760,400 L770,415 L745,445 L715,450Z",
  SD: "M380,200 L480,195 L490,185 L505,255 L500,280 L480,275 L380,280Z",
  TN: "M610,400 L710,380 L710,420 L660,425 L595,425 L590,415Z",
  TX: "M345,420 L400,420 L400,445 L460,440 L510,440 L520,490 L515,540 L485,575 L440,590 L395,580 L360,560 L340,520 L330,480 L335,445Z",
  UT: "M225,275 L295,270 L295,310 L295,370 L248,375 L220,360Z",
  VT: "M845,140 L862,135 L862,185 L858,185 L852,190 L845,170Z",
  VA: "M695,340 L760,320 L790,335 L800,345 L795,365 L790,365 L700,380 L695,390 L680,370 L690,355Z",
  WA: "M125,95 L200,85 L210,130 L200,155 L195,155 L115,170 L110,140Z",
  WV: "M715,300 L740,290 L760,310 L760,335 L745,350 L730,360 L710,365 L700,350 L710,340Z",
  WI: "M540,165 L580,155 L600,175 L595,200 L580,220 L580,250 L575,270 L555,265 L540,245 L550,225 L545,190Z",
  WY: "M270,195 L365,185 L370,250 L370,290 L295,295 L275,280 L265,240Z",
  DC: "M787,335 L793,330 L795,338 L789,340Z",
};

function getStateColor(data?: StateData): string {
  if (!data || data.status === "none") return "#e5e7eb";
  if (data.status === "generating") return "#0ea5e9";
  if (data.status === "researched" && data.recommendation) {
    const rec = data.recommendation.toLowerCase();
    if (rec.includes("推荐") && !rec.includes("不推荐")) return "#10b981";
    if (rec.includes("谨慎") || rec.includes("评估")) return "#f59e0b";
    if (rec.includes("不推荐")) return "#ef4444";
    // English fallback
    if (rec.includes("recommend") && !rec.includes("not")) return "#10b981";
    if (rec.includes("caution") || rec.includes("evaluate")) return "#f59e0b";
    if (rec.includes("not recommend")) return "#ef4444";
  }
  return "#e5e7eb";
}

export default function USMap({ states, onStateClick }: USMapProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, stateCode: string) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({
        x: e.clientX - rect.left + 12,
        y: e.clientY - rect.top - 10,
        stateCode,
        stateName: STATE_NAMES_CN[stateCode] || STATE_NAMES[stateCode] || stateCode,
        data: states[stateCode],
      });
    },
    [states]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="relative w-full" style={{ aspectRatio: "960 / 600" }}>
      {/* Pulse animation for generating states */}
      <style>{`
        @keyframes pulse-state {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .state-generating {
          animation: pulse-state 1.5s ease-in-out infinite;
        }
        .state-path {
          cursor: pointer;
          stroke: #fff;
          stroke-width: 1.5;
          transition: opacity 0.15s, stroke-width 0.15s;
        }
        .state-path:hover {
          opacity: 0.8;
          stroke-width: 2.5;
          stroke: #1f2937;
        }
      `}</style>

      <svg
        ref={svgRef}
        viewBox="80 70 850 530"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {Object.entries(STATE_PATHS).map(([code, d]) => {
          const data = states[code];
          const fill = getStateColor(data);
          const isGenerating = data?.status === "generating";

          return (
            <path
              key={code}
              d={d}
              fill={fill}
              className={`state-path ${isGenerating ? "state-generating" : ""}`}
              onClick={() => onStateClick(code)}
              onMouseMove={(e) => handleMouseMove(e, code)}
              onMouseLeave={handleMouseLeave}
            />
          );
        })}

        {/* State labels */}
        {Object.entries(STATE_PATHS).map(([code]) => {
          // Compute centroid from the path bounding concept — use a simplified center
          const labelPos = getStateLabelPos(code);
          if (!labelPos) return null;
          return (
            <text
              key={`label-${code}`}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none select-none"
              fill="#374151"
              fontSize={code === "DC" ? 6 : 9}
              fontWeight={500}
            >
              {code}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translateY(-100%)",
            maxWidth: 220,
          }}
        >
          <div className="font-semibold text-sm mb-1">
            {tooltip.stateName} ({tooltip.stateCode})
          </div>
          {tooltip.data && tooltip.data.status === "researched" && (
            <>
              {tooltip.data.score !== undefined && (
                <div>
                  综合评分：
                  <span className="font-medium">{tooltip.data.score}</span>
                </div>
              )}
              {tooltip.data.recommendation && (
                <div>
                  建议：
                  <span className="font-medium">
                    {tooltip.data.recommendation}
                  </span>
                </div>
              )}
              {tooltip.data.population && (
                <div>人口：{tooltip.data.population}</div>
              )}
              {tooltip.data.income && (
                <div>收入中位数：{tooltip.data.income}</div>
              )}
            </>
          )}
          {tooltip.data?.status === "generating" && (
            <div className="text-sky-300">报告生成中...</div>
          )}
          {(!tooltip.data || tooltip.data.status === "none") && (
            <div className="text-gray-400">未调研 - 点击开始</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex gap-3 text-xs text-gray-600 bg-white/80 backdrop-blur rounded-md px-3 py-1.5">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "#10b981" }}
          />
          推荐进入
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "#f59e0b" }}
          />
          谨慎评估
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "#ef4444" }}
          />
          不推荐
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "#e5e7eb" }}
          />
          未调研
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "#0ea5e9" }}
          />
          生成中
        </span>
      </div>
    </div>
  );
}

/** Approximate label positions for each state */
function getStateLabelPos(
  code: string
): { x: number; y: number } | null {
  const positions: Record<string, { x: number; y: number }> = {
    AL: { x: 635, y: 465 }, AK: { x: 197, y: 500 }, AZ: { x: 242, y: 455 },
    AR: { x: 596, y: 446 }, CA: { x: 140, y: 370 }, CO: { x: 337, y: 340 },
    CT: { x: 866, y: 200 }, DE: { x: 820, y: 318 }, FL: { x: 710, y: 520 },
    GA: { x: 680, y: 455 }, HI: { x: 282, y: 532 }, ID: { x: 225, y: 220 },
    IL: { x: 590, y: 330 }, IN: { x: 640, y: 330 }, IA: { x: 537, y: 280 },
    KS: { x: 450, y: 372 }, KY: { x: 660, y: 375 }, LA: { x: 590, y: 495 },
    ME: { x: 882, y: 140 }, MD: { x: 785, y: 325 }, MA: { x: 872, y: 188 },
    MI: { x: 635, y: 215 }, MN: { x: 515, y: 195 }, MS: { x: 610, y: 468 },
    MO: { x: 537, y: 370 }, MT: { x: 308, y: 155 }, NE: { x: 440, y: 310 },
    NV: { x: 192, y: 305 }, NH: { x: 868, y: 160 }, NJ: { x: 830, y: 280 },
    NM: { x: 302, y: 445 }, NY: { x: 800, y: 210 }, NC: { x: 745, y: 395 },
    ND: { x: 428, y: 167 }, OH: { x: 685, y: 310 }, OK: { x: 445, y: 420 },
    OR: { x: 155, y: 195 }, PA: { x: 770, y: 275 }, RI: { x: 882, y: 200 },
    SC: { x: 735, y: 430 }, SD: { x: 435, y: 237 }, TN: { x: 655, y: 408 },
    TX: { x: 425, y: 500 }, UT: { x: 260, y: 325 }, VT: { x: 852, y: 162 },
    VA: { x: 745, y: 355 }, WA: { x: 155, y: 120 }, WV: { x: 730, y: 330 },
    WI: { x: 565, y: 210 }, WY: { x: 318, y: 240 }, DC: { x: 790, y: 337 },
  };
  return positions[code] || null;
}
