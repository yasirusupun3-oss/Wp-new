'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { CoinIcon } from '@/components/three/CoinIcon';
import { GlassmorphismCard } from '@/components/three/GlassmorphismCard';

export interface GiftItem {
  id: string;
  emoji: string;
  name: string;
  cost: number;
}

interface GiftPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendGift: (gift: GiftItem) => void;
  coinBalance: number;
}

const gifts: GiftItem[] = [
  { id: 'rose', emoji: '🌹', name: 'Rose', cost: 10 },
  { id: 'heart', emoji: '❤️', name: 'Heart', cost: 25 },
  { id: 'giftbox', emoji: '🎁', name: 'Gift Box', cost: 50 },
  { id: 'star', emoji: '⭐', name: 'Star', cost: 75 },
  { id: 'diamond', emoji: '💎', name: 'Diamond', cost: 100 },
  { id: 'rocket', emoji: '🚀', name: 'Rocket', cost: 500 },
  { id: 'crown', emoji: '👑', name: 'Crown', cost: 1000 },
  { id: 'trophy', emoji: '🏆', name: 'Trophy', cost: 5000 },
];

// ─── Gift Card ────────────────────────────────────────
function GiftCard({
  gift,
  disabled,
  isSelected,
  onSelect,
  onConfirm,
}: {
  gift: GiftItem;
  disabled: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.button
      className="relative flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
      style={{
        background: disabled
          ? 'rgba(255,255,255,0.02)'
          : isSelected
            ? 'rgba(255,215,0,0.15)'
            : 'rgba(255,255,255,0.06)',
        border: isSelected
          ? '1.5px solid rgba(255,215,0,0.5)'
          : '1.5px solid rgba(255,255,255,0.08)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={disabled ? undefined : isSelected ? onConfirm : onSelect}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      disabled={disabled}
    >
      {/* Glow effect when selected */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 rounded-2xl"
            style={{
              boxShadow: '0 0 20px rgba(255,215,0,0.3), 0 0 40px rgba(255,215,0,0.1)',
            }}
          />
        )}
      </AnimatePresence>

      <motion.span
        className="text-3xl relative z-10"
        animate={isSelected ? { scale: [1, 1.3, 1.2], rotate: [0, -5, 5, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {gift.emoji}
      </motion.span>
      <span className="text-[11px] font-medium relative z-10" style={{ color: '#E9EDEF' }}>
        {gift.name}
      </span>
      <div className="flex items-center gap-1 relative z-10">
        <CoinIcon size={12} />
        <span className="text-[10px] font-semibold" style={{ color: '#FFD700' }}>
          {gift.cost}
        </span>
      </div>

      {/* Confirm indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center gap-1 mt-0.5"
          >
            <Send className="w-3 h-3" style={{ color: '#25D366' }} />
            <span className="text-[9px] font-semibold" style={{ color: '#25D366' }}>Tap to send</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ─── Main Panel ───────────────────────────────────────
export default function GiftPanel({ isOpen, onClose, onSendGift, coinBalance }: GiftPanelProps) {
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);

  const handleSelect = (gift: GiftItem) => {
    setSelectedGift(gift);
  };

  const handleConfirm = () => {
    if (selectedGift) {
      onSendGift(selectedGift);
      setSelectedGift(null);
      onClose();
    }
  };

  const handleBackdrop = () => {
    setSelectedGift(null);
    onClose();
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
            onClick={handleBackdrop}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl max-h-[75vh] overflow-hidden"
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
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold" style={{ color: '#E9EDEF' }}>Send a Gift</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'rgba(255,215,0,0.1)' }}>
                  <CoinIcon size={16} />
                  <span className="text-sm font-bold" style={{ color: '#FFD700' }}>
                    {coinBalance.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={handleBackdrop}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <X className="w-4 h-4" style={{ color: '#8696A0' }} />
                </button>
              </div>
            </div>

            {/* Gift Grid */}
            <div className="px-5 pb-8 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-4 gap-2.5">
                {gifts.map((gift) => (
                  <GiftCard
                    key={gift.id}
                    gift={gift}
                    disabled={coinBalance < gift.cost}
                    isSelected={selectedGift?.id === gift.id}
                    onSelect={() => handleSelect(gift)}
                    onConfirm={handleConfirm}
                  />
                ))}
              </div>

              {/* Selected gift detail */}
              <AnimatePresence>
                {selectedGift && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 overflow-hidden"
                  >
                    <GlassmorphismCard
                      className="flex items-center justify-between"
                      style={{ background: 'rgba(255,215,0,0.06)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{selectedGift.emoji}</span>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#E9EDEF' }}>
                            {selectedGift.name}
                          </p>
                          <div className="flex items-center gap-1">
                            <CoinIcon size={12} />
                            <span className="text-xs" style={{ color: '#FFD700' }}>
                              {selectedGift.cost} coins
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleConfirm}
                        className="px-5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #25D366, #128C7E)',
                          color: '#fff',
                        }}
                      >
                        Send
                      </button>
                    </GlassmorphismCard>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
