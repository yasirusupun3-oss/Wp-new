'use client';

import { useCallback, useRef } from 'react';

const AI_BOT_IDS = ['ai_girl_sakura', 'ai_girl_maya', 'ai_girl_nina'];
const REPLY_DELAY_MS = 1500; // simulate typing delay

export function isAIBot(userId: string): boolean {
  return AI_BOT_IDS.includes(userId);
}

export function useAIReply(otherUserId: string, currentUserId: string) {
  const isBot = isAIBot(otherUserId);
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const replyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAIReply = useCallback(async (userMessage: string) => {
    if (!isBot || !currentUserId) return;

    // Add to history
    historyRef.current.push({ role: 'user', content: userMessage });
    if (historyRef.current.length > 20) historyRef.current = historyRef.current.slice(-20);

    // Cancel any pending reply
    if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);

    // Delay to simulate typing
    replyTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            aiGirlId: otherUserId,
            message: userMessage,
            chatHistory: historyRef.current.slice(-10),
          }),
        });
        const data = await res.json();
        if (data.reply) {
          historyRef.current.push({ role: 'assistant', content: data.reply });
        }
      } catch (err) {
        console.error('[useAIReply] Failed:', err);
      }
    }, REPLY_DELAY_MS);
  }, [isBot, otherUserId, currentUserId]);

  return { isBot, triggerAIReply };
}
