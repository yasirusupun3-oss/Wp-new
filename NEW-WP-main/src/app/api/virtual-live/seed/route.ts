import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Virtual AI live hosts — clearly marked as virtual
// Videos: upload your own .mp4 files to Firebase Storage and paste URLs below
// Free royalty-free Sri Lankan look videos: pexels.com, pixabay.com

const VIRTUAL_HOSTS = [
  {
    id: 'virtual_live_01',
    hostName: 'Ayasha ✨',
    title: 'Good evening everyone 🌙',
    videoUrl: '', // paste Firebase Storage URL here
    avatarEmoji: '👩‍🦱',
    avatarColor: '#FF6B9D',
    viewerCount: 47,
    giftCount: 12,
    isVirtual: true,
    virtualLabel: '🤖 Virtual Host',
  },
  {
    id: 'virtual_live_02',
    hostName: 'Dinara 💫',
    title: 'Dancing & chilling 💃',
    videoUrl: '',
    avatarEmoji: '👩',
    avatarColor: '#A855F7',
    viewerCount: 83,
    giftCount: 29,
    isVirtual: true,
    virtualLabel: '🤖 Virtual Host',
  },
  {
    id: 'virtual_live_03',
    hostName: 'Sanduni 🌸',
    title: 'Late night vibes 🎵',
    videoUrl: '',
    avatarEmoji: '👩‍🦰',
    avatarColor: '#06B6D4',
    viewerCount: 31,
    giftCount: 8,
    isVirtual: true,
    virtualLabel: '🤖 Virtual Host',
  },
];

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== 'seed_virtual_2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const db = getAdminDb();
    const results = [];
    for (const host of VIRTUAL_HOSTS) {
      await db.collection('liveStreams').doc(host.id).set({
        hostId: host.id,
        hostName: host.hostName,
        hostPhoto: null,
        channelName: host.id,
        title: host.title,
        status: 'live',
        viewerCount: host.viewerCount,
        giftCount: host.giftCount,
        isVirtual: true,
        virtualLabel: host.virtualLabel,
        virtualVideoUrl: host.videoUrl,
        avatarEmoji: host.avatarEmoji,
        avatarColor: host.avatarColor,
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      results.push(`✅ ${host.hostName}`);
    }
    return NextResponse.json({ success: true, created: results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
