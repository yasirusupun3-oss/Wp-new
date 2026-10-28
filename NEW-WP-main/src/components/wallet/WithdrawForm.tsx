'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Wallet, ArrowDownLeft, Info } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CoinIcon } from '@/components/three/CoinIcon';
import { GlassmorphismCard } from '@/components/three/GlassmorphismCard';
import { useAuth } from '@/hooks/useAuth';
import { useWalletStore } from '@/lib/store';

interface WithdrawFormProps {
  isOpen: boolean;
  onClose: () => void;
  coinBalance: number;
}

const networks = [
  { id: 'trc20', name: 'TRC20', label: 'Tron', fee: '~1 USDT' },
  { id: 'erc20', name: 'ERC20', label: 'Ethereum', fee: '~5 USDT' },
  { id: 'bep20', name: 'BEP20', label: 'BNB Chain', fee: '~0.5 USDT' },
];

const MIN_WITHDRAWAL = 1000;
const COIN_TO_USD_RATE = 0.005; // 1 coin = $0.005

export default function WithdrawForm({ isOpen, onClose, coinBalance }: WithdrawFormProps) {
  const { user } = useAuth();
  const { setCoinBalance } = useWalletStore();
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('trc20');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Pre-fill from the wallet saved in Settings → Connected Wallets /
  // Withdrawal Settings, if there is one, so the person doesn't have to
  // retype their address every time.
  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      const saved = snap.data()?.withdrawal;
      if (saved?.address) setWalletAddress(saved.address);
      if (saved?.network) setSelectedNetwork(saved.network);
    }).catch(() => {
      /* non-critical — the form still works with manual entry */
    });
  }, [isOpen, user?.uid]);

  const numAmount = parseFloat(amount) || 0;
  const estimatedUSD = numAmount * COIN_TO_USD_RATE;
  const currentNetwork = networks.find((n) => n.id === selectedNetwork)!;

  const isValid = useMemo(() => {
    return (
      numAmount >= MIN_WITHDRAWAL &&
      numAmount <= coinBalance &&
      walletAddress.trim().length > 10
    );
  }, [numAmount, coinBalance, walletAddress]);

  const errors = useMemo(() => {
    const errs: string[] = [];
    if (numAmount > 0 && numAmount < MIN_WITHDRAWAL) {
      errs.push(`Minimum withdrawal is ${MIN_WITHDRAWAL.toLocaleString()} coins`);
    }
    if (numAmount > coinBalance) {
      errs.push('Insufficient coin balance');
    }
    return errs;
  }, [numAmount, coinBalance]);

  const handleWithdraw = async () => {
    if (!isValid || isSubmitting || !user) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/oxapay/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          amount: numAmount,
          walletAddress: walletAddress.trim(),
          network: selectedNetwork,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (typeof data.balanceAfter === 'number') {
          setCoinBalance(data.balanceAfter);
        }
        setAmount('');
        setWalletAddress('');
        alert(data.message || 'Withdrawal request submitted — pending admin approval.');
        onClose();
      } else {
        setSubmitError(data.error || 'Withdrawal failed. Please try again.');
      }
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl max-h-[85vh] overflow-y-auto"
            style={{
              background: 'linear-gradient(180deg, #1F2C34 0%, #111B21 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderBottom: 'none',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(128,93,226,0.15)' }}
                >
                  <ArrowDownLeft className="w-4.5 h-4.5" style={{ color: '#805DE2' }} />
                </div>
                <h3 className="text-base font-semibold" style={{ color: '#E9EDEF' }}>
                  Withdraw Coins
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <X className="w-4 h-4" style={{ color: '#8696A0' }} />
              </button>
            </div>

            <div className="px-5 pb-8">
              {/* Balance indicator */}
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl mb-5"
                style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}
              >
                <CoinIcon size={20} />
                <span className="text-sm" style={{ color: '#8696A0' }}>Available: </span>
                <span className="text-sm font-bold" style={{ color: '#FFD700' }}>
                  {coinBalance.toLocaleString()} coins
                </span>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#8696A0' }}>
                  Withdrawal Amount
                </label>
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: errors.length > 0
                      ? '1.5px solid rgba(234,67,53,0.5)'
                      : amount
                        ? '1.5px solid rgba(37,211,102,0.4)'
                        : '1.5px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Min ${MIN_WITHDRAWAL.toLocaleString()}`}
                    className="flex-1 bg-transparent text-base font-semibold outline-none"
                    style={{ color: '#E9EDEF' }}
                    min={0}
                    max={coinBalance}
                  />
                  <button
                    onClick={() => setAmount(String(coinBalance))}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                    style={{ background: 'rgba(37,211,102,0.15)', color: '#25D366' }}
                  >
                    MAX
                  </button>
                </div>
                {errors.map((err, i) => (
                  <p key={i} className="text-[11px] mt-1" style={{ color: '#EA4335' }}>
                    {err}
                  </p>
                ))}
                {numAmount > 0 && !errors.length && (
                  <p className="text-[11px] mt-1" style={{ color: '#25D366' }}>
                    ≈ ${estimatedUSD.toFixed(2)} USD
                  </p>
                )}
              </div>

              {/* Wallet Address */}
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#8696A0' }}>
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" />
                    Wallet Address
                  </div>
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="Enter your crypto wallet address"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: walletAddress
                      ? '1.5px solid rgba(255,255,255,0.15)'
                      : '1.5px solid rgba(255,255,255,0.08)',
                    color: '#E9EDEF',
                  }}
                />
              </div>

              {/* Network Selection */}
              <div className="mb-5">
                <label className="block text-xs font-medium mb-2" style={{ color: '#8696A0' }}>
                  Network
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {networks.map((network) => (
                    <button
                      key={network.id}
                      onClick={() => setSelectedNetwork(network.id)}
                      className="px-3 py-2.5 rounded-xl text-center transition-all"
                      style={{
                        background: selectedNetwork === network.id
                          ? 'rgba(37,211,102,0.12)'
                          : 'rgba(255,255,255,0.04)',
                        border: selectedNetwork === network.id
                          ? '1.5px solid rgba(37,211,102,0.4)'
                          : '1.5px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <p
                        className="text-xs font-bold"
                        style={{
                          color: selectedNetwork === network.id ? '#25D366' : '#E9EDEF',
                        }}
                      >
                        {network.name}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#8696A0' }}>
                        {network.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee display */}
              <GlassmorphismCard className="flex items-center justify-between mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" style={{ color: '#8696A0' }} />
                  <span className="text-xs" style={{ color: '#8696A0' }}>Network fee</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#E9EDEF' }}>
                  {currentNetwork.fee}
                </span>
              </GlassmorphismCard>

              {/* Summary */}
              {numAmount > 0 && numAmount >= MIN_WITHDRAWAL && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4"
                >
                  <GlassmorphismCard className="space-y-2" style={{ background: 'rgba(37,211,102,0.04)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#8696A0' }}>You send</span>
                      <span className="text-sm font-semibold" style={{ color: '#E9EDEF' }}>
                        {numAmount.toLocaleString()} coins
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#8696A0' }}>You receive</span>
                      <span className="text-sm font-semibold" style={{ color: '#25D366' }}>
                        ≈ ${(estimatedUSD - parseFloat(currentNetwork.fee.replace(/[^0-9.]/g, ''))).toFixed(2)} USDT
                      </span>
                    </div>
                  </GlassmorphismCard>
                </motion.div>
              )}

              {/* Warning */}
              <div
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-5"
                style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.15)' }}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#FFC107' }} />
                <p className="text-[11px] leading-relaxed" style={{ color: '#FFC107' }}>
                  Blockchain transactions are irreversible. Please double-check the wallet address and network before proceeding. Funds sent to the wrong address cannot be recovered.
                </p>
              </div>

              {/* Submit error */}
              {submitError && (
                <div
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-4"
                  style={{ background: 'rgba(234,67,53,0.1)', border: '1px solid rgba(234,67,53,0.25)' }}
                >
                  <p className="text-xs" style={{ color: '#EA4335' }}>{submitError}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleWithdraw}
                disabled={!isValid || isSubmitting}
                className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{
                  background: isValid
                    ? 'linear-gradient(135deg, #805DE2, #6C3FC5)'
                    : 'rgba(255,255,255,0.06)',
                  color: isValid ? '#fff' : '#8696A0',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  `Withdraw ${numAmount.toLocaleString()} Coins`
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
