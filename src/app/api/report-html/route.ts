import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy Supabase HTML report files, stripping restrictive CSP headers
 * so they can render properly in an iframe with scripts/styles.
 *
 * Usage: /api/report-html?url=<supabase-html-url>
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Only allow Supabase URLs
  if (!url.startsWith("https://bbfyfkjcvhpqmjticmsy.supabase.co/")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 403 });
  }

  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: resp.status });
    }

    const html = await resp.text();

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        // No restrictive CSP — allow scripts/styles/images to load
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 502 });
  }
}
