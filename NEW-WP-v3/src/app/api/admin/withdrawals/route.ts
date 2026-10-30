import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, requireAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const db = getAdminDb();
    const snap = await db.collection('withdrawRequests').orderBy('createdAt', 'desc').limit(100).get();
    const requests = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        userName: data.userName || 'User',
        amount: data.amount,
        walletAddress: data.walletAddress,
        networkName: data.networkName,
        currency: data.currency,
        finalPayoutAmount: data.finalPayoutAmount,
        status: data.status,
        createdAt: data.createdAt?.toMillis?.() || null,
      };
    });
    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error('[Admin Withdrawals] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { action, requestId } = body;
    if (!requestId || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ success: false, error: 'requestId and a valid action are required' }, { status: 400 });
    }

    const db = getAdminDb();
    const reqRef = db.collection('withdrawRequests').doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }
    const reqData = reqSnap.data()!;
    if (reqData.status !== 'pending') {
      return NextResponse.json({ success: false, error: `Request is already ${reqData.status}` }, { status: 400 });
    }

    if (action === 'reject') {
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(reqData.userId);
        const userSnap = await transaction.get(userRef);
        const currentBalance = userSnap.exists ? userSnap.data()?.coinBalance ?? 0 : 0;
        if (userSnap.exists) {
          transaction.update(userRef, { coinBalance: currentBalance + reqData.amount });
        }
        transaction.update(reqRef, { status: 'rejected', processedAt: FieldValue.serverTimestamp() });

        const txRef = db.collection('coinTransactions').doc();
        transaction.set(txRef, {
          userId: reqData.userId,
          type: 'withdrawal_refund',
          amount: reqData.amount,
          balanceAfter: currentBalance + reqData.amount,
          referenceId: requestId,
          description: 'Withdrawal rejected by admin — coins refunded',
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    // ── approve: actually send the real OxaPay payout now ──
    // OxaPay issues a separate payout_api_key from the merchant/payment
    // API key — using the wrong one here will make every payout fail auth.
    const OXA_PAY_PAYOUT_API_KEY = process.env.OXA_PAY_PAYOUT_API_KEY || process.env.OXA_PAY_API_KEY;
    const OXA_PAY_BASE_URL = process.env.OXA_PAY_BASE_URL || 'https://api.oxapay.com';
    if (!OXA_PAY_PAYOUT_API_KEY) {
      return NextResponse.json({ success: false, error: 'Payout service is not configured (missing OXA_PAY_PAYOUT_API_KEY)' }, { status: 500 });
    }

    const payoutResponse = await fetch(`${OXA_PAY_BASE_URL}/v1/payout`, {
      method: 'POST',
      headers: { payout_api_key: OXA_PAY_PAYOUT_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: reqData.walletAddress,
        network: reqData.networkName,
        amount: reqData.finalPayoutAmount,
        currency: reqData.currency,
        callbackUrl: process.env.OXA_PAY_PAYOUT_CALLBACK_URL || undefined,
        description: `Approved withdrawal for user ${reqData.userId}`,
      }),
    });
    const payoutData = await payoutResponse.json();

    if (!payoutResponse.ok || (payoutData.status && payoutData.status !== 200 && !payoutData.data)) {
      // Real payout failed even though admin approved — refund the user so
      // coins are never silently lost, and mark the request accordingly.
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(reqData.userId);
        const userSnap = await transaction.get(userRef);
        const currentBalance = userSnap.exists ? userSnap.data()?.coinBalance ?? 0 : 0;
        if (userSnap.exists) {
          transaction.update(userRef, { coinBalance: currentBalance + reqData.amount });
        }
        transaction.update(reqRef, { status: 'failed', processedAt: FieldValue.serverTimestamp() });

        const txRef = db.collection('coinTransactions').doc();
        transaction.set(txRef, {
          userId: reqData.userId,
          type: 'withdrawal_refund',
          amount: reqData.amount,
          balanceAfter: currentBalance + reqData.amount,
          referenceId: requestId,
          description: 'Withdrawal payout failed — coins refunded',
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ success: false, error: payoutData.message || 'OxaPay payout failed — user refunded.' }, { status: 502 });
    }

    const trackId = payoutData.data?.trackId || payoutData.trackId || requestId;
    await reqRef.update({ status: 'paid', trackId, processedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ success: true, status: 'paid', trackId });
  } catch (error) {
    console.error('[Admin Withdrawals] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
