import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, requireAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const db = getAdminDb();
    const snap = await db.collection('liveStreams').where('status', '==', 'active').limit(100).get();
    const streams = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        hostId: data.hostId,
        hostName: data.hostName || 'Host',
        title: data.title || '',
        viewerCount: data.viewerCount ?? 0,
        totalGifts: data.totalGifts ?? 0,
        totalCoins: data.totalCoins ?? 0,
        createdAt: data.createdAt?.toMillis?.() || null,
      };
    });
    return NextResponse.json({ success: true, streams });
  } catch (error) {
    console.error('[Admin Live Streams] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { streamId } = body;
    if (!streamId) {
      return NextResponse.json({ success: false, error: 'streamId is required' }, { status: 400 });
    }
    const db = getAdminDb();
    await db.collection('liveStreams').doc(streamId).update({
      status: 'ended',
      endedAt: FieldValue.serverTimestamp(),
      endedBy: 'admin',
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Live Streams] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
