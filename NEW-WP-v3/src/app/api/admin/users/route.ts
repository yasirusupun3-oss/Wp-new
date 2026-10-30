import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, requireAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const db = getAdminDb();
    const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(200).get();
    const users = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        displayName: data.displayName || 'User',
        email: data.email || '',
        coinBalance: data.coinBalance ?? 0,
        totalEarned: data.totalEarned ?? 0,
        totalSpent: data.totalSpent ?? 0,
        banned: data.banned === true,
        createdAt: data.createdAt?.toMillis?.() || null,
      };
    });
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('[Admin Users] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { action, uid, amount, reason } = body;

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ success: false, error: 'uid is required' }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(uid);

    if (action === 'ban' || action === 'unban') {
      await userRef.update({ banned: action === 'ban' });
      return NextResponse.json({ success: true });
    }

    if (action === 'adjustCoins') {
      if (typeof amount !== 'number' || amount === 0) {
        return NextResponse.json({ success: false, error: 'A non-zero amount is required' }, { status: 400 });
      }
      const newBalance = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(userRef);
        if (!snap.exists) throw new Error('USER_NOT_FOUND');
        const current = snap.data()?.coinBalance ?? 0;
        const updated = Math.max(0, current + amount);
        transaction.update(userRef, { coinBalance: updated });

        const txRef = db.collection('coinTransactions').doc();
        transaction.set(txRef, {
          userId: uid,
          type: 'admin_adjustment',
          amount,
          balanceAfter: updated,
          description: reason ? `Admin adjustment: ${reason}` : 'Admin balance adjustment',
          createdAt: FieldValue.serverTimestamp(),
        });
        return updated;
      });
      return NextResponse.json({ success: true, newBalance });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    console.error('[Admin Users] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
