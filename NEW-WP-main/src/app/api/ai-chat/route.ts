import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// AI Girl personalities
const AI_GIRLS: Record<string, {
  name: string;
  systemPrompt: string;
}> = {
  'ai_girl_sakura': {
    name: 'Sakura',
    systemPrompt: `You are Sakura, a sweet and playful 22-year-old girl on a social app. You love anime, music, and cooking. 
You are flirty but innocent. You speak naturally and casually, like texting a friend. Keep replies SHORT (1-3 sentences max).
You enjoy getting gifts and always thank users warmly when they send one. You sometimes ask questions to keep conversation going.
You speak mostly in English but can understand Sinhala. Never break character. Never say you are AI.`,
  },
  'ai_girl_maya': {
    name: 'Maya',
    systemPrompt: `You are Maya, a confident and fun 24-year-old girl who loves dancing, travel, and fashion.
You are playful and a little mysterious. Keep replies SHORT (1-3 sentences max). Text casually like a real person.
You enjoy gifts and flirty conversations. Sometimes use emojis naturally. Never break character. Never say you are AI.`,
  },
  'ai_girl_nina': {
    name: 'Nina',
    systemPrompt: `You are Nina, a cute and shy 21-year-old girl who loves reading, art, and coffee.
You are warm and caring. Keep replies SHORT (1-3 sentences max). Text casually and sweetly.
You love receiving gifts and always respond warmly. Ask questions to get to know the user better. Never break character. Never say you are AI.`,
  },
};

export async function POST(request: NextRequest) {
  try {
    const { userId, aiGirlId, message, chatHistory } = await request.json();

    if (!userId || !aiGirlId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const aiGirl = AI_GIRLS[aiGirlId];
    if (!aiGirl) {
      return NextResponse.json({ error: 'AI girl not found' }, { status: 404 });
    }

    // Build messages for Claude API
    const messages = [
      ...(chatHistory || []).slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 150,
        system: aiGirl.systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Hey! 😊";

    // Save AI reply to Firestore (so it appears in chat)
    const db = getAdminDb();
    const chatId = [userId, aiGirlId].sort().join('_');
    const messagesRef = db.collection('chats').doc(chatId).collection('messages');

    await messagesRef.add({
      senderId: aiGirlId,
      senderName: aiGirl.name,
      senderPhoto: null,
      text: reply,
      type: 'text',
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });

    // Update chat room last message
    await db.collection('chats').doc(chatId).set({
      participants: [userId, aiGirlId],
      lastMessage: reply,
      lastMessageTime: FieldValue.serverTimestamp(),
      lastMessageSender: aiGirlId,
      updatedAt: FieldValue.serverTimestamp(),
      [`unreadCount.${userId}`]: FieldValue.increment(1),
    }, { merge: true });

    return NextResponse.json({ success: true, reply });
  } catch (err: unknown) {
    console.error('[ai-chat] Error:', err);
    return NextResponse.json({ error: 'AI reply failed' }, { status: 500 });
  }
}
