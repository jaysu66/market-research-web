import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BACKEND_URL || 'http://8.140.216.113';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = path.join('/');
  const url = `${API_BASE}/${targetPath}${request.nextUrl.search}`;

  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = path.join('/');
  const url = `${API_BASE}/${targetPath}`;
  const body = await request.json();

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
