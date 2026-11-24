'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  doc,
  updateDoc,
  increment,
  collection,
  addDoc,
  query,
  orderBy,
  limitToLast,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { requestAppFullscreen, exitAppFullscreen } from '@/lib/utils';
import { useAgoraLive } from '@/hooks/useAgoraLive';
import {
  useLiveStore,
  useWalletStore,
  useAuthStore,
  useAppStore,
  romanticGifts,
  RomanticGift,
} from '@/lib/store';
import { GiftAnimation } from '@/components/three/GiftAnimation';
import { GlassmorphismCard } from '@/components/three/GlassmorphismCard';
import { CoinIcon } from '@/components/three/CoinIcon';
import {
  X,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Gift,
  Share2,
  RotateCcw,
  Heart,
  MessageCircle,
  Eye,
  Send,
  ChevronDown,
  ChevronUp,
  Maximize,
  Users,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

// ─── Avatar Color Helper ────────────────────────────────────────────────────

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#82E0AA', '#F1948A', '#AED6F1', '#F9E79F'];
function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Helper: format time mm:ss ───────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── Floating Heart ──────────────────────────────────────────────────────────

interface FloatingHeart {
  id: string;
  x: number;
  size: number;
  color: string;
}

const heartColors = ['#FF6B6B', '#FF1493', '#FF69B4', '#FF1744', '#E91E63'];

function FloatingHearts({ hearts }: { hearts: FloatingHeart[] }) {
  return (
    <AnimatePresence>
      {hearts.map((h) => (
        <motion.div
          key={h.id}
          className="fixed pointer-events-none z-40"
          style={{
            left: `${h.x}%`,
            bottom: '15%',
          }}
          initial={{ opacity: 1, y: 0, scale: 0.3, rotateZ: -10 }}
          animate={{
            opacity: [1, 1, 0.8, 0],
            y: [0, -120, -280, -420],
            x: [0, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40],
            scale: [0.3, 1.2, 1, 0.6],
            rotateZ: [0, -15, 10, -20],
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3.5, ease: 'easeOut' }}
        >
          <Heart
            className="drop-shadow-lg"
            style={{
              width: h.size,
              height: h.size,
              color: h.color,
              fill: h.color,
            }}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

// ─── Main Component: LiveFullPage ─────────────────────────────────────────────

export default function LiveFullPage() {
  // ─── Store State ──────────────────────────────────────────────────────
  const {
    isHosting,
    isViewing,
    currentChannel,
    currentStreamId,
    hostId,
    hostName,
    streamTitle: storedStreamTitle,
    viewerCount,
    liveGifts,
    liveMessages,
    setHosting,
    setViewing,
    clearLiveState,
    setLiveGifts,
    setLiveMessages,
    setViewerCount,
  } = useLiveStore();

  const { coinBalance, setCoinBalance, addTransaction } = useWalletStore();
  const { setShowLivePage } = useAppStore();

  // ─── Real Agora video/audio ─────────────────────────────────────────────
  const {
    startBroadcasting,
    stopBroadcasting,
    watchStream,
    leaveStream: leaveAgoraStream,
    setMicEnabled,
    setCameraEnabled,
    switchCamera,
    localVideoTrack,
    remoteVideoTrack,
    error: agoraError,
  } = useAgoraLive();

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  // ─── Local State ──────────────────────────────────────────────────────
  const [elapsedTime, setElapsedTime] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [selectedGift, setSelectedGift] = useState<RomanticGift | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [peakViewers, setPeakViewers] = useState(0);
  const [streamTitle, setStreamTitle] = useState('');
  const [startFailed, setStartFailed] = useState(false);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const autoChatRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Derived ──────────────────────────────────────────────────────────
  const isActive = isHosting || isViewing;

  // ─── Ensure fullscreen is exited if this component unmounts for any reason ──
  useEffect(() => {
    return () => {
      exitAppFullscreen();
    };
  }, []);

  // ─── Safety net: end/leave the stream even if the normal flow never ran ──
  // If the tab is closed, the app is backgrounded/killed, or this component
  // unmounts some other way (e.g. the error boundary caught a crash) while
  // still hosting or viewing, the stream's Firestore doc would otherwise be
  // left as "active" forever — which is exactly what makes the same host
  // show up as "live" more than once the next time they actually go live.
  // navigator.sendBeacon is used (rather than a normal fetch) because it's
  // the one request type browsers guarantee gets sent during page teardown.
  useEffect(() => {
    const sendLeaveBeacon = () => {
      const state = useLiveStore.getState();
      if (!state.currentStreamId) return;
      if (!state.isHosting && !state.isViewing) return;
      const payload = JSON.stringify({
        action: state.isHosting ? 'end_host' : 'leave_viewer',
        streamId: state.currentStreamId,
        uid: useAuthStore.getState().user?.uid || '',
      });
      try {
        navigator.sendBeacon?.(
          '/api/live/leave-beacon',
          new Blob([payload], { type: 'application/json' })
        );
      } catch {
        // Best-effort only — nothing else to fall back to during teardown.
      }
    };

    // Tab/app closing or being backgrounded on mobile.
    window.addEventListener('pagehide', sendLeaveBeacon);
    return () => {
      window.removeEventListener('pagehide', sendLeaveBeacon);
      // Component unmounting some other way (e.g. LiveErrorBoundary closed
      // after a crash) without the explicit End/Leave flow having run —
      // handleEndStream already clears isHosting/isViewing before it
      // unmounts this component normally, so this is a no-op in that case.
      sendLeaveBeacon();
    };
  }, []);

  // ─── Auto-start hosting on mount (skip setup screen) ──────────────────
  useEffect(() => {
    // Best-effort fallback in case the triggering click handler's fullscreen
    // request didn't take (e.g. browser gesture-timing quirks).
    requestAppFullscreen();

    if (hasStartedRef.current) return;

    if (!isHosting && !isViewing) {
      hasStartedRef.current = true;
      const channelId = `channel_${Date.now()}`;
      const defaultTitle = `Live Stream 🎥`;
      setStreamTitle(defaultTitle);

      startBroadcasting(defaultTitle, channelId).then((result) => {
        if (result) {
          setHosting(true, result.channelName, result.streamId);
        } else {
          // Broadcast failed to start (e.g. camera/mic permission denied,
          // or Agora not configured) — show the error instead of just closing.
          setStartFailed(true);
        }
      });
    } else if (isViewing && currentChannel) {
      hasStartedRef.current = true;
      setStreamTitle(storedStreamTitle || `${hostName || 'Someone'}'s Live Stream`);
      watchStream(currentStreamId || currentChannel, currentChannel);

      // Bump the real viewer count on the host's stream doc.
      if (currentStreamId) {
        updateDoc(doc(db, 'liveStreams', currentStreamId), {
          viewerCount: increment(1),
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Stream Timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => setElapsedTime((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  // ─── Real Viewer Count (host and viewers both watch the stream doc) ───
  useEffect(() => {
    if (!isActive || !currentStreamId) return;
    let unsubscribe: (() => void) | undefined;
    import('firebase/firestore').then(({ onSnapshot }) => {
      unsubscribe = onSnapshot(doc(db, 'liveStreams', currentStreamId), (snap) => {
        const count = snap.data()?.viewerCount ?? 0;
        setViewerCount(count);
        setPeakViewers((prev) => Math.max(prev, count));
      });
    });
    return () => unsubscribe?.();
  }, [isActive, currentStreamId, setViewerCount]);

  // ─── Real-time Live Chat (synced via Firestore) ────────────────────────
  useEffect(() => {
    if (!isActive || !currentStreamId) return;
    const chatQuery = query(
      collection(db, 'liveStreams', currentStreamId, 'chat'),
      orderBy('createdAt', 'asc'),
      limitToLast(50)
    );
    const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const messages = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          user: data.userName || 'Someone',
          text: data.text || '',
          color: data.userId === useAuthStore.getState().user?.uid ? '#25D366' : colorForName(data.userName || 'user'),
          timestamp: data.createdAt?.toMillis?.() || Date.now(),
        };
      });
      setLiveMessages(messages);
    });
    return () => unsubscribe();
  }, [isActive, currentStreamId, setLiveMessages]);

  // ─── Real-time Live Gifts (synced via Firestore) ───────────────────────
  useEffect(() => {
    if (!isActive || !currentStreamId) return;
    const giftsQuery = query(
      collection(db, 'liveStreams', currentStreamId, 'gifts'),
      orderBy('createdAt', 'asc'),
      limitToLast(20)
    );
    const unsubscribe = onSnapshot(giftsQuery, (snapshot) => {
      const gifts = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          emoji: data.emoji || '🎁',
          name: data.giftName || 'Gift',
          sender: data.senderId === useAuthStore.getState().user?.uid ? 'You' : (data.senderName || 'Someone'),
          timestamp: data.createdAt?.toMillis?.() || Date.now(),
          cost: data.cost || 0,
        };
      });
      setLiveGifts(gifts);
    });
    return () => unsubscribe();
  }, [isActive, currentStreamId, setLiveGifts]);

  // ─── Auto Scroll Chat ─────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveMessages]);

  // ─── Play the real video track (local for host, remote for viewer) ─────
  useEffect(() => {
    const track = isHosting ? localVideoTrack : remoteVideoTrack;
    if (track && videoContainerRef.current) {
      track.play(videoContainerRef.current);
    }
    return () => {
      track?.stop();
    };
  }, [isHosting, localVideoTrack, remoteVideoTrack]);

  // ─── Cleanup Floating Hearts ──────────────────────────────────────────
  useEffect(() => {
    if (floatingHearts.length === 0) return;
    const timer = setTimeout(() => {
      setFloatingHearts((prev) => prev.slice(1));
    }, 3600);
    return () => clearTimeout(timer);
  }, [floatingHearts]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (isHosting || isViewing) {
      setShowEndDialog(true);
    } else {
      exitAppFullscreen();
      setShowLivePage(false);
    }
  }, [isHosting, isViewing, setShowLivePage]);

  const handleEndStream = useCallback(async () => {
    if (isHosting) {
      await stopBroadcasting();
      // Safety net: directly update Firestore using the store's streamId
      // in case the hook's internal state was already cleared.
      if (currentStreamId) {
        updateDoc(doc(db, 'liveStreams', currentStreamId), {
          status: 'ended',
          endedAt: serverTimestamp(),
        }).catch(() => {});
      }
    } else if (isViewing) {
      leaveAgoraStream();
      if (currentStreamId) {
        updateDoc(doc(db, 'liveStreams', currentStreamId), {
          viewerCount: increment(-1),
        }).catch(() => {});
      }
    }
    clearLiveState();
    setShowEndDialog(false);
    setShowGiftPanel(false);
    setElapsedTime(0);
    setPeakViewers(0);
    setFloatingHearts([]);
    setChatInput('');
    setSelectedGift(null);
    setIsMicOn(true);
    setIsCameraOn(true);
    setShowChat(true);
    exitAppFullscreen();
    setShowLivePage(false);
  }, [isHosting, isViewing, currentStreamId, stopBroadcasting, leaveAgoraStream, clearLiveState, setShowLivePage]);

  const [giftError, setGiftError] = useState('');

  const handleSendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !currentStreamId) return;
    const currentUser = useAuthStore.getState().user;
    setChatInput('');
    addDoc(collection(db, 'liveStreams', currentStreamId, 'chat'), {
      userId: currentUser?.uid || 'anonymous',
      userName: currentUser?.displayName || 'You',
      text,
      createdAt: serverTimestamp(),
    }).catch(() => {
      // If the write fails, the message just won't appear — no local fallback,
      // since a fake local-only echo would show something other users never saw.
    });
  }, [chatInput, currentStreamId]);

  const handleSendGift = useCallback(
    async (gift: RomanticGift) => {
      // Only a viewer can gift the host — hosting your own stream shouldn't
      // let you send (and be billed for) a gift to yourself.
      if (!isViewing || !hostId || !currentStreamId) return;
      if (coinBalance < gift.cost) {
        setGiftError('Not enough coins for this gift.');
        return;
      }

      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      setGiftError('');
      setSelectedGift(null);
      setShowGiftPanel(false);

      try {
        const res = await fetch('/api/coins/send-gift', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            receiverId: hostId,
            giftId: gift.id,
            context: 'live',
            streamId: currentStreamId,
          }),
        });
        const data = await res.json();

        if (data.success && typeof data.senderBalanceAfter === 'number') {
          setCoinBalance(data.senderBalanceAfter);
          addTransaction({
            id: `tx_${Date.now()}`,
            type: 'gift_sent',
            amount: -gift.cost,
            description: `Sent ${gift.emoji} ${gift.name} in live stream`,
            timestamp: Date.now(),
          });
          // No local addLiveGift call needed — the Firestore listener above
          // picks up the gift-event doc the API just wrote and syncs it to
          // everyone (including the sender) automatically.
        } else {
          setGiftError(data.error || 'Failed to send gift.');
        }
      } catch {
        setGiftError('Network error — gift not sent.');
      }
    },
    [isViewing, hostId, currentStreamId, coinBalance, setCoinBalance, addTransaction]
  );

  const handleSendHeart = useCallback(() => {
    const newHeart: FloatingHeart = {
      id: `heart_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      x: 60 + Math.random() * 30,
      size: 18 + Math.random() * 16,
      color: heartColors[Math.floor(Math.random() * heartColors.length)],
    };
    setFloatingHearts((prev) => [...prev, newHeart]);
  }, []);

  const handleLeaveStream = useCallback(() => {
    handleEndStream();
  }, [handleEndStream]);

  // ─── Total Gifts Revenue ──────────────────────────────────────────────
  const totalGiftsRevenue = liveGifts.reduce(
    (sum: number, g: any) => sum + (g.cost || 0),
    0
  );

  // ─── Render ───────────────────────────────────────────────────────────
  // Auto-hosting is triggered on mount via useEffect above.
  // If state hasn't updated yet, show a brief loading state (or the error,
  // if starting the broadcast failed).
  if (!isHosting && !isViewing) {
    if (startFailed) {
      return (
        <div className="fixed inset-0 z-50 bg-[#0B141A] flex items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center">
              <Camera className="w-8 h-8 text-red-400" />
            </div>
            <span className="text-sm text-white font-medium">Couldn't start the live stream</span>
            {agoraError && (
              <span className="text-xs text-white/60 leading-relaxed">{agoraError}</span>
            )}
            <button
              onClick={() => setShowLivePage(false)}
              className="mt-2 px-5 py-2 rounded-full bg-[#25D366] text-black text-sm font-semibold"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-50 bg-[#0B141A] flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <span className="text-sm text-white/70 font-medium">Starting Live Stream...</span>
        </motion.div>
      </div>
    );
  }

  // Active stream (hosting or viewing)
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: '#0B141A' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ═══════ VIDEO / CAMERA AREA ═══════ */}
      <div className="relative flex-1 min-h-0">
        {/* Real Agora video track — host's local camera, or the remote host's
            video when viewing. Empty until a track actually plays into it. */}
        <div
          ref={videoContainerRef}
          className="absolute inset-0 z-[5] [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover"
        />

        {/* Gradient background simulating camera */}
        <div className="absolute inset-0">
          {isCameraOn ? (
            <>
              {/* Animated gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#1F2C34]" />

              {/* Floating blobs */}
              <motion.div
                className="absolute w-48 h-48 rounded-full bg-[#25D366]/10"
                style={{ top: '10%', left: '5%' }}
                animate={{
                  x: [0, 80, -40, 0],
                  y: [0, -60, 40, 0],
                  scale: [1, 1.3, 0.8, 1],
                }}
                transition={{
                  duration: 14,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.div
                className="absolute w-64 h-64 rounded-full bg-[#075E54]/25"
                style={{ top: '-10%', right: '-15%' }}
                animate={{
                  x: [0, -60, 40, 0],
                  y: [0, 40, -60, 0],
                }}
                transition={{
                  duration: 18,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.div
                className="absolute w-36 h-36 rounded-full bg-[#128C7E]/15"
                style={{ bottom: '20%', left: '40%' }}
                animate={{
                  x: [0, 50, -30, 0],
                  y: [0, -30, 50, 0],
                  scale: [1, 0.8, 1.2, 1],
                }}
                transition={{
                  duration: 11,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Camera label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  className="flex flex-col items-center gap-2"
                  animate={{ opacity: [0.15, 0.3, 0.15] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Camera className="w-14 h-14 text-white/40" />
                  <span className="text-xs text-white/30 font-medium">
                    {isFrontCamera ? 'Front Camera' : 'Back Camera'}
                  </span>
                </motion.div>
              </div>
            </>
          ) : (
            /* Camera OFF */
            <div className="absolute inset-0 bg-[#111B21] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-20 h-20 rounded-full bg-[#1F2C34] flex items-center justify-center"
                >
                  <CameraOff className="w-10 h-10 text-gray-600" />
                </motion.div>
                <span className="text-sm text-gray-500">Camera is off</span>
              </div>
            </div>
          )}
        </div>

        {/* ─── Agora Error Banner ─── */}
        {agoraError && (
          <div className="absolute top-24 inset-x-3 z-40">
            <div className="bg-red-600/90 backdrop-blur-sm rounded-xl px-4 py-3 flex items-start gap-2.5">
              <span className="text-xs text-white leading-relaxed">
                ⚠️ {agoraError}
              </span>
            </div>
          </div>
        )}

        {/* ─── Gift Animations (left side) ─── */}
        <div className="absolute top-28 left-3 z-30 pointer-events-none">
          <GiftAnimation gifts={liveGifts} position="left" />
        </div>

        {/* ─── Floating Hearts ─── */}
        <FloatingHearts hearts={floatingHearts} />

        {/* ─── TOP BAR ─── */}
        <div className="absolute top-0 inset-x-0 z-30">
          <div className="bg-gradient-to-b from-black/70 via-black/40 to-transparent px-4 pt-3 pb-10">
            <div className="flex items-center justify-between">
              {/* Left: Back */}
              <motion.button
                onClick={handleBack}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </motion.button>

              {/* Center: LIVE + Timer + Viewers */}
              <div className="flex items-center gap-2">
                {/* LIVE badge */}
                <motion.div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 shadow-lg shadow-red-600/30"
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <motion.div
                    className="w-2 h-2 rounded-full bg-white"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                  <span className="text-[11px] font-bold text-white tracking-wide">
                    LIVE
                  </span>
                </motion.div>

                {/* Timer */}
                <span className="text-[11px] font-mono text-white/80 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                  {formatTime(elapsedTime)}
                </span>

                {/* Viewer Count */}
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
                  <Eye className="w-3 h-3 text-white/80" />
                  <motion.span
                    key={viewerCount}
                    className="text-[11px] text-white font-medium"
                    initial={{ y: -6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    {viewerCount >= 1000
                      ? `${(viewerCount / 1000).toFixed(1)}K`
                      : viewerCount}
                  </motion.span>
                </div>
              </div>

              {/* Right: Coins + Gift (viewer only — a host can't gift themselves) */}
              <div className="flex items-center gap-2">
                <CoinIcon size="sm" balance={coinBalance} />
                {isViewing && (
                  <motion.button
                    onClick={() => setShowGiftPanel(!showGiftPanel)}
                    className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                    whileTap={{ scale: 0.9 }}
                  >
                    <Gift
                      className={`w-4 h-4 ${
                        showGiftPanel ? 'text-yellow-400' : 'text-white'
                      }`}
                    />
                  </motion.button>
                )}
              </div>
            </div>

            {/* Host label / Streamer info */}
            <div className="mt-2 flex items-center gap-2 px-1">
              {isHosting && (
                <span className="text-[11px] text-[#25D366] font-semibold bg-[#25D366]/15 px-2 py-0.5 rounded-full">
                  ✨ Your Stream
                </span>
              )}
              {isViewing && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">
                        {streamTitle?.charAt(0) || 'S'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white leading-tight">
                        {isHosting
                          ? (useAuthStore.getState().user?.displayName || 'You')
                          : (hostName || 'Streamer')}
                      </p>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        {streamTitle}
                      </p>
                    </div>
                  </div>
                  {!isFollowing && (
                    <motion.button
                      onClick={() => setIsFollowing(true)}
                      className="ml-auto px-3 py-1 rounded-full bg-[#25D366] text-[10px] font-bold text-white"
                      whileTap={{ scale: 0.9 }}
                    >
                      Follow
                    </motion.button>
                  )}
                  {isFollowing && (
                    <span className="ml-auto text-[10px] text-[#25D366] font-semibold px-3 py-1 rounded-full bg-[#25D366]/15 border border-[#25D366]/30">
                      Following
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── CHAT OVERLAY (bottom-left) ─── */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              className="absolute bottom-0 left-0 right-16 z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className="px-3 pb-2 max-h-72 overflow-y-auto"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(42,57,66,0.5) transparent',
                }}
              >
                {liveMessages.slice(-15).map((msg: any) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -15, y: 8 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mb-1.5"
                  >
                    <div className="inline-block max-w-[85%] px-3 py-1.5 rounded-xl bg-black/45 backdrop-blur-md">
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: msg.color || '#fff' }}
                      >
                        {msg.user}
                      </span>
                      <span className="text-[11px] text-white/90 ml-1.5">
                        {msg.text}
                      </span>
                    </div>
                  </motion.div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── VIEWING: Leave Button ─── */}
        {isViewing && (
          <div className="absolute top-24 right-3 z-30">
            <motion.button
              onClick={handleLeaveStream}
              className="px-4 py-2 rounded-full bg-red-600/90 backdrop-blur-sm text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/30"
              whileTap={{ scale: 0.9 }}
            >
              <PhoneOff className="w-3.5 h-3.5" />
              Leave
            </motion.button>
          </div>
        )}
      </div>

      {/* ═══════ CHAT INPUT ═══════ */}
      {isActive && (
        <div className="relative z-30 px-3 py-2">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-full bg-[#1F2C34]/95 backdrop-blur-xl border border-[#2A3942]/60">
            <MessageCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Say something..."
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none min-w-0"
            />
            <AnimatePresence>
              {chatInput.trim() && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={handleSendChat}
                  className="p-0.5"
                  whileTap={{ scale: 0.8 }}
                >
                  <Send className="w-4 h-4 text-[#25D366]" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ═══════ BOTTOM CONTROLS BAR ═══════ */}
      {isActive && (
        <div className="relative z-30 px-3 py-2.5 pb-4">
          <div className="flex items-center justify-between gap-2">
            {/* Left group */}
            <div className="flex items-center gap-2">
              {/* Camera Flip */}
              {isHosting && (
                <motion.button
                  onClick={() => {
                    setIsFrontCamera(!isFrontCamera);
                    switchCamera();
                  }}
                  className="flex flex-col items-center gap-0.5"
                  whileTap={{ scale: 0.9 }}
                >
                  <div className="w-10 h-10 rounded-full bg-[#1F2C34]/90 backdrop-blur-xl border border-[#2A3942]/60 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[9px] text-gray-500">
                    {isFrontCamera ? 'Front' : 'Back'}
                  </span>
                </motion.button>
              )}

              {/* Mic Toggle */}
              <motion.button
                onClick={() => {
                  const next = !isMicOn;
                  setIsMicOn(next);
                  setMicEnabled(next);
                }}
                className="flex flex-col items-center gap-0.5"
                whileTap={{ scale: 0.9 }}
              >
                <div
                  className={`w-10 h-10 rounded-full backdrop-blur-xl border flex items-center justify-center ${
                    isMicOn
                      ? 'bg-[#1F2C34]/90 border-[#2A3942]/60'
                      : 'bg-red-600/90 border-red-500/60'
                  }`}
                >
                  {isMicOn ? (
                    <Mic className="w-4 h-4 text-white" />
                  ) : (
                    <MicOff className="w-4 h-4 text-white" />
                  )}
                </div>
                <span
                  className={`text-[9px] ${isMicOn ? 'text-gray-500' : 'text-red-400'}`}
                >
                  {isMicOn ? 'Mic' : 'Muted'}
                </span>
              </motion.button>

              {/* Camera Toggle */}
              {isHosting && (
                <motion.button
                  onClick={() => {
                    const next = !isCameraOn;
                    setIsCameraOn(next);
                    setCameraEnabled(next);
                  }}
                  className="flex flex-col items-center gap-0.5"
                  whileTap={{ scale: 0.9 }}
                >
                  <div
                    className={`w-10 h-10 rounded-full backdrop-blur-xl border flex items-center justify-center ${
                      isCameraOn
                        ? 'bg-[#1F2C34]/90 border-[#2A3942]/60'
                        : 'bg-red-600/90 border-red-500/60'
                    }`}
                  >
                    {isCameraOn ? (
                      <Camera className="w-4 h-4 text-white" />
                    ) : (
                      <CameraOff className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span
                    className={`text-[9px] ${isCameraOn ? 'text-gray-500' : 'text-red-400'}`}
                  >
                    {isCameraOn ? 'Cam' : 'Off'}
                  </span>
                </motion.button>
              )}
            </div>

            {/* Center: End Stream (host) or Heart (viewer) */}
            {isHosting ? (
              <motion.button
                onClick={() => setShowEndDialog(true)}
                className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-xl shadow-red-600/40"
                whileTap={{ scale: 0.85 }}
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </motion.button>
            ) : (
              <motion.button
                onClick={handleSendHeart}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center shadow-xl shadow-pink-500/30"
                whileTap={{ scale: 0.85 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <Heart className="w-6 h-6 text-white fill-white" />
              </motion.button>
            )}

            {/* Right group */}
            <div className="flex items-center gap-2">
              {/* Gift Button (viewer only — a host can't gift themselves) */}
              {isViewing && (
                <motion.button
                  onClick={() => setShowGiftPanel(!showGiftPanel)}
                  className="flex flex-col items-center gap-0.5"
                  whileTap={{ scale: 0.9 }}
                >
                  <div
                    className={`w-10 h-10 rounded-full backdrop-blur-xl border flex items-center justify-center ${
                      showGiftPanel
                        ? 'bg-gradient-to-br from-yellow-500 to-teal-500 border-yellow-400/60'
                        : 'bg-[#1F2C34]/90 border-[#2A3942]/60'
                    }`}
                  >
                    <Gift className="w-4 h-4 text-white" />
                  </div>
                  <span
                    className={`text-[9px] ${showGiftPanel ? 'text-yellow-400' : 'text-gray-500'}`}
                  >
                    Gift
                  </span>
                </motion.button>
              )}

              {/* Chat Toggle */}
              <motion.button
                onClick={() => setShowChat(!showChat)}
                className="flex flex-col items-center gap-0.5"
                whileTap={{ scale: 0.9 }}
              >
                <div
                  className={`w-10 h-10 rounded-full backdrop-blur-xl border flex items-center justify-center ${
                    showChat
                      ? 'bg-[#1F2C34]/90 border-[#2A3942]/60'
                      : 'bg-[#1F2C34]/50 border-[#2A3942]/30'
                  }`}
                >
                  {showChat ? (
                    <ChevronDown className="w-4 h-4 text-white" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <span
                  className={`text-[9px] ${showChat ? 'text-gray-500' : 'text-gray-600'}`}
                >
                  Chat
                </span>
              </motion.button>

              {/* Share */}
              <motion.button
                className="flex flex-col items-center gap-0.5"
                whileTap={{ scale: 0.9 }}
              >
                <div className="w-10 h-10 rounded-full bg-[#1F2C34]/90 backdrop-blur-xl border border-[#2A3942]/60 flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-[9px] text-gray-500">Share</span>
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ROMANTIC GIFT PANEL ═══════ */}
      <AnimatePresence>
        {showGiftPanel && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-40"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Backdrop handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>

            <div
              className="bg-[#111B21]/98 backdrop-blur-2xl border-t border-[#2A3942]/60 px-4 pt-2 pb-6"
              style={{ maxHeight: '55vh' }}
            >
              {/* Gift error */}
              {giftError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-600/15 border border-red-600/30">
                  <span className="text-xs text-red-400">{giftError}</span>
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-bold text-white">
                    Romantic Gifts
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                </div>
                <div className="flex items-center gap-3">
                  <CoinIcon size="sm" balance={coinBalance} />
                  <motion.button
                    onClick={() => {
                      setShowGiftPanel(false);
                      setSelectedGift(null);
                    }}
                    className="w-7 h-7 rounded-full bg-[#1F2C34] flex items-center justify-center"
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </motion.button>
                </div>
              </div>

              {/* Gift Grid (4 columns) */}
              <div className="grid grid-cols-4 gap-2 mb-4 overflow-y-auto max-h-[35vh] pr-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(42,57,66,0.5) transparent' }}
              >
                {romanticGifts.map((gift) => {
                  const canAfford = coinBalance >= gift.cost;
                  const isSelected = selectedGift?.id === gift.id;
                  return (
                    <motion.button
                      key={gift.id}
                      onClick={() =>
                        canAfford ? setSelectedGift(gift) : null
                      }
                      whileHover={canAfford ? { scale: 1.05 } : undefined}
                      whileTap={canAfford ? { scale: 0.92 } : undefined}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-yellow-500/20 to-teal-500/20 border-yellow-400/60 shadow-lg shadow-yellow-400/10'
                          : canAfford
                            ? 'bg-[#1F2C34] border-[#2A3942] hover:border-[#25D366]/40'
                            : 'bg-[#1F2C34]/50 border-[#2A3942]/30 opacity-40'
                      }`}
                    >
                      <motion.span
                        className="text-2xl leading-none"
                        animate={
                          isSelected
                            ? { scale: [1, 1.2, 1], rotate: [0, -8, 8, 0] }
                            : undefined
                        }
                        transition={{
                          duration: 0.5,
                          repeat: isSelected ? Infinity : 0,
                        }}
                      >
                        {gift.emoji}
                      </motion.span>
                      <span className="text-[10px] text-gray-300 font-medium truncate w-full text-center">
                        {gift.name}
                      </span>
                      <span className="text-[10px] text-yellow-400 font-bold flex items-center gap-0.5">
                        💰 {gift.cost.toLocaleString()}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Selected Gift Send Button */}
              <AnimatePresence>
                {selectedGift && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                  >
                    <button
                      onClick={() => handleSendGift(selectedGift)}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-yellow-500/20"
                    >
                      <motion.span
                        animate={{ rotate: [0, -10, 10, 0] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                        }}
                      >
                        {selectedGift.emoji}
                      </motion.span>
                      Send {selectedGift.name} ({selectedGift.cost} coins)
                      <Send className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ END STREAM DIALOG ═══════ */}
      <AnimatePresence>
        {showEndDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <GlassmorphismCard
                variant="dark"
                className="p-6 w-80 text-center"
                style={{
                  boxShadow:
                    '0 0 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
                }}
              >
                {/* Icon */}
                <motion.div
                  className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-600/20 flex items-center justify-center"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <PhoneOff className="w-8 h-8 text-red-500" />
                </motion.div>

                <h3 className="text-xl font-bold text-white mb-1">
                  End Stream?
                </h3>
                <p className="text-sm text-gray-400 mb-5">
                  Your stream will end for all viewers
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    {
                      label: 'Duration',
                      value: formatTime(elapsedTime),
                      icon: '⏱️',
                    },
                    {
                      label: 'Peak Viewers',
                      value: peakViewers.toLocaleString(),
                      icon: '👁️',
                    },
                    {
                      label: 'Gifts Received',
                      value: liveGifts.length.toString(),
                      icon: '🎁',
                    },
                    {
                      label: 'Coins Earned',
                      value: totalGiftsRevenue.toLocaleString(),
                      icon: '💰',
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-2.5 rounded-xl bg-[#111B21]/60 border border-[#2A3942]/40"
                    >
                      <div className="text-lg mb-0.5">{stat.icon}</div>
                      <div className="text-lg font-bold text-white">
                        {stat.value}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    onClick={() => setShowEndDialog(false)}
                    className="flex-1 py-3 rounded-xl bg-[#2A3942] text-white text-sm font-semibold"
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ backgroundColor: '#3A4952' }}
                  >
                    Continue
                  </motion.button>
                  <motion.button
                    onClick={handleEndStream}
                    className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold shadow-lg shadow-red-600/25"
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ boxShadow: '0 0 30px rgba(220,38,38,0.4)' }}
                  >
                    End Stream
                  </motion.button>
                </div>
              </GlassmorphismCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
