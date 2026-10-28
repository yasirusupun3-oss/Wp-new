import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const db = getAdminDb();
    const snap = await db.collection('coinTransactions').orderBy('createdAt', 'desc').limit(200).get();
    const transactions = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        balanceAfter: data.balanceAfter,
        description: data.description || '',
        createdAt: data.createdAt?.toMillis?.() || null,
      };
    });
    return NextResponse.json({ success: true, transactions });
  } catch (error) {
    console.error('[Admin Transactions] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
