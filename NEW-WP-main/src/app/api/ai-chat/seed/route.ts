import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// Run once: POST /api/ai-chat/seed?secret=YOUR_ADMIN_SECRET
// This creates AI girl profiles in Firestore

const AI_GIRLS = [
  {
    uid: 'ai_girl_sakura',
    displayName: 'Sakura',
    photoURL: null,
    bio: 'Anime lover 🌸 Music & cooking enthusiast',
    city: 'Tokyo',
    age: 22,
    gender: 'female',
    isAIBot: true,
    coinBalance: 0,
    totalEarned: 0,
    totalSpent: 0,
    createdAt: new Date(),
  },
  {
    uid: 'ai_girl_maya',
    displayName: 'Maya',
    photoURL: null,
    bio: 'Dancer 💃 Travel & fashion addict',
    city: 'Mumbai',
    age: 24,
    gender: 'female',
    isAIBot: true,
    coinBalance: 0,
    totalEarned: 0,
    totalSpent: 0,
    createdAt: new Date(),
  },
  {
    uid: 'ai_girl_nina',
    displayName: 'Nina',
    photoURL: null,
    bio: 'Book lover 📚 Art & coffee ☕',
    city: 'Paris',
    age: 21,
    gender: 'female',
    isAIBot: true,
    coinBalance: 0,
    totalEarned: 0,
    totalSpent: 0,
    createdAt: new Date(),
  },
];

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.ADMIN_SEED_SECRET && secret !== 'seed_ai_girls_2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const results = [];

    for (const girl of AI_GIRLS) {
      await db.collection('users').doc(girl.uid).set(girl, { merge: true });
      results.push(`✅ ${girl.displayName} (${girl.uid})`);
    }

    return NextResponse.json({ success: true, created: results });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
