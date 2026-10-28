import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

const AD_COINS = 50;
const MAX_ADS_PER_DAY = 10;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });

    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);

    const newBalance = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('USER_NOT_FOUND');
      const data = snap.data()!;

      const today = new Date().toISOString().slice(0, 10);
      const lastAdDate: string = data.lastAdDate || '';
      const adsToday: number = lastAdDate === today ? (data.adsWatchedToday ?? 0) : 0;

      if (adsToday >= MAX_ADS_PER_DAY) throw new Error('DAILY_LIMIT');

      const newBal = (data.coinBalance ?? 0) + AD_COINS;
      tx.update(userRef, {
        coinBalance: newBal,
        adsWatchedToday: adsToday + 1,
        lastAdDate: today,
      });

      const txRef = db.collection('coinTransactions').doc();
      tx.set(txRef, {
        userId,
        type: 'ad_reward',
        amount: AD_COINS,
        balanceAfter: newBal,
        description: `Watched ad #${adsToday + 1} today`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return newBal;
    });

    return NextResponse.json({ success: true, coinsEarned: AD_COINS, newBalance });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'DAILY_LIMIT') return NextResponse.json({ success: false, error: 'Daily ad limit reached' });
    if (msg === 'USER_NOT_FOUND') return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
