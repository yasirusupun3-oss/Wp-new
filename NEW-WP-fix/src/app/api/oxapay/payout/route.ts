import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Withdrawal Request Route
 *
 * Users submit a withdrawal here. Coins are deducted immediately (escrow) so
 * they can't be double-spent, and a `withdrawRequests` doc is created with
 * status 'pending'. The actual OxaPay payout is NOT sent yet — an admin must
 * approve it from the Admin Panel (/api/admin/withdrawals), which is when
 * the real crypto payout happens. Rejecting a request refunds the coins.
 */

const MIN_WITHDRAWAL = 1000;
const MAX_WITHDRAWAL = 500000;
const COIN_TO_USD_RATE = 0.005; // 1 coin = $0.005

const NETWORKS: Record<string, { name: string; currency: string; fee: number }> = {
  trc20: { name: 'TRC20', currency: 'USDT', fee: 1 },
  erc20: { name: 'ERC20', currency: 'USDT', fee: 5 },
  bep20: { name: 'BEP20', currency: 'USDT', fee: 0.5 },
};

// In-memory per-user rate limiting (best-effort — resets on server restart /
// doesn't share state across serverless instances; use Redis for real scale).
const withdrawalAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 3600000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, walletAddress, network } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid userId is required' }, { status: 400 });
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Valid positive amount is required' }, { status: 400 });
    }
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim().length < 10) {
      return NextResponse.json({ success: false, error: 'Valid wallet address is required' }, { status: 400 });
    }
    if (!network || !NETWORKS[network]) {
      return NextResponse.json(
        { success: false, error: `Invalid network. Must be one of: ${Object.keys(NETWORKS).join(', ')}` },
        { status: 400 },
      );
    }
    if (amount < MIN_WITHDRAWAL) {
      return NextResponse.json({ success: false, error: `Minimum withdrawal is ${MIN_WITHDRAWAL.toLocaleString()} coins` }, { status: 400 });
    }
    if (amount > MAX_WITHDRAWAL) {
      return NextResponse.json({ success: false, error: `Maximum withdrawal is ${MAX_WITHDRAWAL.toLocaleString()} coins per transaction` }, { status: 400 });
    }

    const now = Date.now();
    const userAttempts = withdrawalAttempts.get(userId);
    if (userAttempts && userAttempts.resetAt > now && userAttempts.count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { success: false, error: `Maximum ${RATE_LIMIT_MAX} withdrawals per hour. Please try again later.` },
        { status: 429 },
      );
    }

    const networkInfo = NETWORKS[network];
    const usdAmount = amount * COIN_TO_USD_RATE;
    const networkFee = networkInfo.fee;
    const finalPayoutAmount = Math.max(0, usdAmount - networkFee);

    if (finalPayoutAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Amount too small after network fees' }, { status: 400 });
    }

    const db = getAdminDb();
    const requestRef = db.collection('withdrawRequests').doc();

    let balanceAfter: number;
    try {
      balanceAfter = await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists) throw new Error('USER_NOT_FOUND');

        const userData = userSnap.data();
        const currentBalance = userData?.coinBalance ?? 0;
        const currentSpent = userData?.totalSpent ?? 0;
        if (currentBalance < amount) throw new Error('INSUFFICIENT_BALANCE');

        const newBalance = currentBalance - amount;
        transaction.update(userRef, {
          coinBalance: newBalance,
          totalSpent: currentSpent + amount,
        });

        transaction.set(requestRef, {
          userId,
          userName: userData?.displayName || 'User',
          amount,
          walletAddress: walletAddress.trim(),
          network,
          networkName: networkInfo.name,
          currency: networkInfo.currency,
          usdAmount,
          networkFee,
          finalPayoutAmount,
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
        });

        const txRef = db.collection('coinTransactions').doc();
        transaction.set(txRef, {
          userId,
          type: 'withdrawal_requested',
          amount: -amount,
          balanceAfter: newBalance,
          description: `Withdrawal requested to ${walletAddress.slice(0, 8)}... (${networkInfo.name}) — pending admin approval`,
          referenceId: requestRef.id,
          network,
          usdValue: usdAmount,
          networkFee,
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
        });

        return newBalance;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INSUFFICIENT_BALANCE') {
        return NextResponse.json({ success: false, error: 'Insufficient coin balance' }, { status: 400 });
      }
      if (msg === 'USER_NOT_FOUND') {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }
      throw err;
    }

    if (!userAttempts || userAttempts.resetAt <= now) {
      withdrawalAttempts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    } else {
      userAttempts.count++;
    }

    return NextResponse.json({
      success: true,
      requestId: requestRef.id,
      status: 'pending',
      balanceAfter,
      message: 'Withdrawal request submitted — an admin will review and process it shortly.',
    });
  } catch (error) {
    console.error('[Withdrawal Request] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
