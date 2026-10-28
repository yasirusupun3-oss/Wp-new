import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

const DAILY_LOGIN_COINS = 100;
const AD_REWARD_COINS = 50;
const MAX_ADS_PER_DAY = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type } = body; // type: 'daily_login' | 'ad_reward'

    if (!userId || !type) {
      return NextResponse.json({ success: false, error: 'userId and type are required' }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);
    const rewardsRef = db.collection('userRewards').doc(userId);

    // Use today's date in YYYY-MM-DD as key (UTC)
    const today = new Date().toISOString().slice(0, 10);

    const newBalance = await db.runTransaction(async (transaction) => {
      const [userSnap, rewardsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(rewardsRef),
      ]);

      if (!userSnap.exists) throw new Error('USER_NOT_FOUND');

      const currentBalance = userSnap.data()?.coinBalance ?? 0;
      const rewardsData = rewardsSnap.exists ? rewardsSnap.data()! : {};

      if (type === 'daily_login') {
        // Only grant once per day
        if (rewardsData.lastLoginDate === today) {
          throw new Error('ALREADY_CLAIMED');
        }
        const newBal = currentBalance + DAILY_LOGIN_COINS;
        transaction.update(userRef, { coinBalance: newBal });
        transaction.set(rewardsRef, { ...rewardsData, lastLoginDate: today }, { merge: true });
        const txRef = db.collection('coinTransactions').doc();
        transaction.set(txRef, {
          userId,
          type: 'daily_login_bonus',
          amount: DAILY_LOGIN_COINS,
          balanceAfter: newBal,
          description: `Daily login bonus — ${today}`,
          createdAt: FieldValue.serverTimestamp(),
        });
        return { balance: newBal, coins: DAILY_LOGIN_COINS };
      }

      if (type === 'ad_reward') {
        // Max 10 ads per day
        const todayAds: number = rewardsData.adsByDate?.[today] ?? 0;
        if (todayAds >= MAX_ADS_PER_DAY) {
          throw new Error('AD_LIMIT_REACHED');
        }
        const newBal = currentBalance + AD_REWARD_COINS;
        transaction.update(userRef, { coinBalance: newBal });
        transaction.set(
          rewardsRef,
          {
            ...rewardsData,
            adsByDate: { ...(rewardsData.adsByDate || {}), [today]: todayAds + 1 },
          },
          { merge: true }
        );
        const txRef = db.collection('coinTransactions').doc();
        transaction.set(txRef, {
          userId,
          type: 'ad_reward',
          amount: AD_REWARD_COINS,
          balanceAfter: newBal,
          description: `Ad reward (${todayAds + 1}/${MAX_ADS_PER_DAY} today)`,
          createdAt: FieldValue.serverTimestamp(),
        });
        return { balance: newBal, coins: AD_REWARD_COINS, adsWatchedToday: todayAds + 1 };
      }

      throw new Error('INVALID_TYPE');
    });

    return NextResponse.json({ success: true, ...newBalance });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'ALREADY_CLAIMED') {
      return NextResponse.json({ success: false, error: 'ALREADY_CLAIMED', message: 'Daily bonus already collected today.' });
    }
    if (msg === 'AD_LIMIT_REACHED') {
      return NextResponse.json({ success: false, error: 'AD_LIMIT_REACHED', message: `You have watched the maximum ${MAX_ADS_PER_DAY} ads for today.` });
    }
    if (msg === 'USER_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    console.error('[Rewards]', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });

  const db = getAdminDb();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const snap = await db.collection('userRewards').doc(userId).get();
    const data = snap.exists ? snap.data()! : {};
    return NextResponse.json({
      success: true,
      dailyLoginClaimed: data.lastLoginDate === today,
      adsWatchedToday: data.adsByDate?.[today] ?? 0,
      maxAdsPerDay: MAX_ADS_PER_DAY,
      dailyLoginCoins: DAILY_LOGIN_COINS,
      adRewardCoins: AD_REWARD_COINS,
    });
  } catch (err) {
    console.error('[Rewards GET]', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
