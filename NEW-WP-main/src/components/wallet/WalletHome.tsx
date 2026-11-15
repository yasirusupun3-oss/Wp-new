'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Gift, ArrowDownLeft, TrendingUp, TrendingDown, ChevronRight, Loader2, Play } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loadAdState } from '@/lib/adState';
import { CoinIcon } from '@/components/three/CoinIcon';
import { GlassmorphismCard } from '@/components/three/GlassmorphismCard';
import { useWalletStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import WithdrawForm from '@/components/wallet/WithdrawForm';

const AdRewardOverlay = dynamic(() => import('@/components/ads/AdRewardOverlay'), { ssr: false });

const coinPackages = [
  { id: 'pkg1', coins: 100, price: 0.99, bonus: 0, badge: null },
  { id: 'pkg2', coins: 500, price: 3.99, bonus: 0, badge: null },
  { id: 'pkg3', coins: 1000, price: 6.99, bonus: 50, badge: 'Popular' },
  { id: 'pkg4', coins: 5000, price: 29.99, bonus: 500, badge: null },
  { id: 'pkg5', coins: 10000, price: 49.99, bonus: 1500, badge: 'Best Value' },
];

// Maps a Firestore coinTransactions "type" to an emoji + friendly label,
// since the raw type strings (gift_sent, ad_reward, ...) aren't meant for
// display as-is.
const TX_ICONS: Record<string, string> = {
  purchase: '💳',
  gift_sent: '🎁',
  gift_received: '🪙',
  withdrawal: '💸',
  ad_reward: '📺',
  daily_bonus: '🎉',
  message_deduct: '💬',
  call_billing: '📞',
};

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  time: string;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString();
}

// ─── Animated Counter ─────────────────────────────────
function AnimatedCounter({ target, duration = 1.5 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let rafId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return <>{count.toLocaleString()}</>;
}

// ─── Main Component ───────────────────────────────────
export default function WalletHome() {
  const { coinBalance } = useWalletStore();
  const displayBalance = coinBalance;
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adsWatchedToday, setAdsWatchedToday] = useState(0);
  useEffect(() => {
    // Optimistic UI count from the shared local cache — the real daily
    // cap is enforced server-side regardless (see /api/coins/ad-reward).
    setAdsWatchedToday(loadAdState().adsWatchedToday);
  }, []);
  const MAX_ADS = 10;
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const { user } = useAuth();

  const [purchaseError, setPurchaseError] = useState('');

  // ─── Real transactions + stats (from Firestore, per signed-in user) ────
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState({ totalEarned: 0, totalSpent: 0, giftsSent: 0 });

  useEffect(() => {
    if (!user?.uid) {
      setTransactions([]);
      setStats({ totalEarned: 0, totalSpent: 0, giftsSent: 0 });
      return;
    }
    const q = query(
      collection(db, 'coinTransactions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      let totalEarned = 0;
      let totalSpent = 0;
      let giftsSent = 0;
      const txs: WalletTransaction[] = snap.docs.map((d) => {
        const data = d.data();
        const amount = typeof data.amount === 'number' ? data.amount : 0;
        if (amount >= 0) totalEarned += amount;
        else totalSpent += Math.abs(amount);
        if (data.type === 'gift_sent') giftsSent += 1;
        const createdAt: Date = data.createdAt?.toDate?.() || new Date();
        return {
          id: d.id,
          type: data.type || 'other',
          amount,
          description: data.description || 'Transaction',
          time: formatRelativeTime(createdAt),
        };
      });
      setTransactions(txs);
      setStats({ totalEarned, totalSpent, giftsSent });
    }, () => {
      // Non-fatal — leave the wallet screen usable even if this listener fails.
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const handleBuyPackage = async (pkgId: string) => {
    if (purchasingId) return;
    setPurchasingId(pkgId);
    setPurchaseError('');

    // Open the tab synchronously, in direct response to the click — mobile
    // browsers block window.open() called after an `await`, since by then
    // it's no longer considered part of the original user gesture. We
    // point it at the real payment URL once the fetch below resolves.
    const paymentTab = window.open('', '_blank', 'noopener,noreferrer');

    try {
      const res = await fetch('/api/oxapay/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'guest',
          coinPackageId: pkgId,
        }),
      });
      const data = await res.json();
      if (data.success && data.paymentUrl) {
        if (paymentTab) {
          paymentTab.location.href = data.paymentUrl;
        } else {
          // Popup was blocked despite our best effort — fall back to a
          // same-tab redirect so the purchase can still go through.
          window.location.href = data.paymentUrl;
        }
      } else {
        paymentTab?.close();
        setPurchaseError(data.error || 'Could not start payment. Please try again.');
      }
    } catch {
      paymentTab?.close();
      setPurchaseError('Network error — please check your connection and try again.');
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div className="min-h-screen pb-24 px-4 pt-4" style={{ background: '#111B21' }}>
      {/* ── Balance Section ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-3xl p-6 mb-6 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #075E54 0%, #128C7E 50%, #075E54 100%)',
          boxShadow: '0 8px 32px rgba(7,94,84,0.4)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10" style={{ background: '#25D366' }} />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-10" style={{ background: '#FFD700' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Your Balance</p>
          </div>

          <div className="flex items-center gap-4">
            <CoinIcon size={48} />
            <div>
              {/* Green shimmer behind number */}
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-lg animate-pulse"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(37,211,102,0.3) 0%, transparent 70%)',
                    filter: 'blur(8px)',
                    transform: 'scale(2)',
                  }}
                />
                <motion.span
                  className="relative text-4xl font-bold"
                  style={{ color: '#FFFFFF' }}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                >
                  <AnimatedCounter target={displayBalance} />
                </motion.span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>coins</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Quick Actions ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <GlassmorphismCard className="flex flex-col items-center gap-2 py-5" onClick={() => {}}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(37,211,102,0.15)' }}>
            <Plus className="w-5 h-5" style={{ color: '#25D366' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: '#E9EDEF' }}>Buy Coins</span>
        </GlassmorphismCard>

        <GlassmorphismCard className="flex flex-col items-center gap-2 py-5" onClick={() => setShowWithdraw(true)}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(128,93,226,0.15)' }}>
            <ArrowDownLeft className="w-5 h-5" style={{ color: '#805DE2' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: '#E9EDEF' }}>Withdraw</span>
        </GlassmorphismCard>

        {/* Free Coins — watch videos, earn 50 coins each, up to 10/day */}
        <GlassmorphismCard
          className="flex flex-col items-center gap-2 py-5 col-span-2"
          onClick={() => setShowAd(true)}
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,165,0,0.15)' }}>
            <Play className="w-5 h-5" style={{ color: '#FFA500' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: '#E9EDEF' }}>Free Coins — Watch Videos</span>
          <span className="text-[10px]" style={{ color: adsWatchedToday >= MAX_ADS ? '#EA4335' : '#8696A0' }}>
            {adsWatchedToday}/{MAX_ADS} today
          </span>
        </GlassmorphismCard>
      </motion.div>

      {/* ── Coin Packages ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-6"
      >
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#E9EDEF' }}>Coin Packages</h2>
        {purchaseError && (
          <div
            className="mb-3 px-3 py-2.5 rounded-lg text-sm"
            style={{ background: 'rgba(220, 38, 38, 0.12)', border: '1px solid rgba(220, 38, 38, 0.3)', color: '#FCA5A5' }}
          >
            {purchaseError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {coinPackages.map((pkg, index) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.08 }}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                border: pkg.badge
                  ? '1.5px solid rgba(255,215,0,0.4)'
                  : '1.5px solid rgba(255,215,0,0.15)',
                boxShadow: pkg.badge
                  ? '0 4px 20px rgba(255,215,0,0.1)'
                  : '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              {/* Badge */}
              {pkg.badge && (
                <div
                  className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: pkg.badge === 'Best Value'
                      ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                      : 'linear-gradient(135deg, #25D366, #128C7E)',
                    color: pkg.badge === 'Best Value' ? '#7B5B00' : '#fff',
                  }}
                >
                  {pkg.badge}
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <CoinIcon size={28} />
                <div>
                  <p className="text-lg font-bold" style={{ color: '#FFD700' }}>
                    {pkg.coins.toLocaleString()}
                  </p>
                  {pkg.bonus > 0 && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(37,211,102,0.2)', color: '#25D366' }}
                    >
                      +{pkg.bonus} bonus
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs mb-3" style={{ color: '#8696A0' }}>
                ${(pkg.price).toFixed(2)}
              </p>

              <button
                onClick={() => handleBuyPackage(pkg.id)}
                disabled={purchasingId === pkg.id}
                className="w-full py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-70"
                style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  color: '#7B5B00',
                }}
              >
                {purchasingId === pkg.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Buy'
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Recent Transactions ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: '#E9EDEF' }}>Recent Transactions</h2>
          <button className="text-xs font-medium flex items-center gap-1" style={{ color: '#25D366' }}>
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <GlassmorphismCard noPadding>
          <div className="max-h-96 overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm" style={{ color: '#8696A0' }}>No transactions yet</p>
              </div>
            ) : (
              transactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + index * 0.03 }}
                  className="flex items-center gap-3 px-4 py-3 transition-colors"
                  style={{
                    borderBottom: index < transactions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    {TX_ICONS[tx.type] || '🪙'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#E9EDEF' }}>
                      {tx.description}
                    </p>
                    <p className="text-[11px]" style={{ color: '#8696A0' }}>{tx.time}</p>
                  </div>
                  <span
                    className="text-sm font-bold flex items-center gap-1"
                    style={{ color: tx.amount >= 0 ? '#25D366' : '#EA4335' }}
                  >
                    {tx.amount > 0 ? (
                      <>
                        <TrendingUp className="w-3.5 h-3.5" />+{tx.amount.toLocaleString()}
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-3.5 h-3.5" />{tx.amount.toLocaleString()}
                      </>
                    )}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </GlassmorphismCard>
      </motion.div>

      {/* ── Stats Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mb-8"
      >
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#E9EDEF' }}>Stats</h2>
        <div className="grid grid-cols-3 gap-3">
          <GlassmorphismCard className="text-center py-4">
            <TrendingUp className="w-5 h-5 mx-auto mb-1.5" style={{ color: '#25D366' }} />
            <p className="text-sm font-bold" style={{ color: '#E9EDEF' }}>
              {stats.totalEarned.toLocaleString()}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#8696A0' }}>Total Earned</p>
          </GlassmorphismCard>

          <GlassmorphismCard className="text-center py-4">
            <TrendingDown className="w-5 h-5 mx-auto mb-1.5" style={{ color: '#EA4335' }} />
            <p className="text-sm font-bold" style={{ color: '#E9EDEF' }}>
              {stats.totalSpent.toLocaleString()}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#8696A0' }}>Total Spent</p>
          </GlassmorphismCard>

          <GlassmorphismCard className="text-center py-4">
            <Gift className="w-5 h-5 mx-auto mb-1.5" style={{ color: '#FFD700' }} />
            <p className="text-sm font-bold" style={{ color: '#E9EDEF' }}>
              {stats.giftsSent}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#8696A0' }}>Gifts Sent</p>
          </GlassmorphismCard>
        </div>
      </motion.div>

      {/* ── Withdraw Panel ── */}
      <WithdrawForm
        isOpen={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        coinBalance={displayBalance}
      />

      {/* ── Free Coins (real VAST video ads) ── */}
      {showAd && (
        <AdRewardOverlay
          onClose={() => {
            setShowAd(false);
            setAdsWatchedToday(loadAdState().adsWatchedToday);
          }}
        />
      )}
    </div>
  );
}
