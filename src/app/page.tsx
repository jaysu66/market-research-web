"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { US_MAP_VIEWBOX, US_STATE_PATHS } from "./us-map-paths";
import ScatterChart from './components/ScatterChart';
import DimensionTop5 from './components/DimensionTop5';
import TopStatesCards from './components/TopStatesCards';
import USMap from './components/USMap';

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

const US_STATES_CN: Record<string, string> = {
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
  WI: "威斯康星州", WY: "怀俄明州",
};

const STATE_CODES = Object.keys(US_STATES);

// US Tile Map positions: [col, row] 1-indexed for CSS grid (12 cols x 8 rows)
const US_MAP_POSITIONS: Record<string, [number, number]> = {
  ME: [12, 1],
  VT: [10, 1], NH: [11, 1],
  WA: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], WI: [7, 2], MI: [8, 2], NY: [10, 2], MA: [11, 2],
  OR: [2, 3], ID: [3, 3], SD: [4, 3], IA: [5, 3], IL: [6, 3], IN: [7, 3], OH: [8, 3], PA: [9, 3], NJ: [10, 3], CT: [11, 3], RI: [12, 3],
  NV: [2, 4], WY: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
  CA: [1, 5], UT: [3, 5], CO: [4, 5], KS: [5, 5], AR: [6, 5], TN: [7, 5], NC: [8, 5], SC: [9, 5],
  AZ: [3, 6], NM: [4, 6], OK: [5, 6], LA: [6, 6], MS: [7, 6], AL: [8, 6], GA: [9, 6],
  TX: [5, 7], FL: [9, 7],
  AK: [1, 8], HI: [2, 8],
};

const DEFAULT_CATEGORIES = [
  { key: "curtains", label: "窗帘/窗饰" },
  { key: "carpet", label: "地毯" },
  { key: "flooring", label: "地板" },
  { key: "sofa", label: "沙发/家具" },
];

// Map Chinese category keys to English (auto-fix for old localStorage data)
const CATEGORY_KEY_FIX: Record<string, string> = {
  "地毯": "carpet", "窗帘": "curtains", "窗帘_窗饰": "curtains",
  "墙纸": "wallpaper", "壁纸": "wallpaper", "灯具": "lighting",
  "家具": "furniture", "地板": "flooring", "瓷砖": "tiles",
};

function loadCategories(): { key: string; label: string }[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const saved = localStorage.getItem("market_categories");
    const deleted: string[] = JSON.parse(localStorage.getItem("market_categories_deleted") || "[]");
    const deletedSet = new Set(deleted);

    // Start with DEFAULT, excluding user-deleted ones
    const merged = DEFAULT_CATEGORIES.filter(c => !deletedSet.has(c.key));

    if (saved) {
      let extra: { key: string; label: string }[] = JSON.parse(saved);
      // Auto-fix Chinese keys
      extra = extra.map(c => {
        const fixed = CATEGORY_KEY_FIX[c.key];
        return fixed ? { key: fixed, label: c.label } : c;
      });
      // Add non-default, non-deleted entries
      const mergedKeys = new Set(merged.map(c => c.key));
      for (const c of extra) {
        if (!mergedKeys.has(c.key) && !deletedSet.has(c.key)) {
          merged.push(c);
        }
      }
    }
    // Deduplicate by key (safety net)
    const seen = new Set<string>();
    const result = merged.filter(c => {
      if (seen.has(c.key)) return false;
      seen.add(c.key);
      return true;
    });
    // Save clean version
    localStorage.setItem("market_categories", JSON.stringify(result));
    return result;
  } catch { /* ignore */ }
  return DEFAULT_CATEGORIES;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ReportFiles {
  "report.html"?: string;
  "report_a.docx"?: string;
  "report_b.docx"?: string;
  "data_pool.json"?: string;
  [key: string]: string | undefined;
}

interface ReportData {
  state_code: string;
  state_name: string;
  product: string;
  timestamp?: string;
  created_at: string;
  files: ReportFiles;
}

// Raw data pool from Supabase
interface RawDataPool {
  state?: string;
  state_name?: string;
  product?: string;
  demographics?: {
    state_level?: Array<{
      population?: number;
      median_income?: number;
      median_home_value?: number;
      housing_units?: number;
    }>;
    cities?: Array<{
      name?: string;
      population?: number;
      median_income?: number;
    }>;
  };
  local_businesses?: unknown[];
  industry_benchmarks?: {
    annual_revenue_range?: string;
    custom_gross_margin?: string;
    rent_pct?: string;
    labor_pct?: string;
  };
  search_extracted?: {
    pricing?: unknown[];
    rent?: unknown[];
    competition?: unknown[];
    businesses?: unknown[];
  };
  industry_stats?: {
    total_establishments?: number;
    [key: string]: unknown;
  };
  data_coverage?: unknown[];
  // Also support pre-computed scores if backend provides them
  overall_score?: number;
  market_size_score?: number;
  competition_score?: number;
  operating_cost_score?: number;
  growth_potential_score?: number;
  recommendation?: string;
  go_nogo?: string;
}

interface DataPoolState {
  overall_score?: number;
  market_size_score?: number;
  competition_score?: number;
  operating_cost_score?: number;
  growth_potential_score?: number;
  recommendation?: string;
  population?: string;
  store_count?: number;
  estimated_revenue?: string;
  go_nogo?: string;
  tam?: number;              // Total Addressable Market ($B)
  payback_months?: number;   // 回本月数
  recommended_city?: string; // 推荐城市（收入最高）
  rating?: string;           // 'strongly_recommended' | 'recommended' | 'cautious' | 'not_recommended'
  rating_label?: string;     // 中文标签
  rating_emoji?: string;     // emoji标识
  competition_density?: number; // 竞争密度 = store_count / (population / 10000)
  median_income?: number;       // 州收入中位数
}

/** Compute scores from raw data pool when pre-computed scores are absent */
function computeScores(raw: RawDataPool): DataPoolState {
  // If backend already provides scores, still compute the new fields
  if (raw.overall_score !== undefined) {
    const stData = raw.demographics?.state_level?.[0];
    const p = stData?.population ?? 0;
    const h = stData?.housing_units ?? 0;
    const backendTam = h > 0 ? Math.round((h * 65 / 1e9) * 100) / 100 : 0;
    let sc = 0;
    if (raw.industry_stats?.total_establishments) {
      sc = raw.industry_stats.total_establishments;
    } else if (raw.local_businesses && raw.local_businesses.length > 0) {
      sc = raw.local_businesses.length;
    }
    const cd = p > 0 ? Math.round((sc / (p / 10000)) * 100) / 100 : 0;
    const rw = 50000;
    const mc = rw * 2 / 12 + 2200 + 1600 + 2000;
    const mp = 20000 - mc;
    const pb = mp > 0 ? Math.round(150000 / mp) : 999;
    let rc = "";
    const ct = raw.demographics?.cities;
    if (ct && ct.length > 0) {
      const s = [...ct].sort((a, b) => (b.median_income ?? 0) - (a.median_income ?? 0));
      const rawRc = s[0]?.name ?? "";
      rc = rawRc
        .replace(/ city,.*$/, '')
        .replace(/ town,.*$/, '')
        .replace(/ CDP,.*$/, '')
        .replace(/ village,.*$/, '')
        .replace(/,.*$/, '')
        .trim();
    }
    const os = raw.overall_score;
    let rt: string, rl: string, re: string;
    if (os >= 80 && cd < 0.08) { rt = "strongly_recommended"; rl = "强烈推荐"; re = "\u{1F7E2}"; }
    else if (os >= 65) { rt = "recommended"; rl = "推荐"; re = "\u{1F7E1}"; }
    else if (os >= 50) { rt = "cautious"; rl = "谨慎"; re = "\u{1F7E0}"; }
    else { rt = "not_recommended"; rl = "不推荐"; re = "\u{1F534}"; }
    return {
      overall_score: raw.overall_score,
      market_size_score: raw.market_size_score,
      competition_score: raw.competition_score,
      operating_cost_score: raw.operating_cost_score,
      growth_potential_score: raw.growth_potential_score,
      recommendation: raw.recommendation,
      go_nogo: raw.go_nogo,
      tam: backendTam,
      store_count: sc,
      payback_months: pb,
      recommended_city: rc,
      rating: rt,
      rating_label: rl,
      rating_emoji: re,
      competition_density: cd,
      median_income: stData?.median_income ?? 0,
    };
  }

  const stateData = raw.demographics?.state_level?.[0];
  const pop = stateData?.population ?? 0;
  const income = stateData?.median_income ?? 0;
  const housing = stateData?.housing_units ?? 0;

  // --- Market Size Score (0-100): based on population and housing_units ---
  let market_size_score: number;
  if (pop > 10000000) {
    market_size_score = Math.min(100, 90 + Math.round((pop - 10000000) / 5000000));
  } else if (pop > 5000000) {
    market_size_score = 70 + Math.round(((pop - 5000000) / 5000000) * 20);
  } else if (pop > 1000000) {
    market_size_score = 50 + Math.round(((pop - 1000000) / 4000000) * 20);
  } else if (pop > 0) {
    market_size_score = 30 + Math.round((pop / 1000000) * 20);
  } else {
    market_size_score = 30;
  }
  // Boost for high housing units
  if (housing > 5000000) {
    market_size_score = Math.min(100, market_size_score + 5);
  }

  // --- Competition Score (0-100): based on local_businesses count / population ratio ---
  const bizCount = (raw.local_businesses?.length ?? 0) +
    (raw.search_extracted?.businesses?.length ?? 0) +
    (raw.search_extracted?.competition?.length ?? 0);
  let competition_score: number;
  if (bizCount === 0 || pop === 0) {
    competition_score = 50; // No data, default moderate
  } else {
    // Businesses per million people — lower ratio = less competition = higher score
    const bizPerMillion = (bizCount / pop) * 1000000;
    if (bizPerMillion > 200) {
      competition_score = 25;
    } else if (bizPerMillion > 100) {
      competition_score = 40;
    } else if (bizPerMillion > 50) {
      competition_score = 55;
    } else if (bizPerMillion > 20) {
      competition_score = 70;
    } else {
      competition_score = 85;
    }
  }

  // --- Operating Cost Score (0-100): based on median_income (inverse — high income = high cost = low score) ---
  let operating_cost_score: number;
  if (income > 80000) {
    operating_cost_score = 30 + Math.round(((100000 - Math.min(income, 100000)) / 20000) * 10);
  } else if (income > 60000) {
    operating_cost_score = 50 + Math.round(((80000 - income) / 20000) * 10);
  } else if (income > 40000) {
    operating_cost_score = 70 + Math.round(((60000 - income) / 20000) * 10);
  } else if (income > 0) {
    operating_cost_score = 80 + Math.round(((40000 - Math.max(income, 20000)) / 20000) * 10);
  } else {
    operating_cost_score = 50; // No data
  }
  operating_cost_score = Math.max(0, Math.min(100, operating_cost_score));

  // --- Growth Potential Score (0-100): based on housing_units growth proxy + population ---
  let growth_potential_score: number;
  const popFactor = Math.min(100, Math.round((pop / 20000000) * 60));
  const housingFactor = Math.min(100, Math.round((housing / 8000000) * 50));
  growth_potential_score = Math.min(100, Math.round((popFactor + housingFactor) / 2 + 20));

  // --- Overall Score: weighted average (market 40% + competition 20% + cost 20% + growth 20%) ---
  const overall_score = Math.round(
    market_size_score * 0.4 +
    competition_score * 0.2 +
    operating_cost_score * 0.2 +
    growth_potential_score * 0.2
  );

  // --- Recommendation ---
  let recommendation: string;
  let go_nogo: string;
  if (overall_score >= 70) {
    recommendation = "推荐进入";
    go_nogo = "go";
  } else if (overall_score >= 50) {
    recommendation = "谨慎评估";
    go_nogo = "evaluate";
  } else {
    recommendation = "不推荐";
    go_nogo = "no-go";
  }

  // Population display string
  const popStr = pop > 1000000
    ? `${(pop / 1000000).toFixed(1)}M`
    : pop > 0
      ? `${(pop / 1000).toFixed(0)}K`
      : "--";

  // Revenue estimate from benchmarks
  const estimated_revenue = raw.industry_benchmarks?.annual_revenue_range ?? "";

  // --- TAM (Total Addressable Market) in $B ---
  const tam = housing > 0 ? Math.round((housing * 65 / 1e9) * 100) / 100 : 0;

  // --- Store count: prefer industry_stats, fallback to local_businesses ---
  let store_count = 0;
  if (raw.industry_stats?.total_establishments) {
    store_count = raw.industry_stats.total_establishments;
  } else if (raw.local_businesses && typeof raw.local_businesses === 'object') {
    // local_businesses is {city: [businesses]} not an array
    for (const v of Object.values(raw.local_businesses)) {
      if (Array.isArray(v)) store_count += v.length;
    }
  }
  // Fallback: estimate from search_extracted businesses
  if (store_count === 0 && raw.search_extracted?.businesses) {
    const biz = raw.search_extracted.businesses;
    store_count = Array.isArray(biz) ? biz.length : 0;
  }

  // --- Competition density: stores per 10,000 people ---
  const competition_density = pop > 0 ? Math.round((store_count / (pop / 10000)) * 100) / 100 : 0;

  // --- Payback months (use state-specific data when available) ---
  const state_income = stateData?.median_income ?? 60000;
  const rent_ratio = state_income > 80000 ? 1.5 : state_income > 60000 ? 1.2 : 1.0;
  const monthly_labor = Math.round((state_income * 0.8) * 2 / 12); // 2 employees at 80% of median
  const monthly_rent = Math.round(2200 * rent_ratio);
  const monthly_marketing = 1600;
  const monthly_other = 2000;
  const monthly_cost = monthly_labor + monthly_rent + monthly_marketing + monthly_other;
  const monthly_revenue = Math.round(20000 * rent_ratio); // higher income areas = higher revenue
  const monthly_profit = monthly_revenue - monthly_cost;
  const payback_months = monthly_profit > 0 ? Math.round(150000 / monthly_profit) : 999;

  // --- Recommended city: highest median_income ---
  let recommended_city = "";
  const cities = raw.demographics?.cities;
  if (cities && cities.length > 0) {
    const sorted = [...cities].sort((a, b) => (b.median_income ?? 0) - (a.median_income ?? 0));
    const rawName = sorted[0]?.name ?? "";
    recommended_city = rawName
      .replace(/ city,.*$/, '')
      .replace(/ town,.*$/, '')
      .replace(/ CDP,.*$/, '')
      .replace(/ village,.*$/, '')
      .replace(/,.*$/, '')
      .trim();
  }

  // --- 4-level rating ---
  let rating: string;
  let rating_label: string;
  let rating_emoji: string;
  if (overall_score >= 80 && competition_density < 0.08) {
    rating = "strongly_recommended";
    rating_label = "强烈推荐";
    rating_emoji = "\u{1F7E2}"; // 🟢
  } else if (overall_score >= 65) {
    rating = "recommended";
    rating_label = "推荐";
    rating_emoji = "\u{1F7E1}"; // 🟡
  } else if (overall_score >= 50) {
    rating = "cautious";
    rating_label = "谨慎";
    rating_emoji = "\u{1F7E0}"; // 🟠
  } else {
    rating = "not_recommended";
    rating_label = "不推荐";
    rating_emoji = "\u{1F534}"; // 🔴
  }

  return {
    overall_score,
    market_size_score,
    competition_score,
    operating_cost_score,
    growth_potential_score,
    recommendation,
    go_nogo,
    population: popStr,
    estimated_revenue,
    tam,
    store_count,
    payback_months,
    recommended_city,
    rating,
    rating_label,
    rating_emoji,
    competition_density,
    median_income: stateData?.median_income ?? 0,
  };
}

interface StateInfo {
  code: string;
  name: string;
  report: ReportData | null;
  pool: DataPoolState | null;
  generating: boolean;
  taskId: string | null;
  progress: number;
  step: string;
}

type SortKey = "rank" | "state" | "overall" | "market" | "competition" | "cost" | "growth" | "recommendation";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Parse backend step text like "Stage 2/5: Running AI search queries..." into step index (0-4)
function parseStageIndex(step: string): number {
  if (!step) return -1;
  // Match "Stage X/5" pattern
  const m = step.match(/Stage\s+(\d+)\/(\d+)/i);
  if (m) return parseInt(m[1], 10) - 1; // 0-based index
  // Fallback: match old simple keys
  const simpleMap: Record<string, number> = { collecting: 0, searching: 1, cleaning: 2, generating: 3, exporting: 4 };
  if (step in simpleMap) return simpleMap[step];
  // Check keywords
  if (step.includes('Collecting') || step.includes('API')) return 0;
  if (step.includes('search') || step.includes('Search')) return 1;
  if (step.includes('Clean') || step.includes('verif')) return 2;
  if (step.includes('Generat') || step.includes('report')) return 3;
  if (step.includes('Upload') || step.includes('export') || step.includes('Export')) return 4;
  if (step === 'Done!' || step.includes('Done')) return 5;
  return -1;
}

function getStepLabel(step: string): string {
  const idx = parseStageIndex(step);
  const labels = ["API采集中", "AI搜索中", "数据清洗", "报告生成中", "导出上传"];
  if (idx >= 0 && idx < labels.length) return labels[idx];
  if (idx >= labels.length) return "已完成";
  // Show backend text directly if available
  if (step && step.length > 3) {
    // Extract the descriptive part after "Stage X/5: "
    const m = step.match(/Stage\s+\d+\/\d+:\s*(.+)/i);
    return m ? m[1] : step;
  }
  return "处理中";
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const [category, setCategory] = useState("curtains");
  const [catList, setCatList] = useState(DEFAULT_CATEGORIES);
  const [states, setStates] = useState<Record<string, StateInfo>>({});
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<string | null>(null);
  // confirmPos removed — popup uses fixed centering via CSS transform
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [mapView, setMapView] = useState<"tile" | "svg">("svg");
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState<string[]>([]);
  const [showComparePanel, setShowComparePanel] = useState(false);
  const radarChartRef = useRef<HTMLDivElement>(null);
  const echartsLoadedRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const pollingRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Language toggle
  const [lang, setLang] = useState<'cn' | 'en'>('cn');

  useEffect(() => {
    const saved = localStorage.getItem('market_lang');
    if (saved === 'en') setLang('en');
  }, []);

  const toggleLang = () => {
    const next = lang === 'cn' ? 'en' : 'cn';
    setLang(next);
    localStorage.setItem('market_lang', next);
  };

  const t = (cn: string, en: string) => lang === 'cn' ? cn : en;
  const stateName = (code: string) => lang === 'cn'
    ? `${US_STATES_CN[code]} (${code})`
    : `${US_STATES[code]} (${code})`;
  const stateDisplayName = (code: string) => lang === 'cn'
    ? (US_STATES_CN[code] || US_STATES[code])
    : US_STATES[code];
  const ratingLabel = (label: string) => {
    if (lang === 'en') {
      const map: Record<string, string> = {
        '强烈推荐': 'Strong Buy', '推荐': 'Buy', '谨慎': 'Hold', '不推荐': 'Avoid',
      };
      return map[label] || label;
    }
    return label;
  };

  // Load categories from localStorage
  useEffect(() => {
    setCatList(loadCategories());
  }, []);

  // Scroll progress
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      setScrollProgress((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fade-in on scroll with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    const els = document.querySelectorAll('.fade-in');
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, category]);

  // Initialize state map
  useEffect(() => {
    const init: Record<string, StateInfo> = {};
    for (const code of STATE_CODES) {
      init[code] = {
        code,
        name: US_STATES[code],
        report: null,
        pool: null,
        generating: false,
        taskId: null,
        progress: 0,
        step: "",
      };
    }
    setStates(init);
  }, []);

  // Fetch reports for category
  const fetchReports = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reports?product=${cat}`);
      if (!res.ok) throw new Error("fetch failed");
      const reports: ReportData[] = await res.json();

      // Load data pools for each report and compute scores
      const poolPromises = reports.map(async (r) => {
        const poolUrl = r.files?.["data_pool.json"];
        if (!poolUrl) return { code: r.state_code, pool: null };
        try {
          const pRes = await fetch(poolUrl);
          if (pRes.ok) {
            const rawPool: RawDataPool = await pRes.json();
            const pool = computeScores(rawPool);
            return { code: r.state_code, pool };
          }
        } catch { /* ignore */ }
        return { code: r.state_code, pool: null };
      });

      const pools = await Promise.all(poolPromises);
      const poolMap: Record<string, DataPoolState | null> = {};
      for (const p of pools) poolMap[p.code] = p.pool;

      setStates((prev) => {
        const next = { ...prev };
        // Reset all non-generating states
        for (const code of STATE_CODES) {
          if (!next[code].generating) {
            next[code] = { ...next[code], report: null, pool: null };
          }
        }
        for (const r of reports) {
          const code = r.state_code;
          if (next[code]) {
            // Don't override generating state — let polling handle completion
            if (next[code].generating) {
              next[code] = {
                ...next[code],
                report: r,
                pool: poolMap[code] ?? null,
                // Keep generating/taskId/progress/step intact
              };
            } else {
              next[code] = {
                ...next[code],
                report: r,
                pool: poolMap[code] ?? null,
                generating: false,
                taskId: null,
                progress: 0,
                step: "",
              };
            }
          }
        }
        return next;
      });
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(category);
  }, [category, fetchReports]);

  // Restore generating tasks from localStorage
  // Also auto-add missing categories if tasks exist for unlisted categories
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('generating_tasks') || '{}');
      const entries = Object.entries(saved) as [string, { taskId: string; category: string; step?: string; progress?: number }][];
      if (entries.length > 0) {
        // Auto-add category if it's not in catList (e.g., carpet added from workspace)
        const taskCategories = new Set(entries.map(([, t]) => t.category));
        const currentKeys = new Set(catList.map(c => c.key));
        for (const tc of taskCategories) {
          if (!currentKeys.has(tc)) {
            setCatList(prev => {
              const updated = [...prev, { key: tc, label: tc }];
              try { localStorage.setItem("market_categories", JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
        }

        setStates(prev => {
          const next = { ...prev };
          for (const [code, { taskId, category: cat, step: savedStep, progress: savedProgress }] of entries) {
            if (cat === category && next[code]) {
              next[code] = { ...next[code], generating: true, taskId, progress: savedProgress ?? 0, step: savedStep ?? 'collecting' };
              pollingRef.current.add(code);
            }
          }
          return next;
        });
      }
    } catch { /* ignore */ }
  }, [category, catList]);

  // Polling for generating tasks
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const fetchReportsRef = useRef(fetchReports);
  fetchReportsRef.current = fetchReports;

  useEffect(() => {
    const poll = async () => {
      const codes = Array.from(pollingRef.current);
      if (codes.length === 0) return;

      for (const code of codes) {
        // Read taskId from current state via functional updater pattern
        let taskId: string | null = null;
        setStates((prev) => {
          taskId = prev[code]?.taskId ?? null;
          return prev; // no mutation
        });
        if (!taskId) continue;
        try {
          const res = await fetch(`${API}/status/${taskId}`);
          if (res.status === 404) {
            // Task not found (server restarted) — clean up
            pollingRef.current.delete(code);
            try {
              const tasks = JSON.parse(localStorage.getItem('generating_tasks') || '{}');
              delete tasks[code];
              localStorage.setItem('generating_tasks', JSON.stringify(tasks));
            } catch { /* ignore */ }
            setStates((prev) => ({
              ...prev,
              [code]: { ...prev[code], generating: false, progress: 0, step: "" },
            }));
          } else if (res.ok) {
            const data = await res.json();
            if (data.status === "completed" || data.status === "error") {
              pollingRef.current.delete(code);
              try {
                const tasks = JSON.parse(localStorage.getItem('generating_tasks') || '{}');
                delete tasks[code];
                localStorage.setItem('generating_tasks', JSON.stringify(tasks));
              } catch { /* ignore */ }
              if (data.status === "completed") {
                setTimeout(() => fetchReportsRef.current(categoryRef.current), 1000);
              }
              setStates((prev) => ({
                ...prev,
                [code]: {
                  ...prev[code],
                  generating: data.status !== "completed",
                  progress: data.progress ?? 100,
                  step: data.step ?? "",
                },
              }));
            } else {
              // Update state
              setStates((prev) => ({
                ...prev,
                [code]: {
                  ...prev[code],
                  progress: data.progress ?? 0,
                  step: data.step ?? "",
                },
              }));
              // Persist latest step/progress to localStorage so refresh doesn't lose it
              try {
                const tasks = JSON.parse(localStorage.getItem('generating_tasks') || '{}');
                if (tasks[code]) {
                  tasks[code].step = data.step ?? "";
                  tasks[code].progress = data.progress ?? 0;
                  localStorage.setItem('generating_tasks', JSON.stringify(tasks));
                }
              } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // stable — reads state through refs and functional updaters

  // Start generation for a state
  const startGeneration = async (code: string) => {
    setConfirmState(null);
    setStates((prev) => ({
      ...prev,
      [code]: { ...prev[code], generating: true, progress: 0, step: "collecting" },
    }));

    try {
      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_code: code, product: category }),
      });
      if (res.ok) {
        const data = await res.json();
        // Persist to localStorage
        try {
          const tasks = JSON.parse(localStorage.getItem('generating_tasks') || '{}');
          tasks[code] = { taskId: data.task_id, category };
          localStorage.setItem('generating_tasks', JSON.stringify(tasks));
        } catch { /* ignore */ }
        setStates((prev) => ({
          ...prev,
          [code]: { ...prev[code], taskId: data.task_id },
        }));
        pollingRef.current.add(code);
      } else {
        setStates((prev) => ({
          ...prev,
          [code]: { ...prev[code], generating: false },
        }));
      }
    } catch {
      setStates((prev) => ({
        ...prev,
        [code]: { ...prev[code], generating: false },
      }));
    }
  };

  // Batch generate all un-researched states
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);

  const unresearchedCodes = STATE_CODES.filter(
    (code) => !states[code]?.report && !states[code]?.generating
  );

  // Regenerate a single researched state from table
  const handleRegenFromTable = async (code: string) => {
    const name = lang === 'cn' ? US_STATES_CN[code] : US_STATES[code];
    if (!confirm(t(
      `确认重新生成 ${name} 的报告？将花费约15-20分钟。`,
      `Regenerate ${name} report? This takes ~15-20 minutes.`
    ))) return;
    startGeneration(code);
  };

  // Batch regenerate all researched states
  const handleBatchRegen = async () => {
    const researched = sortedStates.filter(s => s.report && !s.generating);
    if (researched.length === 0) return;
    if (!confirm(t(
      `确认重新生成全部 ${researched.length} 个已调研州的报告？\n每个州约15-20分钟，将依次生成。`,
      `Regenerate all ${researched.length} researched states? ~15-20 min each, processed sequentially.`
    ))) return;

    for (const s of researched) {
      try {
        const res = await fetch(`${API}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state_code: s.code, product: category }),
        });
        if (res.ok) {
          const data = await res.json();
          setStates(prev => ({
            ...prev,
            [s.code]: { ...prev[s.code], generating: true, taskId: data.task_id, progress: 0, step: 'collecting' },
          }));
          pollingRef.current.add(s.code);
          try {
            const tasks = JSON.parse(localStorage.getItem('generating_tasks') || '{}');
            tasks[s.code] = { taskId: data.task_id, category };
            localStorage.setItem('generating_tasks', JSON.stringify(tasks));
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
  };

  const startBatchAll = async () => {
    setBatchConfirm(false);
    setBatchRunning(true);
    // Generate one at a time with 2s delay to avoid overwhelming the API
    for (const code of unresearchedCodes) {
      await startGeneration(code);
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 2000));
    }
    setBatchRunning(false);
  };

  // Handle state card click
  const handleCardClick = (code: string, e: React.MouseEvent) => {
    const info = states[code];
    if (!info) return;

    if (info.report) {
      window.open(`/report/${category}/${code}`, "_blank");
      return;
    }

    if (info.generating) return;

    // Show confirm popup (centered via CSS)
    setConfirmState(code);
  };

  // Computed: researched states for table
  const researchedStates = STATE_CODES
    .filter((code) => states[code]?.report && states[code]?.pool)
    .map((code) => states[code]);

  // Sort
  const sortedStates = [...researchedStates].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "state": return dir * a.name.localeCompare(b.name);
      case "overall": return dir * ((a.pool?.overall_score ?? 0) - (b.pool?.overall_score ?? 0));
      case "market": return dir * ((a.pool?.market_size_score ?? 0) - (b.pool?.market_size_score ?? 0));
      case "competition": return dir * ((a.pool?.competition_score ?? 0) - (b.pool?.competition_score ?? 0));
      case "cost": return dir * ((a.pool?.operating_cost_score ?? 0) - (b.pool?.operating_cost_score ?? 0));
      case "growth": return dir * ((a.pool?.growth_potential_score ?? 0) - (b.pool?.growth_potential_score ?? 0));
      default: return dir * ((a.pool?.overall_score ?? 0) - (b.pool?.overall_score ?? 0));
    }
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Compare mode handlers
  const toggleCompareSelect = (code: string) => {
    setCompareSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      return [...prev, code];
    });
  };

  const openComparePanel = () => {
    setShowComparePanel(true);
    // Load ECharts if not loaded
    if (!echartsLoadedRef.current && typeof window !== "undefined") {
      const existing = document.querySelector('script[src*="echarts"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js";
        script.onload = () => {
          echartsLoadedRef.current = true;
          renderRadarChart();
        };
        document.head.appendChild(script);
      } else {
        echartsLoadedRef.current = true;
        setTimeout(renderRadarChart, 100);
      }
    } else {
      setTimeout(renderRadarChart, 100);
    }
  };

  const closeComparePanel = () => {
    setShowComparePanel(false);
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setCompareSelected([]);
    setShowComparePanel(false);
  };

  const renderRadarChart = () => {
    if (!radarChartRef.current) return;
    const echarts = (window as unknown as Record<string, unknown>).echarts as {
      init: (el: HTMLElement) => {
        setOption: (opt: unknown) => void;
        resize: () => void;
        dispose: () => void;
      };
      getInstanceByDom: (el: HTMLElement) => unknown;
    };
    if (!echarts) return;

    // Dispose existing instance
    const existingInstance = echarts.getInstanceByDom(radarChartRef.current);
    if (existingInstance) {
      (existingInstance as { dispose: () => void }).dispose();
    }

    const chart = echarts.init(radarChartRef.current);
    const colors = ["#0ea5e9", "#10b981", "#f59e0b"];
    const selectedStates = compareSelected.map((code) => states[code]).filter(Boolean);

    const option = {
      color: colors,
      legend: {
        data: selectedStates.map((s) => `${stateDisplayName(s.code)} (${s.code})`),
        bottom: 0,
        textStyle: { color: "#6b7280", fontSize: 12 },
      },
      radar: {
        indicator: [
          { name: t("市场规模", "Market"), max: 100 },
          { name: t("竞争强度", "Competition"), max: 100 },
          { name: t("运营成本", "Cost"), max: 100 },
          { name: t("增长潜力", "Growth"), max: 100 },
          { name: t("综合评分", "Overall"), max: 100 },
        ],
        shape: "circle",
        splitNumber: 4,
        axisName: { color: "#374151", fontSize: 12 },
        splitLine: { lineStyle: { color: "#e5e7eb" } },
        splitArea: { areaStyle: { color: ["rgba(14,165,233,0.02)", "rgba(14,165,233,0.05)"] } },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
      },
      series: [
        {
          type: "radar",
          data: selectedStates.map((s, i) => ({
            value: [
              s.pool?.market_size_score ?? 0,
              s.pool?.competition_score ?? 0,
              s.pool?.operating_cost_score ?? 0,
              s.pool?.growth_potential_score ?? 0,
              s.pool?.overall_score ?? 0,
            ],
            name: `${stateDisplayName(s.code)} (${s.code})`,
            lineStyle: { width: 2, color: colors[i] },
            areaStyle: { color: colors[i], opacity: 0.1 },
            itemStyle: { color: colors[i] },
          })),
        },
      ],
    };

    chart.setOption(option);
    // Handle resize — attach listener, will be cleaned up when chart is disposed
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    // Store cleanup function for later disposal
    (radarChartRef.current as HTMLElement & { _cleanupResize?: () => void })._cleanupResize?.();
    (radarChartRef.current as HTMLElement & { _cleanupResize?: () => void })._cleanupResize = () => {
      window.removeEventListener("resize", handleResize);
    };
  };

  // Re-render radar chart when panel opens or selection changes
  useEffect(() => {
    if (showComparePanel && echartsLoadedRef.current && compareSelected.length >= 2) {
      setTimeout(renderRadarChart, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComparePanel, compareSelected]);

  // Generate AI comparison summary
  const generateComparisonSummary = (): string => {
    const selected = compareSelected.map((code) => states[code]).filter(Boolean);
    if (selected.length < 2) return "";

    const best = selected.reduce((a, b) =>
      (a.pool?.overall_score ?? 0) >= (b.pool?.overall_score ?? 0) ? a : b
    );
    const worst = selected.reduce((a, b) =>
      (a.pool?.overall_score ?? 0) <= (b.pool?.overall_score ?? 0) ? a : b
    );

    const bestMarket = selected.reduce((a, b) =>
      (a.pool?.market_size_score ?? 0) >= (b.pool?.market_size_score ?? 0) ? a : b
    );
    const bestCost = selected.reduce((a, b) =>
      (a.pool?.operating_cost_score ?? 0) >= (b.pool?.operating_cost_score ?? 0) ? a : b
    );
    const bestGrowth = selected.reduce((a, b) =>
      (a.pool?.growth_potential_score ?? 0) >= (b.pool?.growth_potential_score ?? 0) ? a : b
    );
    const bestComp = selected.reduce((a, b) =>
      (a.pool?.competition_score ?? 0) >= (b.pool?.competition_score ?? 0) ? a : b
    );

    const cnName = (s: StateInfo) => US_STATES_CN[s.code] || s.name;
    const names = selected.map((s) => cnName(s)).join("、");
    const scoreDiff = (best.pool?.overall_score ?? 0) - (worst.pool?.overall_score ?? 0);

    let summary = `综合对比 ${names}：`;
    summary += `${cnName(best)} 综合评分最高（${best.pool?.overall_score ?? 0}分），`;
    if (scoreDiff <= 5) {
      summary += `各州评分接近，差距仅 ${scoreDiff} 分。`;
    } else {
      summary += `领先 ${cnName(worst)}（${worst.pool?.overall_score ?? 0}分）${scoreDiff} 分。`;
    }

    const advantages: string[] = [];
    if (bestMarket.code === best.code) advantages.push("市场规模");
    if (bestCost.code === best.code) advantages.push("运营成本");
    if (bestGrowth.code === best.code) advantages.push("增长潜力");
    if (bestComp.code === best.code) advantages.push("竞争环境");

    if (advantages.length > 0) {
      summary += ` ${cnName(best)} 在${advantages.join("、")}方面具有优势。`;
    }

    if (bestCost.code !== best.code) {
      summary += ` 若注重成本控制，${cnName(bestCost)} 的运营成本评分更优（${bestCost.pool?.operating_cost_score ?? 0}分）。`;
    }

    const bestRec = best.pool?.recommendation ?? best.pool?.go_nogo ?? "";
    if (bestRec.includes("推荐") || bestRec.toLowerCase() === "go") {
      summary += ` 建议优先考虑 ${cnName(best)}。`;
    }

    return summary;
  };

  // Stats
  const researchedCount = STATE_CODES.filter((c) => states[c]?.report).length;
  const generatingCount = STATE_CODES.filter((c) => states[c]?.generating).length;
  // recommendCount and lastUpdate available if needed in future
  // const recommendCount = researchedStates.filter(
  //   (s) => s.pool?.recommendation?.includes("推荐") || s.pool?.go_nogo?.toLowerCase() === "go"
  // ).length;

  // Aggregate values for Hero
  const totalStores = researchedStates.reduce((sum, s) => sum + (s.pool?.store_count ?? 0), 0);
  const totalTAM = researchedStates.reduce((sum, s) => sum + (s.pool?.tam ?? 0), 0).toFixed(1);
  const stronglyRecommendedCount = researchedStates.filter(s => s.pool?.rating === 'strongly_recommended').length;
  const avgDensity = researchedStates.length > 0
    ? (researchedStates.reduce((sum, s) => sum + (s.pool?.competition_density ?? 0), 0) / researchedStates.length).toFixed(2)
    : "0.00";

  // Current category label
  const currentCategory = catList.find(c => c.key === category)?.label ?? category;

  // handleStateClick wrapper for USMap (no event needed)
  const handleStateClick = (code: string) => {
    const info = states[code];
    if (!info) return;
    if (info.report) {
      window.open(`/report/${category}/${code}`, "_blank");
      return;
    }
    if (info.generating) return;
    // Show confirm popup (centered via CSS)
    setConfirmState(code);
  };

  // Filtered states for ranking table
  const filteredStates = sortedStates.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.code.toLowerCase().includes(q) ||
           s.name.toLowerCase().includes(q) ||
           (US_STATES_CN[s.code] ?? '').includes(q) ||
           (s.pool?.recommended_city ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      {/* Scroll Progress */}
      <div className="fixed top-0 left-0 h-[3px] bg-gradient-to-r from-sky-500 to-cyan-500 z-[9999] transition-all duration-100"
        style={{ width: `${scrollProgress}%` }} />
      {/* ---- Sticky Nav ---- */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e7eb]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                   style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}>
                M
              </div>
              <span className="font-semibold text-[#111827] text-base hidden sm:inline">MarketScope</span>
            </div>
            <div className="h-6 w-px bg-[#e5e7eb] hidden sm:block" />
            {/* Category Tabs */}
            <div className="flex gap-1 bg-[#f3f4f6] p-1 rounded-full">
              {catList.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`tab ${category === cat.key ? "tab-active" : ""}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleLang} className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors font-medium">
              {lang === 'cn' ? '中/EN' : 'CN/En'}
            </button>
            <a href="/workspace" className="btn-secondary text-sm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
              {t('工作台', 'Workspace')}
            </a>
          </div>
        </div>
      </nav>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* ---- Dark Hero Header — Manus Style ---- */}
          <header className="bg-[#09090b] text-white pt-10 pb-16 px-6 relative overflow-hidden">
            <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.15)_0%,transparent_70%)]" />
            <div className="max-w-[1400px] mx-auto relative z-10">
              {/* 数据源标签 */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {[
                  { label: "Census ACS 2023", cls: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
                  { label: "FRED 2024", cls: "bg-green-600/20 text-green-400 border-green-600/30" },
                  { label: "BLS 2024", cls: "bg-amber-600/20 text-amber-400 border-amber-600/30" },
                  { label: "Census CBP 2022", cls: "bg-sky-600/20 text-sky-400 border-sky-600/30" },
                  { label: "Perplexity Sonar", cls: "bg-cyan-600/20 text-cyan-400 border-cyan-600/30" },
                ].map(s => (
                  <span key={s.label} className={`text-xs font-mono px-2 py-1 rounded border ${s.cls}`}>{s.label}</span>
                ))}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                {t('美国50州', 'US 50 States')}<br />
                <span className="text-blue-400">{currentCategory}</span>{t('市场调研平台', ' Market Research')}
              </h1>
              <p className="text-zinc-400 text-lg max-w-2xl mb-6">
                {t(
                  '基于 Census、FRED、BLS、HUD 官方数据及AI深度搜索，为每个州生成完整的市场调研报告与投资决策建议。',
                  'Powered by Census, FRED, BLS, HUD official data and AI deep search. Generate complete market research reports and investment recommendations for every state.'
                )}
              </p>
              {/* 全局统计数字行 */}
              <div className="flex gap-6 text-sm text-zinc-400 flex-wrap">
                <span><strong className="text-white">{researchedCount}</strong> {t('个州已调研', 'states researched')}</span>
                <span className="hidden sm:inline">&middot;</span>
                <span><strong className="text-white">{totalStores}</strong> {t('家竞争商家', 'competitors')}</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>{t('总TAM', 'Total TAM')} <strong className="text-white">${totalTAM}B</strong></span>
                <span className="hidden sm:inline">&middot;</span>
                <span><strong className="text-white">{stronglyRecommendedCount}</strong> {t('个强烈推荐州', 'strongly recommended')}</span>
              </div>
              {/* Batch generate button */}
              {unresearchedCodes.length > 0 && (
                <div className="mt-5">
                  {batchRunning ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-sm text-zinc-300">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      {t(`正在批量生成中...（${generatingCount} 个州在队列中）`, `Batch generating... (${generatingCount} states in queue)`)}
                    </div>
                  ) : batchConfirm ? (
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 rounded-lg text-sm">
                      <span className="text-zinc-300">{t(`确认生成剩余`, 'Generate remaining')} <strong className="text-white">{unresearchedCodes.length}</strong> {t(`个州？预计耗时 ${Math.ceil(unresearchedCodes.length * 20)} 分钟`, ` states? Est. ${Math.ceil(unresearchedCodes.length * 20)} min`)}</span>
                      <button onClick={startBatchAll} className="px-3 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-500 transition-colors">{t('确认开始', 'Confirm')}</button>
                      <button onClick={() => setBatchConfirm(false)} className="px-3 py-1 bg-white/10 text-zinc-400 rounded-md text-xs hover:bg-white/20 transition-colors">{t('取消', 'Cancel')}</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setBatchConfirm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-600/30 transition-colors"
                    >
                      {t(`🚀 一键生成剩余 ${unresearchedCodes.length} 个州`, `🚀 Generate all ${unresearchedCodes.length} remaining states`)}
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* ---- Sticky Stat Bar ---- */}
          <div className="bg-white border-b border-zinc-200 sticky top-[57px] z-40 shadow-sm">
            <div className="max-w-[1400px] mx-auto px-6 py-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-0.5">{t('全国总TAM', 'Total TAM')}</div>
                  <div className="text-2xl font-bold font-mono text-[#2563eb]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>${totalTAM}B</div>
                  <div className="text-xs text-zinc-400">{t(`${currentCategory}市场规模估算`, `${currentCategory} market size est.`)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-0.5">{t('平均竞争密度', 'Avg Density')}</div>
                  <div className="text-2xl font-bold font-mono text-[#10b981]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{avgDensity}</div>
                  <div className="text-xs text-zinc-400">{t('店/万人（已调研均值）', 'stores/10K pop (avg)')}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-0.5">{t('强烈推荐州', 'Top Rated')}</div>
                  <div className="text-2xl font-bold font-mono text-[#15803d]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{stronglyRecommendedCount} {t('个', '')}</div>
                  <div className="text-xs text-zinc-400">{t('综合评分最优', 'Highest overall score')}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-0.5">{t(`${currentCategory}店总数`, 'Total Stores')}</div>
                  <div className="text-2xl font-bold font-mono text-[#f59e0b]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{totalStores}</div>
                  <div className="text-xs text-zinc-400">NAICS 442291 [Census CBP]</div>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Main Content ---- */}
          <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 pb-8">

            {/* Map + Scatter + Top10 — full width stacked */}
            <div className="space-y-6 mb-8">
                {/* Map Section */}
                <section className="fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-zinc-900 mb-1">{t('美国地图 — 市场评级热力图', 'US Map — Market Rating Heatmap')}</h2>
                      <p className="text-sm text-zinc-500 mb-4">{t('点击任意州查看详细报告 · 颜色代表评级', 'Click any state for details · Color = rating')}</p>
                    </div>
                    <div className="map-view-toggle">
                      <button
                        className={mapView === "tile" ? "active" : ""}
                        onClick={() => setMapView("tile")}
                      >
                        {t('方块', 'Tile')}
                      </button>
                      <button
                        className={mapView === "svg" ? "active" : ""}
                        onClick={() => setMapView("svg")}
                      >
                        {t('地图', 'Map')}
                      </button>
                    </div>
                  </div>
                  <div className="card p-6">
                    {mapView === "svg" ? (
                      <SvgMapView states={states} onCardClick={handleCardClick} />
                    ) : (
                      <>
                        <div className="us-tile-map">
                          {STATE_CODES.map((code) => {
                            const pos = US_MAP_POSITIONS[code];
                            if (!pos) return null;
                            const info = states[code];
                            const hasReport = !!info?.report;
                            const isGenerating = info?.generating;
                            const score = info?.pool?.overall_score;
                            const rec = info?.pool?.recommendation ?? info?.pool?.go_nogo ?? "";

                            let bgColor = "#f3f4f6";
                            if (hasReport) {
                              if (rec.includes("推荐") || rec.toLowerCase() === "go") bgColor = "#10b981";
                              else if (rec.includes("谨慎") || rec.includes("观望")) bgColor = "#f59e0b";
                              else if (rec.includes("不推荐") || rec.toLowerCase().includes("no")) bgColor = "#ef4444";
                              else bgColor = "#0ea5e9";
                            }
                            if (isGenerating) bgColor = "#bae6fd";

                            return (
                              <div
                                key={code}
                                className="map-tile"
                                style={{
                                  gridColumn: pos[0],
                                  gridRow: pos[1],
                                  backgroundColor: bgColor,
                                }}
                                onClick={(e) => handleCardClick(code, e)}
                                title={`${stateDisplayName(code)} (${code}) ${score ? `${score}${t('分', 'pts')}` : hasReport ? t("已调研", "Researched") : t("未调研", "Not researched")}`}
                              >
                                <span className={`text-[10px] font-bold ${hasReport ? "text-white" : "text-[#9ca3af]"}`}>
                                  {code}
                                </span>
                                {hasReport && score !== undefined && (
                                  <span className="text-[8px] text-white/80">{score}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-4 text-xs text-[#6b7280] flex-wrap">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#10b981]"></span> {t('强烈推荐', 'Strong Buy')}</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#eab308]"></span> {t('推荐', 'Buy')}</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#f59e0b]"></span> {t('谨慎', 'Hold')}</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#ef4444]"></span> {t('不推荐', 'Avoid')}</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#bae6fd]"></span> {t('生成中', 'Generating')}</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#e5e7eb]"></span> {t('未调研', 'Not researched')}</span>
                    </div>
                  </div>
                </section>

                {/* Scatter Chart (show when 2+ states) */}
                {researchedStates.length >= 2 && (
                  <div className="fade-in bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
                    <ScatterChart states={researchedStates.map(s => ({
                      code: s.code,
                      name: stateDisplayName(s.code),
                      tam: s.pool?.tam ?? 0,
                      density: s.pool?.competition_density ?? 0,
                      income: s.pool?.median_income ?? 0,
                      rating: s.pool?.rating ?? 'cautious',
                    }))} lang={lang} />
                  </div>
                )}

                {/* Top 10 推荐州 — 水平柱状图 */}
                {researchedStates.length > 0 && (
                  <section className="fade-in">
                    <TopStatesCards
                      lang={lang}
                      states={sortedStates.filter(s => s.report).slice(0, 10).map((s, i) => ({
                        rank: i + 1,
                        code: s.code,
                        name: stateDisplayName(s.code),
                        rating_label: s.pool?.rating_label ?? '未评级',
                        rating_emoji: s.pool?.rating_emoji ?? '',
                        recommended_city: s.pool?.recommended_city ?? '',
                        tam: s.pool?.tam ?? 0,
                        competition_density: s.pool?.competition_density ?? 0,
                        overall_score: s.pool?.overall_score ?? 0,
                      }))}
                      onStateClick={handleStateClick}
                    />
                  </section>
                )}
            </div>

            {/* 50-State Grid — removed, ranking table serves as overview */}
            <section className="mb-8" style={{ display: 'none' }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#111827]">美国50州调研总览</h2>
                  <p className="text-sm text-[#6b7280] mt-1">
                    点击已调研州查看报告 / 点击未调研州发起调研
                  </p>
                </div>
                {generatingCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-[#0ea5e9]">
                    <div className="w-4 h-4 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
                    {generatingCount} 个州正在生成中
                  </div>
                )}
              </div>

              <div className="state-grid grid gap-1.5" style={{ gridTemplateColumns: "repeat(10, 1fr)" }}>
                {STATE_CODES.map((code) => {
                  const info = states[code];
                  if (!info) return null;
                  const hasReport = !!info.report;
                  const isGenerating = info.generating;
                  const score = info.pool?.overall_score;
                  const rec = info.pool?.recommendation ?? info.pool?.go_nogo ?? "";
                  const isCaution = rec.includes("谨慎") || rec.includes("观望");
                  const isNotRecommend = rec.includes("不推荐") || rec.toLowerCase() === "no-go" || rec.toLowerCase() === "nogo";

                  let barColor = "#10b981";
                  if (isCaution) barColor = "#f59e0b";
                  if (isNotRecommend) barColor = "#ef4444";

                  return (
                    <div
                      key={code}
                      onClick={(e) => handleCardClick(code, e)}
                      className={`
                        relative flex flex-col items-center justify-center py-3 px-2 transition-all cursor-pointer
                        ${hasReport ? "state-card" : isGenerating ? "state-card state-card-generating" : "state-card state-card-empty"}
                      `}
                      style={{ minHeight: 56 }}
                    >
                      {hasReport && (
                        <div className="state-card-bar" style={{ backgroundColor: barColor }} />
                      )}

                      <span className={`text-base font-bold leading-none ${
                        hasReport ? "text-[#111827]" : isGenerating ? "text-[#0ea5e9]" : "text-[#9ca3af]"
                      }`}>
                        {code}
                      </span>
                      <span className="text-[10px] text-[#9ca3af] mt-1 leading-tight truncate w-full text-center">
                        {US_STATES[code]}
                      </span>

                      {hasReport && score !== undefined && (
                        <span className="text-xs font-semibold mt-1.5" style={{ color: barColor }}>
                          {score}
                        </span>
                      )}

                      {isGenerating && (
                        <div className="flex flex-col items-center gap-1 mt-1.5">
                          <div className="w-3 h-3 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] text-[#0ea5e9] leading-tight text-center">
                            {getStepLabel(info.step)}
                          </span>
                          {info.progress > 0 && (
                            <span className="text-[9px] text-[#9ca3af]">{info.progress}%</span>
                          )}
                        </div>
                      )}

                      {!hasReport && !isGenerating && (
                        <span className="text-[10px] text-transparent group-hover:text-[#9ca3af] mt-1.5 opacity-0 hover:opacity-100 transition-opacity">
                          点击生成
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Active generation progress */}
            {(() => {
              const generatingStates = STATE_CODES
                .filter(code => states[code]?.generating)
                .map(code => states[code]);
              if (generatingStates.length === 0) return null;
              return (
                <section className="mb-10">
                  <h2 className="text-lg font-bold text-[#111827] mb-4">{t('生成进度', 'Generation Progress')}</h2>
                  <div className="grid gap-3">
                    {generatingStates.map(s => (
                      <div key={s.code} className="card p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-zinc-400 text-xs">{s.code}</span>
                            <span className="font-bold text-[#111827]">{stateDisplayName(s.code)}</span>
                          </div>
                          <span className="text-sm text-[#0ea5e9] font-medium">{getStepLabel(s.step)}</span>
                        </div>
                        {/* Backend step detail */}
                        {s.step && s.step.length > 5 && (
                          <div className="text-xs text-zinc-500 mb-2 bg-zinc-50 rounded-lg px-3 py-1.5 font-mono">
                            {s.step} {s.progress > 0 && <span className="text-[#0ea5e9] ml-2">{s.progress}%</span>}
                          </div>
                        )}
                        <div className="flex gap-1">
                          {['collecting','searching','cleaning','generating','exporting'].map((step, i) => {
                            const currentIdx = parseStageIndex(s.step);
                            const isDone = i < currentIdx;
                            const isCurrent = i === currentIdx;
                            return (
                              <div key={step} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className={`h-1.5 w-full rounded-full ${
                                    isDone ? 'bg-[#10b981]' : isCurrent ? 'bg-[#0ea5e9] animate-pulse' : 'bg-[#e5e7eb]'
                                  }`}
                                />
                                <span className={`text-[9px] ${isCurrent ? 'text-[#0ea5e9] font-medium' : isDone ? 'text-[#10b981]' : 'text-[#9ca3af]'}`}>
                                  {['采集','搜索','清洗','生成','导出'][i]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* Confirm Popup */}
            {confirmState && (
              <>
                <div className="confirm-popup-overlay" onClick={() => setConfirmState(null)} />
                <div
                  className="confirm-popup"
                  style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', position: 'fixed', zIndex: 9999 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base font-bold">{stateName(confirmState)}</span>
                  </div>
                  <p className="text-sm text-[#6b7280] mb-4">
                    {t(
                      `确认为该州生成 `,
                      'Generate '
                    )}<strong className="text-[#111827]">{catList.find(c => c.key === category)?.label}</strong>{t(' 市场调研报告？', ' market research report for this state?')}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setConfirmState(null)} className="btn-ghost text-sm">
                      {t('取消', 'Cancel')}
                    </button>
                    <button onClick={() => startGeneration(confirmState)} className="btn-primary text-sm">
                      {t('确认生成', 'Generate')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Dimension Top 5 */}
            {researchedStates.length >= 3 && (
              <DimensionTop5 states={researchedStates.map(s => ({
                code: s.code,
                name: stateDisplayName(s.code),
                tam: s.pool?.tam ?? 0,
                income: s.pool?.median_income ?? 0,
                growth: s.pool?.growth_potential_score ?? 0,
                competition: s.pool?.competition_score ?? 50,
              }))} />
            )}

            {/* Section: Ranking Table */}
            {sortedStates.length > 0 && (
              <section className="fade-in mb-12">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-zinc-900 mb-1">{t('50州综合排名表', '50 States Ranking')}</h2>
                  <p className="text-sm text-zinc-500 mb-4">{t('点击列标题排序 · 点击行查看详细报告', 'Click header to sort · Click row for details')}</p>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder={t("搜索州名/城市...", "Search state/city...")}

                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-2 border border-zinc-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30"
                    />
                    <span className="text-sm text-zinc-400">{t(`共 ${filteredStates.length} 个州`, `${filteredStates.length} states`)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {compareMode && compareSelected.length >= 2 && (
                      <button
                        onClick={openComparePanel}
                        className="btn-primary text-sm flex items-center gap-1.5"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M4 12V6M8 12V4M12 12V8" />
                        </svg>
                        {t(`对比 ${compareSelected.length} 个州`, `Compare ${compareSelected.length} states`)}
                      </button>
                    )}
                    {compareMode ? (
                      <button onClick={exitCompareMode} className="btn-ghost text-sm">
                        {t('退出对比', 'Exit Compare')}
                      </button>
                    ) : (
                      <button
                        onClick={() => setCompareMode(true)}
                        className="btn-secondary text-sm flex items-center gap-1.5"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M4 12V6M8 12V4M12 12V8" />
                        </svg>
                        {t('对比模式', 'Compare')}
                      </button>
                    )}
                    {sortedStates.filter(s => s.report && !s.generating).length > 0 && !compareMode && (
                      <button
                        onClick={handleBatchRegen}
                        className="btn-secondary text-sm flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t('批量重新生成', 'Batch Regenerate')}
                      </button>
                    )}
                  </div>
                </div>
                {compareMode && (
                  <div className="mb-4 p-3 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] text-sm text-[#0f172a] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 5v3M8 10.5v.5" strokeLinecap="round" />
                      </svg>
                      {t(`勾选要对比的州（已选 ${compareSelected.length}）`, `Select states to compare (${compareSelected.length} selected)`)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const researched = sortedStates.filter((s) => s.report).map((s) => s.code);
                          setCompareSelected(researched);
                        }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-[#0f172a] text-white hover:bg-[#0c4a6e] transition-colors"
                      >
                        {t('全选已调研', 'Select All')}
                      </button>
                      {compareSelected.length > 0 && (
                        <button
                          onClick={() => setCompareSelected([])}
                          className="text-xs px-2.5 py-1 rounded-lg bg-white border border-[#bae6fd] text-[#0f172a] hover:bg-[#f0f9ff] transition-colors"
                        >
                          {t('清空', 'Clear')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr className="bg-[#f9fafb]">
                          {compareMode && <th className="w-12"></th>}
                          <th className="w-16">#</th>
                          <SortHeader label={t("州", "State")} sortKey="state" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <th>{t('评级', 'Rating')}</th>
                          <SortHeader label={t("综合评分", "Overall")} sortKey="overall" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <SortHeader label={t("市场规模", "Market Size")} sortKey="market" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <SortHeader label={t("竞争强度", "Competition")} sortKey="competition" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <SortHeader label={t("运营成本", "Cost")} sortKey="cost" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <SortHeader label={t("增长潜力", "Growth")} sortKey="growth" current={sortKey} dir={sortDir} onClick={toggleSort} />
                          <th>{t(`${currentCategory}店数`, 'Stores')}</th>
                          <th>{t('竞争密度', 'Density')}</th>
                          <th>TAM($B)</th>
                          <th>{t('回本(月)', 'Payback')}</th>
                          <th>{t('推荐城市', 'City')}</th>
                          <th className="text-left py-3 px-2 text-xs font-medium text-zinc-500">{t('操作', 'Actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStates.map((s, i) => {
                          const p = s.pool;
                          return (
                            <tr
                              key={s.code}
                              className={`cursor-pointer ${compareMode && compareSelected.includes(s.code) ? "bg-[#f0f9ff]" : ""}`}
                              onClick={() => {
                                if (compareMode) {
                                  toggleCompareSelect(s.code);
                                } else {
                                  window.open(`/report/${category}/${s.code}`, "_blank");
                                }
                              }}
                            >
                              {compareMode && (
                                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={compareSelected.includes(s.code)}
                                    onChange={() => toggleCompareSelect(s.code)}
                                    disabled={false}
                                    className="w-4 h-4 rounded border-[#d1d5db] text-[#0ea5e9] focus:ring-[#0ea5e9] cursor-pointer accent-[#0ea5e9]"
                                  />
                                </td>
                              )}
                              <td className="text-[#9ca3af] font-medium">{i + 1}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-zinc-400 text-xs">{s.code}</span>
                                  <span className="font-bold text-[#111827]">{stateDisplayName(s.code)}</span>
                                </div>
                              </td>
                              <td>
                                <span className="text-sm whitespace-nowrap">
                                  {p?.rating_emoji ?? ''} {ratingLabel(p?.rating_label ?? '--')}
                                </span>
                              </td>
                              <td><ScoreCell value={p?.overall_score} /></td>
                              <td><ScoreCell value={p?.market_size_score} /></td>
                              <td><ScoreCell value={p?.competition_score} /></td>
                              <td><ScoreCell value={p?.operating_cost_score} /></td>
                              <td><ScoreCell value={p?.growth_potential_score} /></td>
                              <td className="text-sm text-[#374151] font-mono">{p?.store_count ?? '--'}</td>
                              <td className="text-sm text-[#374151] font-mono">{p?.competition_density != null ? p.competition_density.toFixed(2) : '--'}</td>
                              <td className="text-sm text-[#374151] font-mono">${p?.tam != null ? p.tam.toFixed(2) : '--'}</td>
                              <td className="text-sm text-[#374151] font-mono">{p?.payback_months ?? '--'}</td>
                              <td className="text-sm text-[#6b7280] max-w-[120px] truncate">{p?.recommended_city || '--'}</td>
                              <td className="py-3 px-2">
                                {s.report && !s.generating && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRegenFromTable(s.code); }}
                                    className="text-xs text-zinc-400 hover:text-[#0ea5e9] transition-colors"
                                    title={t('重新生成报告', 'Regenerate report')}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </main>

          {/* Footer */}
          <footer className="bg-zinc-900 text-zinc-400 py-8 mt-12">
            <div className="max-w-[1400px] mx-auto px-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="text-white font-bold mb-1">{t(`美国50州${currentCategory}市场调研平台`, `US 50 States ${currentCategory} Market Research`)}</div>
                  <div className="text-xs leading-relaxed">{t('数据来源：US Census Bureau ACS 2023 | Census Business Patterns 2022 | FRED 2024 | BLS OEWS 2024 | HUD Fair Market Rent 2026', 'Data: US Census Bureau ACS 2023 | Census Business Patterns 2022 | FRED 2024 | BLS OEWS 2024 | HUD Fair Market Rent 2026')}</div>
                </div>
                <div className="text-xs text-zinc-500">{t('报告生成时间：2026年3月 · 仅供参考，不构成投资建议', 'Generated: Mar 2026 · For reference only, not investment advice')}</div>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* ---- Compare Panel (Slide Up) ---- */}
      {showComparePanel && compareSelected.length >= 2 && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-[60] transition-opacity"
            onClick={closeComparePanel}
            style={{ animation: "fadeIn 0.3s ease" }}
          />
          {/* Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] overflow-y-auto"
            style={{
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderTop: "1px solid rgba(14,165,233,0.2)",
              borderRadius: "24px 24px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
              animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            {/* Panel Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]/60"
              style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", borderRadius: "24px 24px 0 0" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: "linear-gradient(135deg, #0f172a, #0c4a6e)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 12V6M8 12V4M12 12V8" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#111827]">{t('跨州对比分析', 'Cross-State Comparison')}</h3>
                  <p className="text-xs text-[#6b7280]">
                    {compareSelected.map((c) => `${states[c]?.name ?? c}`).join(" vs ")}
                  </p>
                </div>
              </div>
              <button
                onClick={closeComparePanel}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f3f4f6] transition-colors text-[#6b7280] hover:text-[#111827]"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l8 8M14 6l-8 8" />
                </svg>
              </button>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6">
              {/* Radar Chart + Key Metrics side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Radar Chart */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-[#e5e7eb]/50">
                  <h4 className="text-sm font-semibold text-[#111827] mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9]"></span>
                    {t('五维雷达图', 'Radar Chart')}
                  </h4>
                  <div ref={radarChartRef} style={{ width: "100%", height: 320 }} />
                </div>

                {/* Key Metrics Table */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-[#e5e7eb]/50">
                  <h4 className="text-sm font-semibold text-[#111827] mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                    {t('关键指标对比', 'Key Metrics')}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#e5e7eb]">
                          <th className="text-left py-2.5 px-3 text-[#6b7280] font-medium text-xs">{t('指标', 'Metric')}</th>
                          {compareSelected.map((code) => (
                            <th key={code} className="text-center py-2.5 px-3 font-semibold text-[#111827] text-xs">
                              <span className="inline-flex items-center gap-1">
                                {code}
                                <span className="text-[#9ca3af] font-normal">{stateDisplayName(code)}</span>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: t("综合评分", "Overall"), key: "overall_score" as const, unit: t("分", "pts") },
                          { label: t("市场规模", "Market"), key: "market_size_score" as const, unit: t("分", "pts") },
                          { label: t("竞争强度", "Competition"), key: "competition_score" as const, unit: t("分", "pts") },
                          { label: t("运营成本", "Cost"), key: "operating_cost_score" as const, unit: t("分", "pts") },
                          { label: t("增长潜力", "Growth"), key: "growth_potential_score" as const, unit: t("分", "pts") },
                        ].map((metric) => {
                          const values = compareSelected.map((code) => states[code]?.pool?.[metric.key] ?? 0);
                          const maxVal = Math.max(...values);
                          return (
                            <tr key={metric.key} className="border-b border-[#f3f4f6]">
                              <td className="py-2.5 px-3 text-[#6b7280] text-xs">{metric.label}</td>
                              {compareSelected.map((code, idx) => {
                                const val = values[idx];
                                const isBest = val === maxVal && values.filter((v) => v === maxVal).length === 1;
                                return (
                                  <td key={code} className="text-center py-2.5 px-3">
                                    <span className={`text-sm font-semibold ${isBest ? "text-[#0ea5e9]" : "text-[#374151]"}`}>
                                      {val}
                                      <span className="text-[10px] text-[#9ca3af] ml-0.5">{metric.unit}</span>
                                    </span>
                                    {isBest && (
                                      <span className="ml-1 text-[10px] text-[#0ea5e9] font-medium">{t('最优', 'Best')}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        {/* Population row */}
                        <tr className="border-b border-[#f3f4f6]">
                          <td className="py-2.5 px-3 text-[#6b7280] text-xs">{t('人口', 'Population')}</td>
                          {compareSelected.map((code) => (
                            <td key={code} className="text-center py-2.5 px-3 text-sm font-medium text-[#374151]">
                              {states[code]?.pool?.population ?? "--"}
                            </td>
                          ))}
                        </tr>
                        {/* Revenue row */}
                        <tr className="border-b border-[#f3f4f6]">
                          <td className="py-2.5 px-3 text-[#6b7280] text-xs">{t('预估收入', 'Est. Revenue')}</td>
                          {compareSelected.map((code) => (
                            <td key={code} className="text-center py-2.5 px-3 text-sm font-medium text-[#374151]">
                              {states[code]?.pool?.estimated_revenue || "--"}
                            </td>
                          ))}
                        </tr>
                        {/* Recommendation row */}
                        <tr>
                          <td className="py-2.5 px-3 text-[#6b7280] text-xs">{t('建议', 'Recommendation')}</td>
                          {compareSelected.map((code) => {
                            const rec = states[code]?.pool?.recommendation ?? states[code]?.pool?.go_nogo ?? "--";
                            const isGo = rec.includes("推荐") || rec.toLowerCase() === "go";
                            const isNo = rec.includes("不推荐") || rec.toLowerCase().includes("no");
                            return (
                              <td key={code} className="text-center py-2.5 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isGo ? "bg-[#d1fae5] text-[#065f46]" : isNo ? "bg-[#fee2e2] text-[#991b1b]" : "bg-[#fef3c7] text-[#92400e]"
                                }`}>
                                  {rec}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* AI Comparison Summary */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-[#e5e7eb]/50">
                <h4 className="text-sm font-semibold text-[#111827] mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9]"></span>
                  {t('AI 对比摘要', 'AI Comparison Summary')}
                </h4>
                <p className="text-sm text-[#374151] leading-relaxed">
                  {generateComparisonSummary()}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Compare Panel Animations + Fade-in */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in { opacity: 0; transform: translateY(28px); transition: opacity 0.6s ease, transform 0.6s ease; animation: fadeInFallback 0.8s ease forwards; animation-delay: 0.3s; }
        .fade-in.visible { opacity: 1; transform: translateY(0); animation: none; }
        @keyframes fadeInFallback { to { opacity: 1; transform: translateY(0); } }
      ` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  sortKey: key,
  current,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  const active = current === key;
  return (
    <th onClick={() => onClick(key)} className={active ? "text-[#0ea5e9]" : ""}>
      <div className="flex items-center gap-1">
        {label}
        {active && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            {dir === "asc"
              ? <path d="M6 3L10 8H2L6 3Z" />
              : <path d="M6 9L2 4H10L6 9Z" />
            }
          </svg>
        )}
      </div>
    </th>
  );
}

function ScoreCell({ value }: { value?: number }) {
  if (value === undefined || value === null) {
    return <span className="text-[#9ca3af]">--</span>;
  }

  let color = "#10b981";
  if (value < 40) color = "#ef4444";
  else if (value < 60) color = "#f59e0b";
  else if (value < 75) color = "#0ea5e9";

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold w-8" style={{ color }}>{value}</span>
      <div className="score-bar flex-1">
        <div className="score-bar-fill" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Map View
// ---------------------------------------------------------------------------
function getStateFillColor(info: StateInfo | undefined): string {
  if (!info) return "#e5e7eb";
  if (info.generating) return "#bae6fd";
  if (!info.report) return "#e5e7eb";
  // Use 4-level rating system
  const rating = info.pool?.rating ?? "";
  if (rating === "strongly_recommended") return "#16a34a"; // 深绿
  if (rating === "recommended") return "#4ade80";          // 浅绿
  if (rating === "cautious") return "#f97316";             // 橙
  if (rating === "not_recommended") return "#dc2626";      // 红
  // Fallback to old logic
  const rec = info.pool?.recommendation ?? info.pool?.rating_label ?? "";
  if (rec === "强烈推荐") return "#16a34a";
  if (rec === "推荐") return "#4ade80";
  if (rec === "谨慎") return "#f97316";
  if (rec === "不推荐") return "#dc2626";
  return "#10b981";
}

function getRecommendationLabel(info: StateInfo): string {
  if (!info.report) return "未调研";
  const rec = info.pool?.recommendation ?? info.pool?.go_nogo ?? "";
  if (rec.includes("推荐") || rec.toLowerCase() === "go") return "\u2705 推荐进入";
  if (rec.includes("谨慎") || rec.includes("观望")) return "\u26a0\ufe0f 谨慎评估";
  if (rec.includes("不推荐") || rec.toLowerCase().includes("no")) return "\u274c 不推荐";
  return "\ud83d\udcca 已调研";
}

function SvgMapView({
  states,
  onCardClick,
}: {
  states: Record<string, StateInfo>;
  onCardClick: (code: string, e: React.MouseEvent) => void;
}) {
  const [tooltip, setTooltip] = useState<{
    code: string;
    x: number;
    y: number;
  } | null>(null);

  const handleMouseEnter = (code: string, e: React.MouseEvent) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    setTooltip({
      code,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const tooltipInfo = tooltip ? states[tooltip.code] : null;

  return (
    <div className="svg-map-container">
      <svg viewBox={US_MAP_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
        {Object.entries(US_STATE_PATHS).map(([code, pathD]) => {
          const info = states[code];
          const fillColor = getStateFillColor(info);
          const isGenerating = info?.generating;
          return (
            <path
              key={code}
              d={pathD}
              fill={fillColor}
              className={isGenerating ? "svg-map-generating" : ""}
              onMouseEnter={(e) => handleMouseEnter(code, e)}
              onMouseLeave={handleMouseLeave}
              onClick={(e) => onCardClick(code, e as unknown as React.MouseEvent)}
            />
          );
        })}
      </svg>

      {/* Tooltip - Manus style dark card */}
      {tooltip && tooltipInfo && (() => {
        const info = tooltipInfo;
        return (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x + 16,
              top: tooltip.y - 10,
              zIndex: 9999,
              background: 'rgba(15, 23, 42, 0.95)',
              color: 'white',
              borderRadius: '12px',
              padding: '14px 18px',
              fontSize: '13px',
              lineHeight: '1.8',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              pointerEvents: 'none' as const,
              minWidth: '200px',
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
              {US_STATES_CN[tooltip.code]} ({tooltip.code})
            </div>
            <div>评级：{info?.pool?.rating_emoji} {info?.pool?.rating_label || '未调研'}</div>
            {info?.pool?.store_count !== undefined && (
              <div>竞争商家：{info.pool.store_count} 家</div>
            )}
            {info?.pool?.competition_density !== undefined && (
              <div>竞争密度：{info.pool.competition_density.toFixed(2)} 店/万人</div>
            )}
            {info?.pool?.median_income !== undefined && info.pool.median_income > 0 && (
              <div>收入中位数：${info.pool.median_income.toLocaleString()}</div>
            )}
            <div>TAM：${info?.pool?.tam?.toFixed(1) || '?'}B</div>
            {info?.report && (
              <div style={{ marginTop: '6px', color: '#38bdf8', fontSize: '12px' }}>
                点击查看报告 →
              </div>
            )}
            {!info?.report && info?.generating && (
              <div style={{ marginTop: '6px', color: '#38bdf8', fontSize: '12px' }}>
                报告生成中...
              </div>
            )}
            {!info?.report && !info?.generating && (
              <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '12px' }}>
                点击生成报告
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
