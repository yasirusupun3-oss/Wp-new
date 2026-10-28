import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

const DAILY_BONUS_COINS = 100;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;
    if (!userId) return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });

    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);

    const newBalance = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('USER_NOT_FOUND');
      const data = snap.data()!;
      const lastBonus: number = data.lastDailyBonus?.toMillis?.() || 0;
      if ((Date.now() - lastBonus) < 20 * 3600000) throw new Error('ALREADY_CLAIMED');
      const newBal = (data.coinBalance ?? 0) + DAILY_BONUS_COINS;
      tx.update(userRef, { coinBalance: newBal, lastDailyBonus: FieldValue.serverTimestamp() });
      const txRef = db.collection('coinTransactions').doc();
      tx.set(txRef, { userId, type: 'daily_bonus', amount: DAILY_BONUS_COINS, balanceAfter: newBal, description: 'Daily login bonus', createdAt: FieldValue.serverTimestamp() });
      return newBal;
    });

    return NextResponse.json({ success: true, bonusCoins: DAILY_BONUS_COINS, newBalance });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'ALREADY_CLAIMED') return NextResponse.json({ success: false, error: 'ALREADY_CLAIMED' });
    if (msg === 'USER_NOT_FOUND') return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
