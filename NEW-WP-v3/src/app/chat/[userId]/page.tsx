'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { useWalletStore, useCallStore } from '@/lib/store';
import { type RomanticGift } from '@/lib/store';
import ChatBubble from '@/components/chat/ChatBubble';
import MessageInput from '@/components/chat/MessageInput';
import RomanticGiftPanel from '@/components/chat/RomanticGiftPanel';
import CoinIcon from '@/components/three/CoinIcon'; // මෙතන වැරැද්ද නිවැරදි කළා

const avatarColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#82E0AA', '#F1948A', '#AED6F1', '#F9E79F',
];

function getAvatarColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function formatMessageTime(date: Date): string {
  if (!date) return "";
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const otherUserId = params.userId as string;

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { coinBalance } = useWalletStore();
  const { messages, sendMessage, sendMessageWithGift, isLoading, otherUser } = useMessages(otherUserId);

  const [isTyping, setIsTyping] = useState(false);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MESSAGE_COST = 10;
  const VIDEO_CALL_MIN_COST = 2800;

  const canAffordMessage = (user?.coinBalance ?? 0) >= MESSAGE_COST;
  const canAffordCall = (user?.coinBalance ?? 0) >= VIDEO_CALL_MIN_COST;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const triggerTyping = () => {
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  const handleSend = async (text: string) => {
    if (!canAffordMessage) {
      alert("පණිවිඩයක් යැවීමට අවම වශයෙන් කොයින් 10ක් තිබිය යුතුය.");
      return;
    }
    await sendMessage(text);
    triggerTyping();
  };

  const handleSendGift = async (gift: RomanticGift) => {
    await sendMessageWithGift('', {
      emoji: gift.emoji,
      name: gift.name,
      cost: gift.cost,
    });
    setShowGiftPanel(false);
    triggerTyping();
  };

  const handleGift = () => {
    setShowGiftPanel(true);
  };

  const handleVideoCall = () => {
    if (!canAffordCall) {
      alert(`වීඩියෝ කෝල් එකක් ගැනීමට අවම වශයෙන් කොයින් ${VIDEO_CALL_MIN_COST}ක් තිබිය යුතුය.`);
      return;
    }
    if (otherUser) {
      // අලුත් පේජ් එකට යැවීම
      router.push(`/video-call?name=${encodeURIComponent(otherUser.displayName || 'User')}`);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111B21]">
        <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111B21]">
        <button onClick={() => router.push('/login')} className="bg-[#25D366] text-white px-6 py-2 rounded-full">Log In</button>
      </div>
    );
  }

  const avatarColor = otherUser ? getAvatarColor(otherUser.uid) : '#888';
  const displayName = otherUser?.displayName ?? 'Loading...';
  const initials = otherUser ? getInitials(otherUser.displayName) : '??';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col bg-[#111B21]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 bg-[#075E54] shadow-lg shrink-0">
        <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-full">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden" style={{ background: avatarColor }}>
          {otherUser?.photoURL ? (
            <img src={otherUser.photoURL} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{displayName}</p>
          <p className="text-white/70 text-xs">{isTyping ? 'typing...' : 'Online'}</p>
        </div>

        <CoinIcon size="sm" balance={user.coinBalance} />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {isLoading && (
          <div className="flex justify-center"><Loader2 className="w-6 h-6 text-[#25D366] animate-spin" /></div>
        )}
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              text={msg.text}
              sent={msg.senderId === user.uid}
              time={formatMessageTime(msg.createdAt)}
              isGift={msg.type === 'gift'}
              giftEmoji={msg.giftData?.giftEmoji}
              giftValue={msg.giftData?.coinValue}
            />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <MessageInput
        onSend={handleSend}
        onGift={handleGift}
        onVideoCall={handleVideoCall}
        canAffordMessage={canAffordMessage}
      />

      <RomanticGiftPanel
        isOpen={showGiftPanel}
        onClose={() => setShowGiftPanel(false)}
        onSendGift={handleSendGift}
        receiverName={displayName}
      />
    </motion.div>
  );
}
