import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * OxaPay Create Payment API Route
 *
 * Creates a cryptocurrency payment invoice through OxaPay for purchasing
 * in-app coins, and stores a pending-payment record in Firestore so the
 * webhook can credit the right user once payment confirms.
 *
 * Requires:
 *   OXA_PAY_API_KEY        (server-only secret)
 *   OXA_PAY_BASE_URL        (default: https://api.oxapay.com)
 *   NEXT_PUBLIC_BASE_URL    (your deployed app URL, for return/cancel links)
 *   OXA_PAY_CALLBACK_URL    (your deployed app URL + /api/oxapay/webhook)
 */

const COIN_PACKAGES: Record<string, { coins: number; price: number; bonus: number }> = {
  pkg1: { coins: 100, price: 0.99, bonus: 0 },
  pkg2: { coins: 500, price: 3.99, bonus: 0 },
  pkg3: { coins: 1000, price: 6.99, bonus: 50 },
  pkg4: { coins: 5000, price: 29.99, bonus: 500 },
  pkg5: { coins: 10000, price: 49.99, bonus: 1500 },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, coinPackageId, userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid userId is required' }, { status: 400 });
    }

    if (coinPackageId && !COIN_PACKAGES[coinPackageId]) {
      return NextResponse.json({ success: false, error: 'Invalid coin package ID' }, { status: 400 });
    }

    const paymentAmount = coinPackageId ? COIN_PACKAGES[coinPackageId].price : amount;

    if (!paymentAmount || typeof paymentAmount !== 'number' || paymentAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Valid positive amount is required' }, { status: 400 });
    }
    if (paymentAmount > 10000) {
      return NextResponse.json({ success: false, error: 'Maximum payment amount is $10,000' }, { status: 400 });
    }

    const totalCoins = coinPackageId
      ? COIN_PACKAGES[coinPackageId].coins + COIN_PACKAGES[coinPackageId].bonus
      : Math.floor(amount / 0.01); // Default rate: 100 coins per $1

    const OXA_PAY_API_KEY = process.env.OXA_PAY_API_KEY;
    const OXA_PAY_BASE_URL = process.env.OXA_PAY_BASE_URL || 'https://api.oxapay.com';
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';
    const CALLBACK_URL = process.env.OXA_PAY_CALLBACK_URL || (BASE_URL ? `${BASE_URL}/api/oxapay/webhook` : undefined);

    if (!OXA_PAY_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Payment service is not configured (missing OXA_PAY_API_KEY)' },
        { status: 500 },
      );
    }

    const orderId = `${userId}_${Date.now()}`;

    const response = await fetch(`${OXA_PAY_BASE_URL}/v1/payment/invoice`, {
      method: 'POST',
      headers: {
        'merchant_api_key': OXA_PAY_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: paymentAmount,
        currency: 'USD',
        lifeTime: 120, // 2 hours
        feePaidByPayer: 1,
        underPaidCover: 5,
        callbackUrl: CALLBACK_URL,
        returnUrl: BASE_URL ? `${BASE_URL}/wallet?status=success` : undefined,
        orderId,
        description: `Coin purchase: ${totalCoins} coins for user ${userId}`,
      }),
    });

    const data = await response.json();

    if (!response.ok || (data.status && data.status !== 200 && data.status !== 'success' && !data.data)) {
      console.error('[OxaPay Create Payment] OxaPay error:', data);
      return NextResponse.json(
        { success: false, error: data.message || 'Failed to create payment invoice' },
        { status: 502 },
      );
    }

    // OxaPay's response shape can vary by API version — normalize the fields we need.
    const invoiceData = data.data ?? data;
    const paymentUrl: string | undefined = invoiceData.payLink || invoiceData.paymentUrl || invoiceData.pay_link;
    const invoiceId: string | undefined = invoiceData.trackId || invoiceData.track_id || invoiceData.invoiceId;

    if (!paymentUrl || !invoiceId) {
      console.error('[OxaPay Create Payment] Unexpected response shape:', JSON.stringify(data));
      // Return all field names so the admin can diagnose the mismatch
      const allKeys = Object.keys(invoiceData).join(', ');
      return NextResponse.json({
        success: false,
        error: `Payment provider returned unexpected fields. Available: [${allKeys}]. Check your OXA_PAY_API_KEY environment variable and OxaPay dashboard.`,
      }, { status: 502 });
    }

    // Save a pending-payment record so the webhook can credit the right user.
    const db = getAdminDb();
    await db.collection('pendingPayments').doc(String(invoiceId)).set({
      invoiceId: String(invoiceId),
      orderId,
      userId,
      amount: paymentAmount,
      coins: totalCoins,
      coinPackageId: coinPackageId ?? null,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      paymentUrl,
      invoiceId,
      amount: paymentAmount,
      coins: totalCoins,
    });
  } catch (error) {
    console.error('[OxaPay Create Payment] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
