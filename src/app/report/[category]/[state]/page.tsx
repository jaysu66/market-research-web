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

const CATEGORY_LABELS: Record<string, string> = {
  curtains: "窗帘/窗饰",
  carpet: "地毯",
  wallpaper: "墙纸/壁纸",
  lighting: "灯具",
  furniture: "家具",
  flooring: "地板",
  sofa: "沙发/家具",
};

// Map Chinese category keys (from old localStorage) to English keys used in Supabase
const CATEGORY_KEY_MAP: Record<string, string> = {
  "窗帘": "curtains", "窗帘/窗饰": "curtains",
  "地毯": "carpet",
  "墙纸": "wallpaper", "壁纸": "wallpaper",
  "灯具": "lighting",
  "家具": "furniture",
  "地板": "flooring",
  "沙发": "sofa", "沙发/家具": "sofa",
  "瓷砖": "tiles",
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
  const { category: rawCategory, state } = await params;
  const stateCode = state.toUpperCase();
  const stateName = US_STATES[stateCode];
  // Normalize category key: decode URL-encoded Chinese and map to English key
  const decodedCategory = decodeURIComponent(rawCategory);
  const category = CATEGORY_KEY_MAP[decodedCategory] || decodedCategory;
  const categoryLabel = CATEGORY_LABELS[category] || decodedCategory;

  if (!stateName) notFound();

  // Fetch reports from Supabase
  let report: ReportData | null = null;
  let htmlUrl = "";

  try {
    const indexUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${category}/index.json`;
    const res = await fetch(indexUrl, { cache: "no-store" });
    if (res.ok) {
      const raw = await res.json();
      // Support both old flat format and new versioned format
      let reports: ReportData[] = [];
      if (Array.isArray(raw)) {
        for (const entry of raw) {
          if (entry.versions && Array.isArray(entry.versions)) {
            // New versioned format — extract latest version
            const latest = entry.versions.find((v: Record<string, unknown>) => v.is_latest) || entry.versions[0];
            if (latest) {
              reports.push({
                state_code: entry.state_code,
                state_name: entry.state_name,
                product: category,
                created_at: latest.created_at || latest.timestamp || "",
                files: latest.files || {},
              });
            }
          } else {
            // Old flat format
            reports.push(entry);
          }
        }
      }
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
              className="flex items-center gap-1.5 text-sm font-medium text-[#0ea5e9] hover:text-[#0c4a6e] transition-colors"
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
                style={{ background: "linear-gradient(135deg, #0f172a, #0c4a6e)" }}
              >
                {stateCode}
              </span>
              <span className="text-sm font-semibold text-[#111827]">
                {US_STATES_CN[stateCode] || stateName} · {categoryLabel}
              </span>
            </div>
          </div>
          {downloads.length > 0 && (
            <div className="flex gap-2">
              {downloads.map((d) => (
                <a
                  key={d.label}
                  href={d.url}
                  download
                  className="inline-flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb] hover:border-[#0ea5e9] hover:text-[#0ea5e9] transition-all"
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
            title={`${US_STATES_CN[stateCode] || stateName} ${categoryLabel} 市场调研报告`}
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
              className="inline-flex items-center gap-1.5 text-sm text-[#0ea5e9] hover:text-[#0c4a6e] font-medium"
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
