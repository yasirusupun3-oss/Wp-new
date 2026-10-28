import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

const COST_PER_MINUTE = 1500;
const GRACE_PERIOD_SECONDS = 30;
const SUPPORTED_CALL_TYPES = ['voice', 'video'] as const;

interface CallBillingBody {
  userId: string;
  callType: 'voice' | 'video';
  partnerId: string;
  durationSeconds: number;
}

interface BillingConfigResponse {
  costPerMinute: number;
  gracePeriodSeconds: number;
  supportedTypes: string[];
}

// GET /api/coins/call-billing — billing config for the client to display rates.
export async function GET() {
  const config: BillingConfigResponse = {
    costPerMinute: COST_PER_MINUTE,
    gracePeriodSeconds: GRACE_PERIOD_SECONDS,
    supportedTypes: [...SUPPORTED_CALL_TYPES],
  };
  return NextResponse.json(config);
}

// POST /api/coins/call-billing — bills a user for a completed voice/video call.
export async function POST(request: NextRequest) {
  try {
    const body: Partial<CallBillingBody> = await request.json();

    if (!body.userId || typeof body.userId !== 'string' || body.userId.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing or invalid userId' }, { status: 400 });
    }
    if (!body.callType || !SUPPORTED_CALL_TYPES.includes(body.callType as (typeof SUPPORTED_CALL_TYPES)[number])) {
      return NextResponse.json(
        { success: false, error: `callType must be one of: ${SUPPORTED_CALL_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    if (!body.partnerId || typeof body.partnerId !== 'string' || body.partnerId.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing or invalid partnerId' }, { status: 400 });
    }
    if (typeof body.durationSeconds !== 'number' || !Number.isFinite(body.durationSeconds) || body.durationSeconds <= 0) {
      return NextResponse.json({ success: false, error: 'durationSeconds must be a positive number' }, { status: 400 });
    }

    const { userId, callType, partnerId, durationSeconds } = body;

    const billableSeconds = Math.max(0, durationSeconds - GRACE_PERIOD_SECONDS);
    const minutes = Math.ceil(billableSeconds / 60);
    const totalCost = minutes * COST_PER_MINUTE;

    const db = getAdminDb();

    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) throw new Error('USER_NOT_FOUND');

      const currentBalance = userSnap.data()?.coinBalance ?? 0;
      const hasSufficientFunds = currentBalance >= totalCost;

      let actualCost = totalCost;
      let balanceAfter = currentBalance;
      let callStatus: string;

      if (hasSufficientFunds) {
        balanceAfter = currentBalance - totalCost;
        transaction.update(userRef, { coinBalance: balanceAfter });
        callStatus = 'completed';

        const txRef = db.collection('coinTransactions').doc();
        transaction.set(txRef, {
          userId,
          type: 'call_charged',
          amount: -totalCost,
          balanceAfter,
          callType,
          partnerId,
          durationSeconds,
          minutes,
          costPerMinute: COST_PER_MINUTE,
          description: `${callType} call with ${partnerId} (${minutes} min)`,
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        callStatus = 'insufficient_funds';

        if (currentBalance > 0) {
          actualCost = currentBalance;
          balanceAfter = 0;
          transaction.update(userRef, { coinBalance: 0 });

          const txRef = db.collection('coinTransactions').doc();
          transaction.set(txRef, {
            userId,
            type: 'call_partial',
            amount: -actualCost,
            balanceAfter,
            callType,
            partnerId,
            durationSeconds,
            minutes,
            costPerMinute: COST_PER_MINUTE,
            description: `Partial ${callType} call with ${partnerId} – insufficient funds`,
            createdAt: FieldValue.serverTimestamp(),
          });
        } else {
          actualCost = 0;
        }
      }

      const callRecordRef = db.collection('callRecords').doc();
      transaction.set(callRecordRef, {
        userId,
        partnerId,
        callType,
        durationSeconds,
        minutes,
        costPerMinute: COST_PER_MINUTE,
        totalCost: actualCost,
        balanceAfter,
        status: callStatus,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { balanceAfter, callStatus, actualCost };
    });

    return NextResponse.json({
      success: true,
      costPerMinute: COST_PER_MINUTE,
      minutes,
      totalCost: result.actualCost,
      balanceAfter: result.balanceAfter,
      callType,
      durationSeconds,
      callStatus: result.callStatus,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    console.error('[call-billing] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
