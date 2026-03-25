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

  // Fetch reports from Supabase
  let report: ReportData | null = null;
  let htmlUrl = "";

  try {
    const indexUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${category}/index.json`;
    const res = await fetch(indexUrl, { next: { revalidate: 30 } });
    if (res.ok) {
      const reports: ReportData[] = await res.json();
      const matches = reports.filter((r) => r.state_code.toUpperCase() === stateCode);
      report = matches.length > 0 ? matches[matches.length - 1] : null;
    }
  } catch {
    // supabase unreachable
  }

  // Get HTML URL — proxy through our API to strip restrictive CSP
  if (report?.files?.["report.html"]) {
    htmlUrl = `/api/report-html?url=${encodeURIComponent(report.files["report.html"])}`;
  }

  // Download links
  const downloads: { label: string; icon: string; url: string }[] = [];
  if (report?.files?.["report_a.docx"]) {
    downloads.push({ label: "数据报告", icon: "doc", url: report.files["report_a.docx"] });
  }
  if (report?.files?.["report_b.docx"]) {
    downloads.push({ label: "商业分析", icon: "chart", url: report.files["report_b.docx"] });
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* Compact Top Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-[#e5e7eb] shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="flex items-center gap-1.5 text-sm font-medium text-[#6366f1] hover:text-[#4f46e5] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3L5 8l5 5" />
              </svg>
              总览
            </a>
            <div className="h-5 w-px bg-[#e5e7eb]" />
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-bold text-white"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
              >
                {stateCode}
              </span>
              <span className="text-sm font-semibold text-[#111827]">
                {stateName} · {categoryLabel}
              </span>
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
                  className="inline-flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb] hover:border-[#6366f1] hover:text-[#6366f1] transition-all"
                >
                  {d.icon === "doc" ? (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 1.5h5.5L12 5v7.5a1 1 0 01-1 1H3a1 1 0 01-1-1v-11a1 1 0 011-1z" />
                      <path d="M8.5 1.5V5H12" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
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

      {/* Report Content — iframe takes full remaining space */}
      {htmlUrl ? (
        <main className="flex-1 flex flex-col">
          <iframe
            src={htmlUrl}
            className="flex-1 w-full border-0"
            style={{ minHeight: "calc(100vh - 56px)" }}
            title={`${stateName} ${categoryLabel} 市场调研报告`}
            sandbox="allow-scripts allow-same-origin"
          />
        </main>
      ) : (
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center p-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#f3f4f6] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                <path d="M12 6h16l8 8v28a2 2 0 01-2 2H12a2 2 0 01-2-2V8a2 2 0 012-2z" />
                <path d="M28 6v8h8" />
                <path d="M16 22h16M16 28h16M16 34h10" />
              </svg>
            </div>
            <p className="text-[#6b7280] text-sm mb-1">
              {report ? "报告内容加载中..." : "该州暂无调研报告"}
            </p>
            <p className="text-xs text-[#9ca3af] mb-4">
              {report ? "请稍候" : "请从总览页发起调研"}
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-[#6366f1] hover:text-[#4f46e5] font-medium"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10 3L5 8l5 5" />
              </svg>
              返回总览
            </a>
          </div>
        </main>
      )}
    </div>
  );
}
