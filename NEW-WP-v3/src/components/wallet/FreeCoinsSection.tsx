'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Play, CheckCircle2, Clock, Coins, Zap, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWalletStore } from '@/lib/store';
import { loadAdState, saveAdState, todayStr, AD_COINS, MAX_ADS_PER_DAY, type AdState } from '@/lib/adState';
import VastAdPlayer from '@/components/ads/VastAdPlayer';

const VAST_TAG_URL = process.env.NEXT_PUBLIC_VAST_AD_TAG_URL || '';
const DAILY_BONUS = 100;

export default function FreeCoinsSection() {
  const { user } = useAuth();
  const { coinBalance, setCoinBalance } = useWalletStore();

  const [adState, setAdState]           = useState<AdState>(loadAdState());
  const [watchingAd, setWatchingAd]     = useState(false);
  const [adError, setAdError]           = useState('');
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [adClaimed, setAdClaimed]       = useState(false);
  const [earnedCoins, setEarnedCoins]   = useState(0);
  const [showReward, setShowReward]     = useState(false);

  // ─── Check daily bonus status from server on mount ───────────────────
  const [bonusAvailable, setBonusAvailable] = useState(false);
  useEffect(() => {
    if (!user?.uid) return;
    fetch(`/api/coins/daily-bonus?userId=${user.uid}`)
      .then(r => r.json())
      .then(d => { if (d.available !== undefined) setBonusAvailable(d.available); })
      .catch(() => setBonusAvailable(!adState.lastDailyBonusDone));
  }, [user?.uid]);

  const adsLeft = MAX_ADS_PER_DAY - adState.adsWatchedToday;

  // ─── Claim Daily Bonus ─────────────────────────────────────────────────
  const handleClaimBonus = useCallback(async () => {
    if (!user?.uid || claimingBonus || bonusClaimed) return;
    setClaimingBonus(true);
    try {
      const res = await fetch('/api/coins/daily-bonus', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (data.success) {
        setCoinBalance(data.newBalance);
        setBonusClaimed(true);
        setBonusAvailable(false);
        setEarnedCoins(DAILY_BONUS);
        setShowReward(true);
        const updated = { ...adState, lastDailyBonusDone: true };
        setAdState(updated); saveAdState(updated);
        setTimeout(() => setShowReward(false), 3000);
      } else if (data.error === 'ALREADY_CLAIMED') {
        setBonusAvailable(false);
      }
    } catch { /* ignore */ }
    finally { setClaimingBonus(false); }
  }, [user?.uid, claimingBonus, bonusClaimed, adState, setCoinBalance]);

  // ─── Watch Ad ──────────────────────────────────────────────────────────
  const handleWatchAd = useCallback(() => {
    if (adsLeft <= 0) return;
    if (!VAST_TAG_URL) { setAdError('Ads not configured yet.'); return; }
    setAdError('');
    setWatchingAd(true);
  }, [adsLeft]);

  const handleAdComplete = useCallback(async () => {
    setWatchingAd(false);
    if (!user?.uid) return;
    try {
      const res = await fetch('/api/coins/ad-reward', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (data.success) {
        setCoinBalance(data.newBalance);
        setAdClaimed(true);
        setEarnedCoins(AD_COINS);
        setShowReward(true);
        const updated = { ...adState, adsWatchedToday: adState.adsWatchedToday + 1, date: todayStr() };
        setAdState(updated); saveAdState(updated);
        setTimeout(() => { setShowReward(false); setAdClaimed(false); }, 3000);
      }
    } catch { setAdError('Failed to claim reward.'); }
  }, [user?.uid, adState, setCoinBalance]);

  const handleAdError = useCallback((msg: string) => {
    setWatchingAd(false);
    setAdError(msg || 'Ad failed to load.');
  }, []);

  const handleAdSkip = useCallback(() => {
    setWatchingAd(false);
    setAdError('You must watch the full ad to earn coins.');
  }, []);

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4" style={{color:'#FFD700'}} />
        <h2 className="text-sm font-semibold" style={{color:'#E9EDEF'}}>Free Coins</h2>
      </div>

      {/* ── Reward Toast ── */}
      <AnimatePresence>
        {showReward && (
          <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
            style={{background:'rgba(37,211,102,0.15)',border:'1px solid rgba(37,211,102,0.3)'}}>
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{color:'#25D366'}} />
            <span className="text-sm font-semibold" style={{color:'#25D366'}}>+{earnedCoins} coins earned! 🎉</span>
          </motion.div>
        )}
      </AnimatePresence>

      {adError && (
        <div className="px-3 py-2 rounded-xl mb-3 text-xs" style={{background:'rgba(234,67,53,0.1)',color:'#FCA5A5'}}>
          {adError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">

        {/* ── Daily Login Bonus Card ── */}
        <motion.button whileTap={{scale:0.97}}
          onClick={handleClaimBonus}
          disabled={!bonusAvailable || claimingBonus || bonusClaimed}
          className="relative flex flex-col items-center justify-center gap-2 py-5 px-3 rounded-2xl text-center overflow-hidden disabled:opacity-60"
          style={{background: bonusAvailable && !bonusClaimed
            ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.08))'
            : 'rgba(255,255,255,0.04)',
            border: `1px solid ${bonusAvailable && !bonusClaimed ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.08)'}`}}>

          {/* Glow */}
          {bonusAvailable && !bonusClaimed && (
            <motion.div className="absolute inset-0 rounded-2xl pointer-events-none"
              animate={{opacity:[0.3,0.6,0.3]}} transition={{duration:2,repeat:Infinity}}
              style={{background:'radial-gradient(circle at center,rgba(255,215,0,0.12),transparent 70%)'}} />
          )}

          <div className="w-12 h-12 rounded-full flex items-center justify-center relative z-10"
            style={{background: bonusAvailable && !bonusClaimed
              ? 'linear-gradient(135deg,#FFD700,#FFA500)'
              : 'rgba(255,255,255,0.08)'}}>
            {claimingBonus
              ? <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              : bonusClaimed
                ? <CheckCircle2 className="w-6 h-6 text-white" />
                : <Gift className="w-6 h-6" style={{color: bonusAvailable?'#0B141A':'#8696A0'}} />
            }
          </div>

          <div className="relative z-10">
            <p className="text-xs font-semibold" style={{color: bonusAvailable&&!bonusClaimed?'#FFD700':'#8696A0'}}>
              Daily Bonus
            </p>
            <p className="text-lg font-bold" style={{color:'#E9EDEF'}}>+{DAILY_BONUS}</p>
            <p className="text-[10px]" style={{color:'#8696A0'}}>coins</p>
          </div>

          {!bonusAvailable || bonusClaimed ? (
            <div className="flex items-center gap-1 relative z-10">
              <Clock className="w-3 h-3" style={{color:'#667781'}} />
              <span className="text-[10px]" style={{color:'#667781'}}>
                {bonusClaimed ? 'Claimed!' : 'Already claimed'}
              </span>
            </div>
          ) : (
            <div className="px-3 py-1 rounded-full relative z-10"
              style={{background:'rgba(255,215,0,0.2)',border:'1px solid rgba(255,215,0,0.4)'}}>
              <span className="text-[10px] font-semibold" style={{color:'#FFD700'}}>Claim Now</span>
            </div>
          )}
        </motion.button>

        {/* ── Watch Ad Card ── */}
        <motion.button whileTap={{scale:0.97}}
          onClick={handleWatchAd}
          disabled={adsLeft <= 0}
          className="relative flex flex-col items-center justify-center gap-2 py-5 px-3 rounded-2xl text-center overflow-hidden disabled:opacity-60"
          style={{background: adsLeft > 0
            ? 'linear-gradient(135deg, rgba(37,211,102,0.12), rgba(18,140,126,0.06))'
            : 'rgba(255,255,255,0.04)',
            border: `1px solid ${adsLeft > 0 ? 'rgba(37,211,102,0.3)' : 'rgba(255,255,255,0.08)'}`}}>

          {adsLeft > 0 && (
            <motion.div className="absolute inset-0 rounded-2xl pointer-events-none"
              animate={{opacity:[0.2,0.5,0.2]}} transition={{duration:2.5,repeat:Infinity}}
              style={{background:'radial-gradient(circle at center,rgba(37,211,102,0.1),transparent 70%)'}} />
          )}

          <div className="w-12 h-12 rounded-full flex items-center justify-center relative z-10"
            style={{background: adsLeft > 0
              ? 'linear-gradient(135deg,#25D366,#128C7E)'
              : 'rgba(255,255,255,0.08)'}}>
            <Play className="w-6 h-6" style={{color: adsLeft>0?'#fff':'#8696A0'}} />
          </div>

          <div className="relative z-10">
            <p className="text-xs font-semibold" style={{color: adsLeft>0?'#25D366':'#8696A0'}}>
              Watch Ad
            </p>
            <p className="text-lg font-bold" style={{color:'#E9EDEF'}}>+{AD_COINS}</p>
            <p className="text-[10px]" style={{color:'#8696A0'}}>coins / ad</p>
          </div>

          <div className="flex items-center gap-1.5 relative z-10">
            <Star className="w-3 h-3" style={{color: adsLeft>0?'#25D366':'#667781'}} />
            <span className="text-[10px]" style={{color: adsLeft>0?'#25D366':'#667781'}}>
              {adsLeft > 0 ? `${adsLeft} left today` : 'Limit reached'}
            </span>
          </div>
        </motion.button>
      </div>

      {/* ── Progress Bar ── */}
      {MAX_ADS_PER_DAY > 0 && (
        <div className="mt-3">
          <div className="flex justify-between mb-1">
            <span className="text-[10px]" style={{color:'#8696A0'}}>Ads watched today</span>
            <span className="text-[10px]" style={{color:'#8696A0'}}>{adState.adsWatchedToday}/{MAX_ADS_PER_DAY}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.08)'}}>
            <motion.div className="h-full rounded-full"
              initial={{width:0}}
              animate={{width:`${(adState.adsWatchedToday/MAX_ADS_PER_DAY)*100}%`}}
              style={{background:'linear-gradient(90deg,#25D366,#128C7E)'}} />
          </div>
        </div>
      )}

      {/* ── Ad Player ── */}
      <AnimatePresence>
        {watchingAd && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{background:'rgba(0,0,0,0.9)'}}>
            <div className="w-full max-w-sm mx-4">
              <p className="text-white text-xs text-center mb-3 opacity-60">Watch the full ad to earn {AD_COINS} coins</p>
              <VastAdPlayer
                vastTagUrl={VAST_TAG_URL}
                onComplete={handleAdComplete}
                onError={handleAdError}
                onSkip={handleAdSkip}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
