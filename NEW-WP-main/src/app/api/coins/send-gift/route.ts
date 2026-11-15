import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

// ---------------------------------------------------------------------------
// Gift Catalog
// ---------------------------------------------------------------------------
const GIFT_CATALOG: Record<string, { name: string; cost: number; emoji: string }> = {
  rose:        { name: 'Rose',        cost: 25,   emoji: '🌹' },
  bouquet:     { name: 'Bouquet',     cost: 100,  emoji: '💐' },
  heart:       { name: 'Heart',       cost: 15,   emoji: '❤️' },
  chocolate:   { name: 'Chocolate',   cost: 50,   emoji: '🍫' },
  diamond:     { name: 'Diamond Ring', cost: 500, emoji: '💍' },
  teddy:       { name: 'Teddy Bear',  cost: 75,   emoji: '🧸' },
  wine:        { name: 'Wine',        cost: 60,   emoji: '🍷' },
  kiss:        { name: 'Kiss',        cost: 20,   emoji: '💋' },
  crown:       { name: 'Crown',       cost: 1000, emoji: '👑' },
  perfume:     { name: 'Perfume',     cost: 200,  emoji: '🌸' },
  love_letter: { name: 'Love Letter', cost: 30,   emoji: '💌' },
  cake:        { name: 'Cake',        cost: 150,  emoji: '🎂' },
};

const PLATFORM_FEE_RATE = 0.1; // 10 %
const SUPPORTED_CONTEXTS = ['chat', 'live'] as const;

interface SendGiftBody {
  senderId: string;
  senderName?: string;
  receiverId: string;
  giftId: string;
  context: 'chat' | 'live';
  streamId?: string;
}

// ---------------------------------------------------------------------------
// POST /api/coins/send-gift
// Handles an atomic gift transfer between two users via Firestore.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body: Partial<SendGiftBody> = await request.json();

    if (!body.senderId || typeof body.senderId !== 'string' || body.senderId.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing or invalid senderId' }, { status: 400 });
    }
    if (!body.receiverId || typeof body.receiverId !== 'string' || body.receiverId.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing or invalid receiverId' }, { status: 400 });
    }
    if (!body.giftId || typeof body.giftId !== 'string' || body.giftId.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing or invalid giftId' }, { status: 400 });
    }
    if (!body.context || !SUPPORTED_CONTEXTS.includes(body.context as (typeof SUPPORTED_CONTEXTS)[number])) {
      return NextResponse.json(
        { success: false, error: `context must be one of: ${SUPPORTED_CONTEXTS.join(', ')}` },
        { status: 400 },
      );
    }

    const { senderId, senderName, receiverId, giftId, context, streamId } = body;

    const gift = GIFT_CATALOG[giftId];
    if (!gift) {
      return NextResponse.json(
        { success: false, error: `Gift not found: "${giftId}"`, availableGifts: Object.keys(GIFT_CATALOG) },
        { status: 404 },
      );
    }

    const giftCost = gift.cost;
    const platformFee = giftCost * PLATFORM_FEE_RATE;
    const receiverCredit = giftCost - platformFee;

    const db = getAdminDb();

    const result = await db.runTransaction(async (transaction) => {
      const senderRef = db.collection('users').doc(senderId);
      const receiverRef = db.collection('users').doc(receiverId);

      const [senderSnap, receiverSnap] = await Promise.all([
        transaction.get(senderRef),
        transaction.get(receiverRef),
      ]);

      if (!senderSnap.exists) throw new Error('SENDER_NOT_FOUND');
      if (!receiverSnap.exists) throw new Error('RECEIVER_NOT_FOUND');

      const senderBalance = senderSnap.data()?.coinBalance ?? 0;
      if (senderBalance < giftCost) throw new Error('INSUFFICIENT_BALANCE');

      const receiverBalance = receiverSnap.data()?.coinBalance ?? 0;
      const senderBalanceAfter = senderBalance - giftCost;
      const receiverBalanceAfter = receiverBalance + receiverCredit;

      transaction.update(senderRef, { coinBalance: senderBalanceAfter });
      transaction.update(receiverRef, { coinBalance: receiverBalanceAfter });

      const senderTxRef = db.collection('coinTransactions').doc();
      transaction.set(senderTxRef, {
        userId: senderId,
        type: 'gift_sent',
        amount: -giftCost,
        balanceAfter: senderBalanceAfter,
        referenceType: 'gift',
        referenceId: giftId,
        toUserId: receiverId,
        context,
        platformFee,
        description: `Sent ${gift.emoji} ${gift.name} to ${receiverId}`,
        createdAt: FieldValue.serverTimestamp(),
      });

      const receiverTxRef = db.collection('coinTransactions').doc();
      transaction.set(receiverTxRef, {
        userId: receiverId,
        type: 'gift_received',
        amount: receiverCredit,
        balanceAfter: receiverBalanceAfter,
        referenceType: 'gift',
        referenceId: giftId,
        fromUserId: senderId,
        context,
        platformFee,
        grossAmount: giftCost,
        description: `Received ${gift.emoji} ${gift.name} from ${senderId}`,
        createdAt: FieldValue.serverTimestamp(),
      });

      // For live-stream gifts, also write a synced event so every viewer +
      // the host see the gift animation in real time via a Firestore listener.
      if (context === 'live' && streamId) {
        const giftEventRef = db.collection('liveStreams').doc(streamId).collection('gifts').doc();
        transaction.set(giftEventRef, {
          senderId,
          senderName: senderName || 'Someone',
          giftId,
          giftName: gift.name,
          emoji: gift.emoji,
          cost: giftCost,
          createdAt: FieldValue.serverTimestamp(),
        });

        // Bump the stream's running gift/coin totals for the host's stats.
        const streamRef = db.collection('liveStreams').doc(streamId);
        transaction.update(streamRef, {
          totalGifts: FieldValue.increment(1),
          totalCoins: FieldValue.increment(giftCost),
        });
      }

      return { senderBalanceAfter };
    });

    return NextResponse.json({
      success: true,
      giftId,
      giftEmoji: gift.emoji,
      giftName: gift.name,
      cost: giftCost,
      platformFee,
      receiverCredit,
      senderBalanceAfter: result.senderBalanceAfter,
      receiverId,
      context,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({ success: false, error: 'Insufficient coin balance to send this gift' }, { status: 402 });
    }
    if (message === 'SENDER_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Sender not found' }, { status: 404 });
    }
    if (message === 'RECEIVER_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Receiver not found' }, { status: 404 });
    }

    console.error('[send-gift] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
