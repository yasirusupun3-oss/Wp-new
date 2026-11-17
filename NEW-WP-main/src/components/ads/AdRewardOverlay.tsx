'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, Play, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWalletStore } from '@/lib/store';
import VastAdPlayer from './VastAdPlayer';
import { AD_COINS, MAX_ADS_PER_DAY, loadAdState, saveAdState, type AdState } from '@/lib/adState';

// Set NEXT_PUBLIC_VAST_AD_TAG_URL in your environment to your ad network's
// VAST tag. Falls back to an empty string (which surfaces as a clear error
// in the UI rather than silently pretending an ad played) if not set.
const VAST_TAG_URL = process.env.NEXT_PUBLIC_VAST_AD_TAG_URL || '';

interface Props {
  /** Pass true when opened automatically right after login, so the daily
   *  login bonus is offered alongside the first video. */
  afterLogin?: boolean;
  onClose: () => void;
}

export default function AdRewardOverlay({ afterLogin, onClose }: Props) {
  const { user } = useAuth();
  const { setCoinBalance } = useWalletStore();

  const [adState, setAdState] = useState<AdState>(loadAdState());
  const [phase, setPhase] = useState<'offer' | 'watching' | 'done' | 'limit' | 'error'>('offer');
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [dailyBonusDone, setDailyBonusDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Claim the daily login bonus (once per ~day â€” enforced server-side too).
  const claimDailyBonus = useCallback(async () => {
    if (!user?.uid || adState.lastDailyBonusDone) return;
    try {
      const res = await fetch('/api/coins/daily-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (data.success) {
        setCoinBalance(data.newBalance);
        setDailyBonusDone(true);
        const updated = { ...adState, lastDailyBonusDone: true };
        setAdState(updated);
        saveAdState(updated);
      }
    } catch {
      /* non-critical â€” the ad reward itself still goes through */
    }
  }, [user, adState, setCoinBalance]);

  const startWatching = useCallback(() => {
    if (adState.adsWatchedToday >= MAX_ADS_PER_DAY) {
      setPhase('limit');
      return;
    }
    if (!VAST_TAG_URL) {
      setErrorMessage('Ads are not configured yet.');
      setPhase('error');
      return;
    }
    setPhase('watching');
  }, [adState.adsWatchedToday]);

  // Called only once the real ad video has actually finished playing â€”
  // VastAdPlayer has no skip button, so this is a genuine "watched it".
  const handleAdComplete = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch('/api/coins/ad-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (data.success) {
        setCoinBalance(data.newBalance);
        setCoinsEarned(AD_COINS);
      } else if (data.error === 'Daily ad limit reached') {
        setPhase('limit');
        return;
      }
    } catch {
      /* non-critical â€” still show the success screen; balance will
         reconcile next time the profile is fetched */
    }

    const updated: AdState = { ...adState, adsWatchedToday: adState.adsWatchedToday + 1 };
    setAdState(updated);
    saveAdState(updated);
    setPhase('done');

    if (!adState.lastDailyBonusDone) {
      await claimDailyBonus();
    }
  }, [user, adState, setCoinBalance, claimDailyBonus]);

  const handleAdError = useCallback((reason: string) => {
    setErrorMessage(reason);
    setPhase('error');
  }, []);

  // Auto-claim daily bonus on login even before any ad is watched, so the
  // popup can lead with "you already got today's bonus, want more coins?"
  // when relevant instead of double-offering it.
  useEffect(() => {
    if (afterLogin && !adState.lastDailyBonusDone && user?.uid) {
      claimDailyBonus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterLogin, user?.uid]);

  const adsLeft = MAX_ADS_PER_DAY - adState.adsWatchedToday;
  const videoNumber = adState.adsWatchedToday + 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-[#0B141A] flex flex-col w-full max-w-lg mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            {phase === 'watching' ? (
              <span className="w-5 h-5" /> // keep header height stable, no back/close mid-ad
            ) : (
              <button onClick={onClose} className="text-white/60">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <Gift className="w-4.5 h-4.5 text-[#FFD700]" />
            <span className="text-white text-sm font-semibold">Free Coins</span>
          </div>
          {phase === 'watching' ? (
            <span className="text-white/40 text-xs">Video {Math.min(videoNumber, MAX_ADS_PER_DAY)} of {MAX_ADS_PER_DAY}</span>
          ) : (
            <button onClick={onClose} className="text-white/40 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* OFFER */}
          {phase === 'offer' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)' }}
              >
                <span className="text-2xl">ðŸŽ</span>
              </div>
              <div className="text-center">
                {afterLogin && !dailyBonusDone && !adState.lastDailyBonusDone ? (
                  <p className="text-white font-semibold">Daily Login â€” Free Coins!</p>
                ) : (
                  <p className="text-white font-semibold">Watch videos, earn coins</p>
                )}
                <p className="text-white/50 text-xs mt-1">Earn {AD_COINS} coins per video</p>
                {adsLeft > 0 ? (
                  <p className="text-[#25D366] text-xs mt-0.5">{adsLeft} of {MAX_ADS_PER_DAY} videos left today</p>
                ) : (
                  <p className="text-red-400 text-xs mt-0.5">No more videos available today</p>
                )}
              </div>
              <button
                onClick={startWatching}
                disabled={adsLeft === 0}
                className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#000' }}
              >
                <Play className="w-4 h-4 inline mr-1.5" />
                Watch Video ({adsLeft}/{MAX_ADS_PER_DAY} left)
              </button>
              <button onClick={onClose} className="text-white/30 text-xs">Skip for now</button>
            </div>
          )}

          {/* WATCHING â€” real VAST ad, no skip until it actually ends */}
          {phase === 'watching' && (
            <div className="flex-1">
              <VastAdPlayer
                vastTagUrl={VAST_TAG_URL}
                onComplete={handleAdComplete}
                onError={handleAdError}
              />
            </div>
          )}

          {/* DONE */}
          {phase === 'done' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}
              >
                <span className="text-2xl">âœ…</span>
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">+{coinsEarned} coins earned!</p>
                {dailyBonusDone && (
                  <p className="text-[#FFD700] text-xs mt-0.5">+100 daily login bonus!</p>
                )}
                <p className="text-white/40 text-xs mt-1">
                  {MAX_ADS_PER_DAY - adState.adsWatchedToday} more videos available today
                </p>
              </div>
              <div className="flex gap-3 w-full">
                {adState.adsWatchedToday < MAX_ADS_PER_DAY && (
                  <button
                    onClick={startWatching}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#000' }}
                  >
                    Watch Another
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-white text-sm font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* LIMIT */}
          {phase === 'limit' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <span className="text-4xl">â°</span>
              <div className="text-center">
                <p className="text-white font-semibold">Daily limit reached</p>
                <p className="text-white/40 text-xs mt-1">
                  You've watched {MAX_ADS_PER_DAY} videos today. Come back tomorrow!
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white/5 text-white text-sm font-semibold"
              >
                Close
              </button>
            </div>
          )}

          {/* ERROR */}
          {phase === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <span className="text-4xl">âš ï¸</span>
              <div className="text-center">
                <p className="text-white font-semibold">Couldn't load the video</p>
                <p className="text-white/40 text-xs mt-1">{errorMessage || 'Please try again in a moment.'}</p>
              </div>
              <button
                onClick={() => setPhase('offer')}
                className="w-full py-2.5 rounded-xl bg-white/5 text-white text-sm font-semibold"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
