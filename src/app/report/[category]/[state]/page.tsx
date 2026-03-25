import { notFound } from "next/navigation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://bbfyfkjcvhpqmjticmsy.supabase.co";
const SUPABASE_BUCKET = "market-reports";

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

const CATEGORY_LABELS: Record<string, string> = {
  curtains: "窗帘/窗饰",
  blinds: "百叶窗",
  shutters: "卷帘",
};

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
  created_at: string;
  files: ReportFiles;
}

interface DataPool {
  demographics?: {
    state_level?: Array<{
      population?: number;
      median_income?: number;
      median_home_value?: number;
      housing_units?: number;
    }>;
  };
  economy?: Record<string, unknown>;
  industry_stats?: Record<string, unknown>;
  // Extracted summary fields (computed)
  _population?: string;
  _income?: string;
  _housing?: string;
}

// ---------------------------------------------------------------------------
// Page Component (Server Component)
// ---------------------------------------------------------------------------
export default async function ReportPage({
  params,
}: {
  params: Promise<{ category: string; state: string }>;
}) {
  const { category, state } = await params;
  const stateCode = state.toUpperCase();
  const stateName = US_STATES[stateCode];
  const categoryLabel = CATEGORY_LABELS[category] || category;

  if (!stateName) notFound();

  // Fetch reports from Supabase (no backend needed)
  let report: ReportData | null = null;
  let htmlUrl = "";
  let pool: DataPool | null = null;

  try {
    const indexUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${category}/index.json`;
    const res = await fetch(indexUrl, { next: { revalidate: 30 } });
    if (res.ok) {
      const reports: ReportData[] = await res.json();
      // Find latest report for this state
      const matches = reports.filter((r) => r.state_code.toUpperCase() === stateCode);
      report = matches.length > 0 ? matches[matches.length - 1] : null;
    }
  } catch {
    // supabase unreachable
  }

  // Get HTML URL for iframe (report.html is a full document with scripts/styles)
  if (report?.files?.["report.html"]) {
    htmlUrl = report.files["report.html"];
  }

  // Fetch data pool
  if (report?.files?.["data_pool.json"]) {
    try {
      const poolRes = await fetch(report.files["data_pool.json"], {
        next: { revalidate: 60 },
      });
      if (poolRes.ok) {
        pool = await poolRes.json();
      }
    } catch { /* ignore */ }
  }

  // Extract summary from data pool
  const stateData = pool?.demographics?.state_level?.[0];
  const population = stateData?.population;
  const income = stateData?.median_income;
  const homeValue = stateData?.median_home_value;
  const housingUnits = stateData?.housing_units;

  const popStr = population ? (population > 1000000 ? `${(population / 1000000).toFixed(1)}M` : `${(population / 1000).toFixed(0)}K`) : null;
  const incomeStr = income ? `$${income.toLocaleString()}` : null;
  const homeStr = homeValue ? `$${homeValue.toLocaleString()}` : null;
  const housingStr = housingUnits ? (housingUnits > 1000000 ? `${(housingUnits / 1000000).toFixed(1)}M` : `${(housingUnits / 1000).toFixed(0)}K`) : null;

  // Download links
  const downloads: { label: string; icon: string; url: string }[] = [];
  if (report?.files?.["report_a.docx"]) {
    downloads.push({ label: "数据报告", icon: "doc", url: report.files["report_a.docx"] });
  }
  if (report?.files?.["report_b.docx"]) {
    downloads.push({ label: "商业分析", icon: "chart", url: report.files["report_b.docx"] });
  }

  const hasData = !!stateData;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Fixed Top Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-[#e5e7eb] shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <a
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-[#6366f1] hover:text-[#4f46e5] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3L5 8l5 5" />
              </svg>
              总览
            </a>
            <div className="h-6 w-px bg-[#d1d5db]" />
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                {stateCode}
              </span>
              <div>
                <h1 className="text-base font-semibold text-[#111827] leading-tight">
                  {stateName} · {categoryLabel}
                </h1>
                <p className="text-xs text-[#9ca3af]">市场调研报告</p>
              </div>
            </div>
          </div>
          {downloads.length > 0 && (
            <div className="flex gap-2">
              {downloads.map((d) => (
                <a
                  key={d.label}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium py-2 px-4 rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb] hover:border-[#d1d5db] transition-all shadow-sm"
                >
                  {d.icon === "doc" ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 1.5h5.5L12 5v7.5a1 1 0 01-1 1H3a1 1 0 01-1-1v-11a1 1 0 011-1z" />
                      <path d="M8.5 1.5V5H12" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 11h2V6H2v5zM6 11h2V3H6v8zM10 11h2V7h-2v4z" />
                    </svg>
                  )}
                  {d.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        {/* Key Data Card — show when data exists */}
        {hasData && (
          <div
            className="mb-8 p-6 rounded-2xl border border-[#e5e7eb] overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #eef2ff, #f5f3ff, #fdf2f8)" }}
          >
            <p className="text-xs font-medium text-[#6366f1] uppercase tracking-wide mb-3">核心数据 · Census ACS 2023</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {popStr && <KeyStat label="州人口" value={popStr} />}
              {incomeStr && <KeyStat label="家庭收入中位数" value={incomeStr} />}
              {homeStr && <KeyStat label="房价中位数" value={homeStr} />}
              {housingStr && <KeyStat label="住房单元" value={housingStr} />}
            </div>
          </div>
        )}

        {/* Report Content */}
        {htmlUrl ? (
          <div className="card overflow-hidden" style={{ minHeight: "80vh" }}>
            <iframe
              src={htmlUrl}
              className="w-full border-0"
              style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
              title={`${stateName} ${categoryLabel} 市场调研报告`}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          <div className="card p-12 text-center">
            <div className="text-[#9ca3af] mb-4">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto">
                <path d="M12 6h16l8 8v28a2 2 0 01-2 2H12a2 2 0 01-2-2V8a2 2 0 012-2z" />
                <path d="M28 6v8h8" />
                <path d="M16 22h16M16 28h16M16 34h10" />
              </svg>
            </div>
            <p className="text-[#6b7280] text-sm">
              {report ? "报告内容加载中..." : "该州暂无调研报告"}
            </p>
            <a href="/" className="inline-block mt-4 text-sm text-[#6366f1] hover:underline">
              返回总览
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KeyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-[#6b7280] mb-1">{label}</p>
      <p className="text-lg font-bold text-[#111827]">{value}</p>
    </div>
  );
}
