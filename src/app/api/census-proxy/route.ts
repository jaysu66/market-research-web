import { NextRequest, NextResponse } from "next/server";

/**
 * General-purpose outbound proxy for ECS in China.
 * ECS cannot directly access US government APIs (Census, FRED, BLS, etc.)
 * so it calls this Vercel endpoint which forwards the request.
 *
 * GET  /api/census-proxy?url=https://api.census.gov/data/2023/acs/acs5?get=NAME&for=state:48
 * POST /api/census-proxy?url=https://api.bls.gov/publicAPI/v1/timeseries/data/
 *
 * Only allows whitelisted domains.
 */

const ALLOWED_DOMAINS = [
  "api.census.gov",
  "api.stlouisfed.org",   // FRED
  "api.bls.gov",          // BLS
  "overpass-api.de",      // OpenStreetMap
  "data.census.gov",
];

function isDomainAllowed(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }
  if (!isDomainAllowed(targetUrl)) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
  }

  try {
    const resp = await fetch(targetUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(60000),
    });

    const contentType = resp.headers.get("content-type") || "";
    const body = await resp.arrayBuffer();

    return new NextResponse(body, {
      status: resp.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Upstream fetch failed", detail: String(e) },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }
  if (!isDomainAllowed(targetUrl)) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
  }

  try {
    const body = await request.text();
    const reqContentType = request.headers.get("content-type") || "application/json";

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": reqContentType, Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(60000),
    });

    const respContentType = resp.headers.get("content-type") || "";
    const respBody = await resp.arrayBuffer();

    return new NextResponse(respBody, {
      status: resp.status,
      headers: {
        "Content-Type": respContentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Upstream fetch failed", detail: String(e) },
      { status: 502 }
    );
  }
}
