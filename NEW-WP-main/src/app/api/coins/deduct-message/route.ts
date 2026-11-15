import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

const COST_PER_MESSAGE = 10;

interface DeductMessageBody {
  userId: string;
  chatId: string;
  messageId: string;
}

// ---------------------------------------------------------------------------
// POST /api/coins/deduct-message
// Deducts coins when a user sends a chat message (real Firestore transaction).
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body: Partial<DeductMessageBody> = await request.json();

    if (!body.userId || typeof body.userId !== 'string' || body.userId.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing or invalid userId' }, { status: 400 });
    }
    if (!body.chatId || typeof body.chatId !== 'string' || body.chatId.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing or invalid chatId' }, { status: 400 });
    }
    if (!body.messageId || typeof body.messageId !== 'string' || body.messageId.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing or invalid messageId' }, { status: 400 });
    }

    const { userId, chatId, messageId } = body;
    const db = getAdminDb();

    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) throw new Error('USER_NOT_FOUND');

      const currentBalance = userSnap.data()?.coinBalance ?? 0;
      if (currentBalance < COST_PER_MESSAGE) throw new Error('INSUFFICIENT_BALANCE');

      const newBalance = currentBalance - COST_PER_MESSAGE;
      transaction.update(userRef, { coinBalance: newBalance });

      const txRef = db.collection('coinTransactions').doc();
      transaction.set(txRef, {
        userId,
        type: 'message_sent',
        amount: -COST_PER_MESSAGE,
        balanceAfter: newBalance,
        referenceId: messageId,
        referenceType: 'message',
        chatId,
        description: `Sent message in chat ${chatId}`,
        createdAt: FieldValue.serverTimestamp(),
      });

      const messageRef = db.collection('chats').doc(chatId).collection('messages').doc(messageId);
      transaction.update(messageRef, {
        status: 'delivered',
        deliveredAt: FieldValue.serverTimestamp(),
      });

      return { newBalance };
    });

    return NextResponse.json({
      success: true,
      cost: COST_PER_MESSAGE,
      balanceAfter: result.newBalance,
      messageId,
      chatId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json(
        { success: false, error: 'Insufficient coin balance', required: COST_PER_MESSAGE },
        { status: 402 },
      );
    }
    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    console.error('[deduct-message] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
