'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, Gift, Send, Users, Sparkles,
  Volume2, VolumeX, MessageCircle,
} from 'lucide-react';
import { useLiveStore, useAppStore, useWalletStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, onSnapshot, query,
  orderBy, limit, serverTimestamp, doc, updateDoc, increment,
} from 'firebase/firestore';

// ── Virtual girl profiles (matches seed data) ─────────────────────────
export const VIRTUAL_GIRLS = [
  {
    id: 'virtual_live_01',
    name: 'Ayasha',
    emoji: '👩‍🦱',
    color: '#FF6B9D',
    title: 'Good evening everyone 🌙',
    personality: 'sweet',
    greetings: [
      'Hey everyone! 🌙',
      'So happy you joined! 💕',
      'Having such a good time tonight ✨',
      'Thanks for being here with me 🥰',
    ],
    reactions: [
      'Aww thank you!! 🥰',
      'You guys are so sweet 💕',
      'OMG that made me smile 😊',
      'Love the energy tonight! ✨',
      'You\'re too kind!! 🌸',
    ],
    giftReactions: [
      'Oh wow thank you so much!! 🎁💕',
      'You just made my night!! 🥺✨',
      'Awww you didn\'t have to!! 🌸',
      'That is so sweet of you!! 💖',
    ],
  },
  {
    id: 'virtual_live_02',
    name: 'Dinara',
    emoji: '👩',
    color: '#A855F7',
    title: 'Dancing & chilling 💃',
    personality: 'fun',
    greetings: [
      'Hey hey hey!! 💃',
      'Who\'s ready to have fun?! 🎉',
      'This vibe is everything rn ✨',
      'Let\'s gooo! 🔥',
    ],
    reactions: [
      'Yesss!! 🔥',
      'You guys are wild lol 😂',
      'Okay okay I see you!! 👀',
      'The chat is so hype rn 💃',
      'This is too much fun!! 🎉',
    ],
    giftReactions: [
      'NO WAY!! Thank you!! 🎉🔥',
      'You are absolutely crazy!! 💜',
      'Oh my god!! 😱💃',
      'Best gift ever!! Thank youuu!! 🎁',
    ],
  },
  {
    id: 'virtual_live_03',
    name: 'Sanduni',
    emoji: '👩‍🦰',
    color: '#06B6D4',
    title: 'Late night vibes 🎵',
    personality: 'chill',
    greetings: [
      'Hey 🎵 glad you\'re here',
      'Late night crew where you at 🌙',
      'This music is everything tonight ✨',
      'So cozy rn 💙',
    ],
    reactions: [
      'That\'s so real 💙',
      'I feel that 🌙',
      'You guys get me haha ✨',
      'Okay this is my people 💫',
      'Vibes only tonight 🎵',
    ],
    giftReactions: [
      'Oh wow... thank you 💙',
      'That actually means a lot 🌙',
      'You didn\'t have to do that!! ✨',
      'So grateful for you 💫',
    ],
  },
  {
    id: 'virtual_live_04',
    name: 'Nethmi',
    emoji: '🧕',
    color: '#F59E0B',
    title: 'Evening chat 🌸',
    personality: 'warm',
    greetings: [
      'Ayubowan everyone! 🌸',
      'So nice to see you all 💛',
      'How is everyone tonight? ☀️',
      'Happy you joined! 🌼',
    ],
    reactions: [
      'Haha yes exactly!! 😄',
      'You guys always cheer me up 💛',
      'That\'s so funny 😂',
      'You\'re all so sweet 🌸',
      'Love this chat!! ☀️',
    ],
    giftReactions: [
      'Oh thank you so much!! 💛🌸',
      'You are so generous!! ☀️',
      'That is so kind!! 🥺',
      'Wow!! I\'m so happy!! 🌼',
    ],
  },
  {
    id: 'virtual_live_05',
    name: 'Hasini',
    emoji: '👩‍🦱',
    color: '#10B981',
    title: 'Chill stream tonight 🍃',
    personality: 'calm',
    greetings: [
      'Hi hi!! Welcome 🍃',
      'Come hang out with me 🌿',
      'So relaxed tonight ✨',
      'Just us, good vibes 💚',
    ],
    reactions: [
      'Hehe that\'s so true 💚',
      'You guys are the best 🍃',
      'I\'m literally smiling rn 😊',
      'This is my favorite part 🌿',
      'You make streaming so fun!! ✨',
    ],
    giftReactions: [
      'Oh my!! Thank you!! 💚🍃',
      'You\'re so sweet!! 🌿',
      'I can\'t believe that!! 😊',
      'You just made my whole night!! ✨',
    ],
  },
];

// ── Fake chat messages pool ───────────────────────────────────────────
const FAKE_USERS = ['Kasun_94', 'Dinesh💯', 'RajanSL', 'Priya❤️', 'Milan99', 'Sachini', 'Thushan', 'Ama_lk'];
const FAKE_MSGS = [
  'you look amazing tonight 😍',
  'hi!! 👋',
  'love the stream!!',
  '❤️❤️❤️',
  'best streamer fr',
  'omg hii',
  '🔥🔥',
  'been waiting for this',
  'yesss queen!!',
  'so beautiful 😍',
  'hi from Colombo!',
  '💕💕',
  'first time watching!!',
  'you\'re so fun to watch',
  '🎉🎉🎉',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface VirtualChatMsg {
  id: string;
  user: string;
  text: string;
  isHost?: boolean;
  isGift?: boolean;
  giftEmoji?: string;
}

export default function VirtualLivePage() {
  const {
    currentStreamId, hostName, streamTitle,
    virtualAvatarEmoji, virtualAvatarColor,
    clearLiveState, viewerCount, setViewerCount,
  } = useLiveStore();
  const { setShowLivePage } = useAppStore();
  const { user } = useAuth();
  const { coinBalance, setCoinBalance } = useWalletStore();

  // Find virtual girl profile
  const girlProfile = VIRTUAL_GIRLS.find(g => g.id === currentStreamId) || VIRTUAL_GIRLS[0];

  const [chatMsgs, setChatMsgs]       = useState<VirtualChatMsg[]>([]);
  const [chatInput, setChatInput]     = useState('');
  const [showGifts, setShowGifts]     = useState(false);
  const [muted, setMuted]             = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number }[]>([]);
  const [recentGift, setRecentGift]   = useState<{ emoji: string; from: string } | null>(null);
  const [elapsed, setElapsed]         = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const heartIdRef = useRef(0);

  const GIFTS = [
    { emoji: '🌹', name: 'Rose',       cost: 10  },
    { emoji: '💝', name: 'Love',       cost: 50  },
    { emoji: '💎', name: 'Diamond',    cost: 200 },
    { emoji: '👑', name: 'Crown',      cost: 500 },
    { emoji: '🚀', name: 'Rocket',     cost: 100 },
    { emoji: '🎂', name: 'Cake',       cost: 150 },
  ];

  // ── Scroll chat to bottom ─────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  // ── Elapsed time ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fake viewer count fluctuation ────────────────────────────────
  useEffect(() => {
    const base = viewerCount || 30;
    setViewerCount(base);
    const t = setInterval(() => {
      setViewerCount(prev => {
        const delta = Math.floor(Math.random() * 7) - 3;
        return Math.max(10, (typeof prev === 'number' ? prev : base) + delta);
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // ── Fake chat messages ────────────────────────────────────────────
  useEffect(() => {
    // Initial greeting from host
    const greeting: VirtualChatMsg = {
      id: 'greet',
      user: girlProfile.name,
      text: randomItem(girlProfile.greetings),
      isHost: true,
    };
    setChatMsgs([greeting]);

    // Periodic fake messages
    const interval = setInterval(() => {
      const isHostMsg = Math.random() < 0.25;
      const msg: VirtualChatMsg = {
        id: Date.now().toString(),
        user: isHostMsg ? girlProfile.name : randomItem(FAKE_USERS),
        text: isHostMsg ? randomItem(girlProfile.reactions) : randomItem(FAKE_MSGS),
        isHost: isHostMsg,
      };
      setChatMsgs(prev => [...prev.slice(-40), msg]);
    }, 2500 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [girlProfile]);

  // ── Floating heart helper ─────────────────────────────────────────
  const addHeart = useCallback(() => {
    const id = heartIdRef.current++;
    const x = 20 + Math.random() * 60;
    setFloatingHearts(prev => [...prev.slice(-10), { id, x }]);
    setTimeout(() => setFloatingHearts(prev => prev.filter(h => h.id !== id)), 2000);
  }, []);

  // ── Send gift ─────────────────────────────────────────────────────
  const handleGift = useCallback(async (gift: typeof GIFTS[0]) => {
    if (!user || coinBalance < gift.cost) return;
    setShowGifts(false);

    // Deduct coins
    try {
      const res = await fetch('/api/coins/deduct-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, reason: `gift_${gift.name}`, amount: gift.cost }),
      });
      const data = await res.json();
      if (data.success) setCoinBalance(data.balanceAfter);
      else { alert('Not enough coins!'); return; }
    } catch { return; }

    // Show gift reaction
    setRecentGift({ emoji: gift.emoji, from: user.displayName || 'You' });
    setTimeout(() => setRecentGift(null), 3000);

    // Add to chat
    const giftMsg: VirtualChatMsg = {
      id: Date.now().toString(),
      user: user.displayName || 'You',
      text: `sent ${gift.emoji} ${gift.name}!`,
      isGift: true,
      giftEmoji: gift.emoji,
    };
    setChatMsgs(prev => [...prev.slice(-40), giftMsg]);

    // Host reaction after 1.5s
    setTimeout(() => {
      const reaction: VirtualChatMsg = {
        id: (Date.now() + 1).toString(),
        user: girlProfile.name,
        text: randomItem(girlProfile.giftReactions),
        isHost: true,
      };
      setChatMsgs(prev => [...prev.slice(-40), reaction]);
    }, 1500);

    // Floating hearts
    for (let i = 0; i < 5; i++) setTimeout(addHeart, i * 150);
  }, [user, coinBalance, girlProfile, addHeart, setCoinBalance]);

  // ── Send chat message ─────────────────────────────────────────────
  const handleSendChat = useCallback(() => {
    if (!chatInput.trim() || !user) return;
    const msg: VirtualChatMsg = {
      id: Date.now().toString(),
      user: user.displayName || 'You',
      text: chatInput.trim(),
    };
    setChatMsgs(prev => [...prev.slice(-40), msg]);
    setChatInput('');

    // Host replies occasionally
    if (Math.random() < 0.4) {
      setTimeout(() => {
        const reply: VirtualChatMsg = {
          id: (Date.now() + 1).toString(),
          user: girlProfile.name,
          text: randomItem(girlProfile.reactions),
          isHost: true,
        };
        setChatMsgs(prev => [...prev.slice(-40), reply]);
      }, 1500 + Math.random() * 1000);
    }
  }, [chatInput, user, girlProfile]);

  // ── Leave stream ──────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    clearLiveState();
    setTimeout(() => setShowLivePage(false), 50);
  }, [clearLiveState, setShowLivePage]);

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto"
      style={{ background: '#000', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Background gradient / avatar ── */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 50% 35%, ${virtualAvatarColor || girlProfile.color}33 0%, #000 70%)` }} />
        {/* Large avatar emoji */}
        <motion.div
          animate={{ scale: [1, 1.03, 1], y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[160px] select-none pointer-events-none"
          style={{ filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.1))' }}>
          {virtualAvatarEmoji || girlProfile.emoji}
        </motion.div>
        {/* Subtle pulse ring */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute w-64 h-64 rounded-full"
          style={{ border: `2px solid ${girlProfile.color}66` }} />
      </div>

      {/* ── Floating hearts ── */}
      <AnimatePresence>
        {floatingHearts.map(h => (
          <motion.div key={h.id}
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -200, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
            className="absolute bottom-32 pointer-events-none text-2xl z-30"
            style={{ left: `${h.x}%` }}>
            ❤️
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ── Gift animation ── */}
      <AnimatePresence>
        {recentGift && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1 pointer-events-none">
            <div className="text-6xl">{recentGift.emoji}</div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
              {recentGift.from} sent a gift! ✨
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP BAR ── */}
      <div className="absolute top-0 inset-x-0 z-20 px-3 pt-10 pb-6"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)' }}>
        <div className="flex items-center justify-between">
          {/* Back */}
          <button onClick={handleLeave}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* Host info */}
          <div className="flex items-center gap-2 flex-1 mx-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0"
              style={{ background: `${girlProfile.color}33`, border: `1.5px solid ${girlProfile.color}88` }}>
              {virtualAvatarEmoji || girlProfile.emoji}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate leading-tight">{hostName || girlProfile.name}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white/70 text-[10px]">LIVE</span>
                </div>
                <span className="text-white/50 text-[10px]">{fmtTime(elapsed)}</span>
              </div>
            </div>
          </div>

          {/* Viewer + mute */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ background: 'rgba(0,0,0,0.5)' }}>
              <Users className="w-3 h-3 text-white/70" />
              <span className="text-white text-xs">{viewerCount}</span>
            </div>
            <button onClick={() => setMuted(m => !m)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)' }}>
              {muted
                ? <VolumeX className="w-4 h-4 text-white/60" />
                : <Volume2 className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>

        {/* Title */}
        <p className="text-white/70 text-xs mt-2 ml-1 truncate">{streamTitle || girlProfile.title}</p>
      </div>

      {/* ── BOTTOM SECTION ── */}
      <div className="absolute bottom-0 inset-x-0 z-20"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 60%, transparent)' }}>

        {/* Chat messages */}
        <div className="px-3 pb-2 max-h-48 overflow-y-auto flex flex-col gap-1"
          style={{ scrollbarWidth: 'none' }}>
          {chatMsgs.map(msg => (
            <motion.div key={msg.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-1.5">
              <span className={`text-xs font-semibold shrink-0 ${msg.isHost ? '' : 'opacity-70'}`}
                style={{ color: msg.isHost ? girlProfile.color : '#fff' }}>
                {msg.user}
              </span>
              <span className={`text-xs text-white/80 ${msg.isGift ? 'font-semibold' : ''}`}>
                {msg.isGift && <span className="mr-1">{msg.giftEmoji}</span>}
                {msg.text}
              </span>
            </motion.div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Gift panel */}
        <AnimatePresence>
          {showGifts && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mx-3 mb-2 p-3 rounded-2xl grid grid-cols-6 gap-2"
              style={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {GIFTS.map(gift => (
                <button key={gift.name} onClick={() => handleGift(gift)}
                  disabled={coinBalance < gift.cost}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-2xl">{gift.emoji}</span>
                  <span className="text-[9px] text-white/60">{gift.cost}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat input + actions */}
        <div className="flex items-center gap-2 px-3 pb-6 pt-1">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              placeholder="Say something..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/40"
            />
            {chatInput ? (
              <button onClick={handleSendChat}>
                <Send className="w-4 h-4 text-white/70" />
              </button>
            ) : (
              <button onClick={addHeart}>
                <Heart className="w-4 h-4 text-pink-400" />
              </button>
            )}
          </div>

          {/* Gift button */}
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => setShowGifts(g => !g)}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: showGifts
                ? `linear-gradient(135deg, ${girlProfile.color}, ${girlProfile.color}99)`
                : 'rgba(255,255,255,0.1)',
            }}>
            <Gift className="w-5 h-5 text-white" />
          </motion.button>

          {/* Sparkle/react button */}
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => { for (let i = 0; i < 3; i++) setTimeout(addHeart, i * 100); }}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            <Sparkles className="w-5 h-5 text-yellow-400" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
