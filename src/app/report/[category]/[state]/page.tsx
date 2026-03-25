import { notFound } from "next/navigation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_BACKEND = process.env.API_BACKEND_URL || "http://8.140.216.113";

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
  overall_score?: number;
  population?: string;
  store_count?: number;
  estimated_revenue?: string;
  go_nogo?: string;
  recommendation?: string;
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

  // Fetch reports from backend
  let report: ReportData | null = null;
  let htmlContent = "";
  let pool: DataPool | null = null;

  try {
    const res = await fetch(`${API_BACKEND}/reports?product=${category}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const reports: ReportData[] = await res.json();
      report = reports.find((r) => r.state_code.toUpperCase() === stateCode) || null;
    }
  } catch {
    // backend unreachable
  }

  // Fetch HTML content
  if (report?.files?.["report.html"]) {
    try {
      const htmlRes = await fetch(report.files["report.html"], {
        next: { revalidate: 60 },
      });
      if (htmlRes.ok) {
        htmlContent = await htmlRes.text();
      }
    } catch { /* ignore */ }
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

  // Download links
  const downloads: { label: string; icon: string; url: string }[] = [];
  if (report?.files?.["report_a.docx"]) {
    downloads.push({ label: "数据报告", icon: "doc", url: report.files["report_a.docx"] });
  }
  if (report?.files?.["report_b.docx"]) {
    downloads.push({ label: "商业分析", icon: "chart", url: report.files["report_b.docx"] });
  }

  const goNogo = pool?.go_nogo ?? pool?.recommendation ?? "";
  const isGo = goNogo.toLowerCase().includes("go") && !goNogo.toLowerCase().includes("no");
  const isGoText = goNogo.includes("推荐") || isGo;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Fixed Top Nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#e5e7eb]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 3L5 8l5 5" />
              </svg>
              返回总览
            </a>
            <div className="h-5 w-px bg-[#e5e7eb]" />
            <h1 className="text-sm font-medium text-[#111827] truncate">
              {stateName} {categoryLabel}市场调研报告
            </h1>
          </div>
          {downloads.length > 0 && (
            <div className="flex gap-2">
              {downloads.map((d) => (
                <a
                  key={d.label}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs py-1.5 px-3"
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Key Insights Card */}
        {pool && (
          <div
            className="mb-8 p-6 rounded-2xl border border-[#e5e7eb] overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #eef2ff, #f5f3ff, #fdf2f8)" }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold ${
                      isGoText
                        ? "bg-[#10b981] text-white"
                        : "bg-[#ef4444] text-white"
                    }`}
                  >
                    {isGoText ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8.5l3.5 3.5L13 5" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    )}
                    {isGoText ? "建议进入" : "暂不建议"}
                  </span>
                  {pool.overall_score !== undefined && (
                    <span className="text-2xl font-bold text-[#111827]">{pool.overall_score}<span className="text-sm text-[#6b7280] font-normal">/100</span></span>
                  )}
                </div>
                <p className="text-sm text-[#6b7280]">{stateName} {categoryLabel}市场综合评估</p>
              </div>
              <div className="flex gap-6">
                {pool.population && (
                  <KeyStat label="人口" value={pool.population} />
                )}
                {pool.store_count !== undefined && (
                  <KeyStat label="现有店铺" value={String(pool.store_count)} />
                )}
                {pool.estimated_revenue && (
                  <KeyStat label="预计年营收" value={pool.estimated_revenue} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Report Content */}
        {htmlContent ? (
          <div className="card p-6 sm:p-8">
            <div
              className="report-content"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
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
