import { NextRequest, NextResponse } from 'next/server';

// Proxy Vercel Blob videos with proper streaming headers
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  // Only allow vercel blob URLs
  if (!url.includes('blob.vercel-storage.com')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const range = request.headers.get('range');
    const fetchHeaders: HeadersInit = {};
    if (range) fetchHeaders['Range'] = range;

    const res = await fetch(url, { headers: fetchHeaders });
    if (!res.ok && res.status !== 206) {
      return NextResponse.json({ error: 'Video fetch failed' }, { status: 502 });
    }

    const headers = new Headers();
    headers.set('Content-Type', res.headers.get('Content-Type') || 'video/mp4');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=31536000');

    const contentRange = res.headers.get('Content-Range');
    const contentLength = res.headers.get('Content-Length');
    if (contentRange) headers.set('Content-Range', contentRange);
    if (contentLength) headers.set('Content-Length', contentLength);

    return new NextResponse(res.body, {
      status: res.status,
      headers,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}
