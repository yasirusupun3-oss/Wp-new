import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * OxaPay Webhook Handler
 *
 * Receives webhook notifications from OxaPay when payment statuses change,
 * verifies the HMAC signature, and credits coins to the user's Firestore
 * balance for successful payments.
 *
 * Requires:
 *   OXA_PAY_WEBHOOK_SECRET (or OXA_PAY_API_KEY as a fallback — OxaPay signs
 *   webhook payloads with your API key by default; check your OxaPay
 *   dashboard for the exact secret it expects and set it here)
 *
 * Configure this route's URL as the callback URL in your OxaPay dashboard.
 */

interface OxaPayWebhookPayload {
  status: 'paid' | 'expired' | 'failed' | 'pending' | 'confirmed' | 'success' | 'waiting';
  trackId?: string;
  track_id?: string;
  orderId?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  network?: string;
  txHash?: string;
  address?: string;
  fee?: number;
  payDate?: string;
  type?: 'payment' | 'payout';
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const payload: OxaPayWebhookPayload = JSON.parse(rawBody);

    const trackId = payload.trackId || payload.track_id;
    const status = payload.status;

    console.log(`[OxaPay Webhook] Received status: ${status} for invoice: ${trackId}`);

    // ─── Security: HMAC signature verification ─────────────
    const WEBHOOK_SECRET = process.env.OXA_PAY_WEBHOOK_SECRET || process.env.OXA_PAY_API_KEY;
    const providedSignature = request.headers.get('hmac') || request.headers.get('HMAC');

    if (WEBHOOK_SECRET && providedSignature) {
      const expectedSignature = crypto
        .createHmac('sha512', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (providedSignature !== expectedSignature) {
        console.error('[OxaPay Webhook] Invalid signature — rejecting');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (WEBHOOK_SECRET) {
      // Secret is configured but OxaPay sent no signature header — reject to
      // be safe, since we can't verify this request actually came from OxaPay.
      console.error('[OxaPay Webhook] Missing HMAC signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    if (!trackId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    switch (status) {
      case 'paid':
      case 'confirmed':
      case 'success':
        await handleSuccessfulPayment(trackId);
        break;
      case 'expired':
        await handleTerminalStatus(trackId, 'expired');
        break;
      case 'failed':
        await handleTerminalStatus(trackId, 'failed');
        break;
      case 'pending':
      case 'waiting':
        console.log(`[OxaPay Webhook] Payment pending for: ${trackId}`);
        break;
      default:
        console.warn(`[OxaPay Webhook] Unknown status: ${status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[OxaPay Webhook] Error:', error);
    // Still return 200 to prevent OxaPay from endlessly retrying a malformed payload.
    return NextResponse.json({ success: true });
  }
}

/** Credit coins to the user's balance for a confirmed payment (idempotent). */
async function handleSuccessfulPayment(trackId: string) {
  const db = getAdminDb();
  const pendingRef = db.collection('pendingPayments').doc(trackId);

  await db.runTransaction(async (transaction) => {
    const pendingSnap = await transaction.get(pendingRef);

    if (!pendingSnap.exists) {
      console.error(`[OxaPay Webhook] No pending payment found for: ${trackId}`);
      return;
    }

    const pending = pendingSnap.data()!;

    // Idempotency guard — never double-credit the same invoice.
    if (pending.status === 'paid') {
      console.log(`[OxaPay Webhook] Already processed: ${trackId}`);
      return;
    }

    const userRef = db.collection('users').doc(pending.userId);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists) {
      console.error(`[OxaPay Webhook] User not found: ${pending.userId}`);
      transaction.update(pendingRef, { status: 'failed', failReason: 'user_not_found' });
      return;
    }

    const currentBalance = userSnap.data()?.coinBalance ?? 0;
    const currentEarned = userSnap.data()?.totalEarned ?? 0;
    const newBalance = currentBalance + pending.coins;

    transaction.update(userRef, {
      coinBalance: newBalance,
      totalEarned: currentEarned + pending.coins,
    });

    transaction.update(pendingRef, {
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
    });

    const txRef = db.collection('coinTransactions').doc();
    transaction.set(txRef, {
      userId: pending.userId,
      type: 'purchase',
      amount: pending.coins,
      balanceAfter: newBalance,
      referenceType: 'oxapay_invoice',
      referenceId: trackId,
      description: `Purchased ${pending.coins} coins (Order: ${pending.coinPackageId || 'custom'})`,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  console.log(`[OxaPay Webhook] Payment processed for invoice: ${trackId}`);
}

/** Mark a pending payment as expired/failed. */
async function handleTerminalStatus(trackId: string, status: 'expired' | 'failed') {
  const db = getAdminDb();
  const pendingRef = db.collection('pendingPayments').doc(trackId);
  const snap = await pendingRef.get();
  if (snap.exists && snap.data()?.status === 'pending') {
    await pendingRef.update({ status });
  }
  console.log(`[OxaPay Webhook] Payment ${status} for invoice: ${trackId}`);
}
