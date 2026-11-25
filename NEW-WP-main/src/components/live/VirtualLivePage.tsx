'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, Gift, Send, Users, Sparkles, Volume2, VolumeX,
} from 'lucide-react';
import { useLiveStore, useAppStore, useWalletStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';

// ─────────────────────────────────────────────────────────────────────────
// Free Pexels stock videos — South Asian / Sri Lankan look women
// These are direct MP4 links from Pexels (free, no attribution needed for app use)
// Replace with your own Firebase Storage URLs for custom videos
// ─────────────────────────────────────────────────────────────────────────
// ── Vercel Blob Storage Video URLs ───────────────────────────────────────
// Vercel → Storage → Blob → Browse → file click → URL copy කරලා paste කරන්න
const PEXELS_VIDEOS = [
  'YOUR_VERCEL_BLOB_URL_1', // සේවිලි — මෙතන URL paste කරන්න
  'YOUR_VERCEL_BLOB_URL_2', // දිනාරා — මෙතන URL paste කරන්න
  'YOUR_VERCEL_BLOB_URL_3', // සඳුනි — මෙතන URL paste කරන්න
  'YOUR_VERCEL_BLOB_URL_4', // නෙත්මි — මෙතන URL paste කරන්න
  'YOUR_VERCEL_BLOB_URL_5', // හසිනි — මෙතන URL paste කරන්න
];

export const VIRTUAL_GIRLS = [
  {
    id: 'virtual_live_01',
    name: 'සේවිලි',
    color: '#FF6B9D',
    videoUrl: PEXELS_VIDEOS[0],
    viewerBase: 47,
    title: 'හේ everyone! 🌙',
    greetings: ['හේ! ආවාට ස්තූතියි 💕', 'ඔයාලා ඉන්නකොට සතුටයි ✨', 'Good evening everyone! 🌙'],
    reactions: ['Aww ස්තූතියි!! 🥰', 'ඔයාලා ගොඩක් sweet 💕', 'හිනා වෙනවා 😊', 'Love the energy! ✨', 'ගොඩක් nice 🌸'],
    giftReactions: ['Oh wow ස්තූතියි!! 🎁💕', 'ඔයා මගේ රෑ හදලා!! 🥺✨', 'Awww!! 🌸', 'ගොඩක් kind!! 💖'],
  },
  {
    id: 'virtual_live_02',
    name: 'දිනාරා',
    color: '#A855F7',
    videoUrl: PEXELS_VIDEOS[1],
    viewerBase: 83,
    title: 'Dancing & chilling 💃',
    greetings: ['හේ! 💃', 'Fun time!! 🎉', 'Vibe එක real ✨', 'ආපු ඔක්කොට ස්තූතියි! 🔥'],
    reactions: ['Yesss!! 🔥', 'හිනා වෙනවා 😂', 'I see you!! 👀', 'Chat එක hype 💃', 'ගොඩක් fun!! 🎉'],
    giftReactions: ['NO WAY!! ස්තූතියි!! 🎉🔥', 'ඔයා crazy!! 💜', 'Oh my god!! 😱💃', 'Best gift!! ස්තූතියි!! 🎁'],
  },
  {
    id: 'virtual_live_03',
    name: 'සඳුනි',
    color: '#06B6D4',
    videoUrl: PEXELS_VIDEOS[2],
    viewerBase: 31,
    title: 'Late night vibes 🎵',
    greetings: ['හේ 🎵 ආවාට ස්තූතියි', 'Late night crew! 🌙', 'Music ගොඩක් nice ✨', 'Cozy night 💙'],
    reactions: ['එක real 💙', 'Feel වෙනවා 🌙', 'ඔයාලා ගොඩක් nice ✨', 'Vibes only 🎵', 'ස්තූතියි! 💫'],
    giftReactions: ['Oh wow... ස්තූතියි 💙', 'ගොඩක් ස්තූතියි 🌙', 'ඔයා කරන්නෑ ඕනේ!! ✨', 'Grateful ✨ 💫'],
  },
  {
    id: 'virtual_live_04',
    name: 'නෙත්මි',
    color: '#F59E0B',
    videoUrl: PEXELS_VIDEOS[3],
    viewerBase: 62,
    title: 'Evening chat 🌸',
    greetings: ['ආයුබෝවන්! 🌸', 'ඔක්කොම දැකලා සතුටයි 💛', 'කොහොමද ඔයාලා? ☀️', 'ආපු ඔක්කොට ස්වාගතයි! 🌼'],
    reactions: ['හිනා වෙනවා 😄', 'ඔයාලා cheer up කරනවා 💛', 'ගොඩක් funny 😂', 'ඔයාලා sweet 🌸', 'Love this!! ☀️'],
    giftReactions: ['ස්තූතියි!! 💛🌸', 'ගොඩක් generous!! ☀️', 'ගොඩක් kind!! 🥺', 'Happy වෙනවා!! 🌼'],
  },
  {
    id: 'virtual_live_05',
    name: 'හසිනි',
    color: '#10B981',
    videoUrl: PEXELS_VIDEOS[4],
    viewerBase: 29,
    title: 'Chill stream tonight 🍃',
    greetings: ['හේ! Welcome 🍃', 'Hang out කරමු 🌿', 'Relaxed night ✨', 'Good vibes 💚'],
    reactions: ['එක true 💚', 'ඔයාලා best 🍃', 'Smile වෙනවා 😊', 'Favorite part 🌿', 'Fun!! ✨'],
    giftReactions: ['Oh!! ස්තූතියි!! 💚🍃', 'ගොඩක් sweet!! 🌿', 'Believe කරන්නෑ!! 😊', 'Whole night හදලා!! ✨'],
  },
];

const FAKE_USERS = ['කසුන්', 'දිනේශ් 💯', 'රාජන්', 'ප්‍රියා ❤️', 'මිලාන්', 'සෞඛ්‍යා', 'තූෂාන්', 'අමා'];
const FAKE_MSGS = [
  'ගොඩක් nice 😍', 'හේ!! 👋', 'love the stream!!', '❤️❤️❤️', 'best streamer',
  'omg hii', '🔥🔥', 'waited for this', 'yesss!!', 'ගොඩක් beautiful 😍',
  'Colombo ඉදලා! 👋', '💕💕', 'first time here!!', 'ගොඩක් fun', '🎉🎉🎉',
  'ආයුබෝ 🙏', 'SL represent!! 🇱🇰', 'හිනා වෙනවා 😂',
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
  const { currentStreamId, hostName, streamTitle, clearLiveState } = useLiveStore();
  const { setShowLivePage } = useAppStore();
  const { user } = useAuth();
  const { coinBalance, setCoinBalance } = useWalletStore();

  const girlProfile = VIRTUAL_GIRLS.find(g => g.id === currentStreamId) || VIRTUAL_GIRLS[0];

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const heartIdRef = useRef(0);

  const [chatMsgs, setChatMsgs]     = useState<VirtualChatMsg[]>([]);
  const [chatInput, setChatInput]   = useState('');
  const [showGifts, setShowGifts]   = useState(false);
  const [muted, setMuted]           = useState(true);
  const [viewerCount, setViewerCount] = useState(girlProfile.viewerBase);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number }[]>([]);
  const [recentGift, setRecentGift] = useState<{ emoji: string; from: string } | null>(null);
  const [elapsed, setElapsed]       = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const GIFTS = [
    { emoji: '🌹', name: 'Rose',    cost: 10  },
    { emoji: '💝', name: 'Love',    cost: 50  },
    { emoji: '💎', name: 'Diamond', cost: 200 },
    { emoji: '👑', name: 'Crown',   cost: 500 },
    { emoji: '🚀', name: 'Rocket',  cost: 100 },
    { emoji: '🎂', name: 'Cake',    cost: 150 },
  ];

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Viewer fluctuation
  useEffect(() => {
    const t = setInterval(() => {
      setViewerCount(p => Math.max(10, p + Math.floor(Math.random() * 7) - 3));
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // Fake chat
  useEffect(() => {
    setChatMsgs([{ id: 'greet', user: girlProfile.name, text: randomItem(girlProfile.greetings), isHost: true }]);
    const iv = setInterval(() => {
      const isHost = Math.random() < 0.25;
      setChatMsgs(prev => [...prev.slice(-40), {
        id: Date.now().toString(),
        user: isHost ? girlProfile.name : randomItem(FAKE_USERS),
        text: isHost ? randomItem(girlProfile.reactions) : randomItem(FAKE_MSGS),
        isHost,
      }]);
    }, 2500 + Math.random() * 2000);
    return () => clearInterval(iv);
  }, [girlProfile]);

  // Hearts
  const addHeart = useCallback(() => {
    const id = heartIdRef.current++;
    setFloatingHearts(p => [...p.slice(-10), { id, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setFloatingHearts(p => p.filter(h => h.id !== id)), 2000);
  }, []);

  // Gift
  const handleGift = useCallback(async (gift: typeof GIFTS[0]) => {
    if (!user || coinBalance < gift.cost) { alert('Coins නෑ!'); return; }
    setShowGifts(false);
    try {
      const res = await fetch('/api/coins/deduct-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, reason: `gift_${gift.name}`, amount: gift.cost }),
      });
      const data = await res.json();
      if (data.success) setCoinBalance(data.balanceAfter);
      else { alert('Coins නෑ!'); return; }
    } catch { return; }

    setRecentGift({ emoji: gift.emoji, from: user.displayName || 'You' });
    setTimeout(() => setRecentGift(null), 3000);
    setChatMsgs(p => [...p.slice(-40), {
      id: Date.now().toString(), user: user.displayName || 'You',
      text: `sent ${gift.emoji} ${gift.name}!`, isGift: true, giftEmoji: gift.emoji,
    }]);
    setTimeout(() => setChatMsgs(p => [...p.slice(-40), {
      id: (Date.now() + 1).toString(), user: girlProfile.name,
      text: randomItem(girlProfile.giftReactions), isHost: true,
    }]), 1500);
    for (let i = 0; i < 5; i++) setTimeout(addHeart, i * 150);
  }, [user, coinBalance, girlProfile, addHeart, setCoinBalance]);

  // Chat send
  const handleSend = useCallback(() => {
    if (!chatInput.trim() || !user) return;
    setChatMsgs(p => [...p.slice(-40), { id: Date.now().toString(), user: user.displayName || 'You', text: chatInput.trim() }]);
    setChatInput('');
    if (Math.random() < 0.4) {
      setTimeout(() => setChatMsgs(p => [...p.slice(-40), {
        id: (Date.now() + 1).toString(), user: girlProfile.name,
        text: randomItem(girlProfile.reactions), isHost: true,
      }]), 1500 + Math.random() * 1000);
    }
  }, [chatInput, user, girlProfile]);

  // Leave
  const handleLeave = useCallback(() => {
    clearLiveState();
    setTimeout(() => setShowLivePage(false), 50);
  }, [clearLiveState, setShowLivePage]);

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto bg-black overflow-hidden">

      {/* ── Full screen video background ── */}
      <video
        ref={videoRef}
        src={girlProfile.videoUrl}
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: videoReady ? 1 : 0, transition: 'opacity 0.5s' }}
        autoPlay
        loop
        muted={muted}
        playsInline
        onCanPlay={() => setVideoReady(true)}
        onError={(e) => {
          setVideoReady(false);
          const err = (e.currentTarget as HTMLVideoElement).error;
          setVideoError(`code ${err?.code ?? '?'} ${err?.message ?? ''} | ${girlProfile.videoUrl}`);
        }}
      />

      {videoError && (
        <div className="absolute top-20 left-2 right-2 z-50 bg-black/80 text-red-400 text-[10px] p-2 rounded break-all">
          Video error: {videoError}
        </div>
      )}

      {/* Loading gradient when video not ready */}
      {!videoReady && (
        <div className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${girlProfile.color}44 0%, #111 60%, #000 100%)` }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.75) 100%)' }} />

      {/* ── Floating hearts ── */}
      <AnimatePresence>
        {floatingHearts.map(h => (
          <motion.div key={h.id}
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -200, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
            className="absolute bottom-32 pointer-events-none text-2xl z-30"
            style={{ left: `${h.x}%` }}>❤️</motion.div>
        ))}
      </AnimatePresence>

      {/* ── Gift animation ── */}
      <AnimatePresence>
        {recentGift && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1 pointer-events-none">
            <div className="text-6xl">{recentGift.emoji}</div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
              {recentGift.from} sent a gift! ✨
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP BAR ── */}
      <div className="relative z-20 flex items-center gap-3 px-3 pt-10 pb-3">
        <button onClick={handleLeave}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(220,38,38,0.85)' }}>
              <motion.div className="w-1.5 h-1.5 rounded-full bg-white"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
              <span className="text-white text-[10px] font-bold">LIVE</span>
            </div>
            <span className="text-white font-semibold text-sm truncate">{hostName || girlProfile.name}</span>
          </div>
          <p className="text-white/60 text-[11px] mt-0.5 truncate">{streamTitle || girlProfile.title}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
            <Users className="w-3 h-3 text-white/70" />
            <span className="text-white text-xs">{viewerCount}</span>
          </div>
          <button onClick={() => { setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted; }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
            {muted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      {/* ── BOTTOM SECTION ── */}
      <div className="absolute bottom-0 inset-x-0 z-20">

        {/* Chat messages */}
        <div className="px-3 pb-2 max-h-52 overflow-y-auto flex flex-col gap-1.5" style={{ scrollbarWidth: 'none' }}>
          {chatMsgs.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-1.5 max-w-[85%]">
              <div className="flex items-baseline gap-1.5 px-2.5 py-1.5 rounded-2xl rounded-tl-sm"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}>
                <span className="text-[11px] font-semibold shrink-0"
                  style={{ color: msg.isHost ? girlProfile.color : '#a0a0a0' }}>
                  {msg.user}
                </span>
                <span className="text-white text-[12px] leading-snug">
                  {msg.isGift && <span className="mr-1">{msg.giftEmoji}</span>}
                  {msg.text}
                </span>
              </div>
            </motion.div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Gift panel */}
        <AnimatePresence>
          {showGifts && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }}
              className="mx-3 mb-2 p-3 rounded-2xl grid grid-cols-6 gap-2"
              style={{ background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}>
              {GIFTS.map(gift => (
                <button key={gift.name} onClick={() => handleGift(gift)}
                  disabled={coinBalance < gift.cost}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity disabled:opacity-35"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-2xl">{gift.emoji}</span>
                  <span className="text-[9px] text-white/50">{gift.cost}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="flex items-center gap-2 px-3 pb-8 pt-1">
          <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Comment..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/40" />
            {chatInput
              ? <button onClick={handleSend}><Send className="w-4 h-4 text-white/70" /></button>
              : <button onClick={addHeart}><Heart className="w-4 h-4 text-pink-400" /></button>}
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowGifts(g => !g)}
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: showGifts ? girlProfile.color : 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
            <Gift className="w-5 h-5 text-white" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => { for (let i = 0; i < 4; i++) setTimeout(addHeart, i * 100); }}
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
            <Sparkles className="w-5 h-5 text-yellow-400" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

