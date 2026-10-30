'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWalletStore } from '@/lib/store';

const HILLTOP_ZONE_ID = process.env.NEXT_PUBLIC_HILLTOP_ZONE_ID || '';
const AD_DURATION_SECONDS = 15; // seconds before skip appears
const AD_REWARD_COINS = 50;

interface Props {
  onClose: () => void;
  onRewarded?: (coins: number) => void;
}

export default function AdRewardPlayer({ onClose, onRewarded }: Props) {
  const { user } = useAuth();
  const { setCoinBalance } = useWalletStore();
  const [secondsLeft, setSecondsLeft] = useState(AD_DURATION_SECONDS);
  const [canSkip, setCanSkip] = useState(false);
  const [earning, setEarning] = useState(false);
  const [earned, setEarned] = useState(false);
  const [error, setError] = useState('');
  const adContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setCanSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Inject HilltopAds script when the component mounts
  useEffect(() => {
    if (!HILLTOP_ZONE_ID || !adContainerRef.current) return;
    const script = document.createElement('script');
    script.src = `https://js.wpadmngr.com/static/adManager.js`;
    script.setAttribute('data-admpid', HILLTOP_ZONE_ID);
    script.async = true;
    adContainerRef.current.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  const handleSkipAndEarn = useCallback(async () => {
    if (!canSkip || earning || earned || !user) return;
    setEarning(true);
    setError('');
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, type: 'ad_reward' }),
      });
      const data = await res.json();
      if (data.success) {
        setCoinBalance(data.balance);
        setEarned(true);
        onRewarded?.(data.coins);
        setTimeout(onClose, 1500);
      } else {
        setError(data.message || 'Could not grant reward. Try again.');
      }
    } catch {
      setError('Network error. Your coins were not granted.');
    } finally {
      setEarning(false);
    }
  }, [canSkip, earning, earned, user, setCoinBalance, onRewarded, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col bg-black"
      >
        {/* Ad container */}
        <div className="flex-1 relative flex items-center justify-center" ref={adContainerRef}>
          {/* Placeholder shown when no real ad loads */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#111B21] to-[#0B141A]">
            <div className="text-center px-6">
              <div className="text-4xl mb-4">🎬</div>
              <p className="text-white/60 text-sm">Ad is loading…</p>
              <p className="text-white/30 text-xs mt-1">Watch to earn {AD_REWARD_COINS} coins</p>
            </div>
          </div>

          {/* Countdown badge */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-black/70 rounded-full px-3 py-1.5">
            <Coins className="w-3.5 h-3.5 text-[#FFD700]" />
            <span className="text-white text-xs font-semibold">+{AD_REWARD_COINS}</span>
            {!canSkip && (
              <span className="text-white/50 text-xs ml-1">{secondsLeft}s</span>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-[#111B21] px-4 py-4 flex items-center justify-between">
          {error ? (
            <p className="text-red-400 text-xs flex-1">{error}</p>
          ) : earned ? (
            <p className="text-[#25D366] text-sm font-semibold flex-1">+{AD_REWARD_COINS} coins earned! 🎉</p>
          ) : (
            <p className="text-white/50 text-xs flex-1">
              {canSkip ? 'You can now collect your reward' : `Watch for ${secondsLeft}s to earn coins`}
            </p>
          )}

          {canSkip && !earned ? (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSkipAndEarn}
              disabled={earning}
              className="ml-3 px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
              style={{ background: '#25D366', color: '#0B141A' }}
            >
              {earning ? 'Claiming…' : `Collect +${AD_REWARD_COINS} coins`}
            </motion.button>
          ) : !earned && (
            <button
              onClick={onClose}
              className="ml-3 p-2 rounded-full bg-white/10 text-white/50"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
