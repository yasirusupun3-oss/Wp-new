import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * POST /api/live/leave-beacon
 *
 * Best-effort cleanup for the case where a live stream's page just
 * disappears — the tab is closed, the app is killed/backgrounded, or a
 * crash is caught by LiveErrorBoundary — without the person ever pressing
 * "End Stream" / "Leave". Without this, the stream's Firestore doc is left
 * with status "active" forever, so:
 *   - the same host shows up as "live" multiple times the next time they
 *     actually go live (their old, never-ended doc plus the new one), and
 *   - a stream that's actually long gone keeps appearing to viewers.
 *
 * Called via navigator.sendBeacon(), which can only do a same-origin POST
 * with no custom headers — so this intentionally does not require the
 * normal admin/auth flow. It's scoped tightly instead: a host can only end
 * a stream whose hostId matches the uid they send, and a viewer can only
 * decrement a stream's viewerCount (never touch anything else). Both are
 * things the client could already do directly via the Firestore SDK under
 * firestore.rules, so this doesn't weaken security — it's just a fallback
 * path that also works during page unload, when Firestore's own SDK calls
 * are unreliable (the page is already being torn down).
 */

interface LeaveBeaconBody {
  action: 'end_host' | 'leave_viewer';
  streamId: string;
  uid?: string;
}

export async function POST(request: NextRequest) {
  try {
    // sendBeacon posts a Blob; NextRequest still parses it as JSON fine as
    // long as the Blob's type was set to application/json on the client.
    const body: Partial<LeaveBeaconBody> = await request.json().catch(() => ({}));
    const { action, streamId, uid } = body;

    if (!streamId || typeof streamId !== 'string') {
      return NextResponse.json({ success: false, error: 'streamId is required' }, { status: 400 });
    }

    const db = getAdminDb();
    const streamRef = db.collection('liveStreams').doc(streamId);
    const snap = await streamRef.get();
    if (!snap.exists) {
      // Already gone — nothing to clean up.
      return NextResponse.json({ success: true });
    }
    const data = snap.data() || {};

    if (action === 'end_host') {
      // Only the actual host's uid can end their own stream this way.
      if (!uid || data.hostId !== uid) {
        return NextResponse.json({ success: false, error: 'Not the host of this stream' }, { status: 403 });
      }
      if (data.status === 'active') {
        await streamRef.update({ status: 'ended', endedAt: FieldValue.serverTimestamp(), endedBy: 'beacon' });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'leave_viewer') {
      if (data.status === 'active' && (data.viewerCount ?? 0) > 0) {
        await streamRef.update({ viewerCount: FieldValue.increment(-1) });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[live/leave-beacon] Error:', error);
    // Never let this surface as a hard failure — it's a best-effort cleanup
    // hit during page teardown, nothing depends on its response.
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
