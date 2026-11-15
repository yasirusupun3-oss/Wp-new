'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Sparkles } from 'lucide-react';
import { romanticGifts, type RomanticGift } from '@/lib/store';
import { useWalletStore } from '@/lib/store';
import { CoinIcon } from '@/components/three/CoinIcon';

interface RomanticGiftPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendGift: (gift: RomanticGift) => void;
  receiverName?: string;
}

// Sparkle particle for selection animation
function SparkleParticle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0], rotate: [0, 180, 360] }}
      transition={{ duration: 1.2, delay, ease: 'easeInOut' }}
    >
      <Sparkles className="w-3 h-3 text-pink-400" />
    </motion.div>
  );
}

// Floating animation for emoji
function FloatingEmoji({ children }: { children: React.ReactNode }) {
  return (
    <motion.span
      className="text-4xl inline-block"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.span>
  );
}

export default function RomanticGiftPanel({
  isOpen,
  onClose,
  onSendGift,
  receiverName = 'them',
}: RomanticGiftPanelProps) {
  const { coinBalance } = useWalletStore();
  const [selectedGift, setSelectedGift] = useState<RomanticGift | null>(null);

  const canAfford = (gift: RomanticGift) => coinBalance >= gift.cost;

  const handleSelect = (gift: RomanticGift) => {
    if (!canAfford(gift)) return;
    setSelectedGift((prev) => (prev?.id === gift.id ? null : gift));
  };

  const handleSend = () => {
    if (selectedGift) {
      onSendGift(selectedGift);
      setSelectedGift(null);
    }
  };

  const handleClose = () => {
    setSelectedGift(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl overflow-hidden"
            style={{
              background: 'rgba(17, 27, 33, 0.95)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderTop: '1px solid rgba(18, 140, 126, 0.3)',
              maxHeight: '85vh',
              boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Heart className="w-5 h-5 text-pink-400 fill-pink-400" />
                </motion.div>
                <div>
                  <h3 className="text-white font-semibold text-base">
                    Send a Gift to {receiverName}
                  </h3>
                  <p className="text-white/40 text-xs mt-0.5">
                    Choose something special ✨
                  </p>
                </div>
              </div>

              {/* Coin balance */}
              <CoinIcon size="sm" balance={coinBalance} className="mr-2" />

              {/* Close button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.85 }}
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white/60" />
              </motion.button>
            </div>

            {/* Divider */}
            <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Gift Grid */}
            <div className="px-4 py-4 overflow-y-auto" style={{ maxHeight: selectedGift ? '35vh' : '45vh' }}>
              <div className="grid grid-cols-3 gap-3">
                {romanticGifts.map((gift) => {
                  const affordable = canAfford(gift);
                  const isSelected = selectedGift?.id === gift.id;

                  return (
                    <motion.button
                      key={gift.id}
                      whileHover={affordable ? { scale: 1.04 } : {}}
                      whileTap={affordable ? { scale: 0.95 } : {}}
                      onClick={() => handleSelect(gift)}
                      disabled={!affordable}
                      className={`relative rounded-2xl p-3 flex flex-col items-center gap-2 transition-all duration-200 ${
                        !affordable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      style={{
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(255, 105, 180, 0.15), rgba(18, 140, 126, 0.15))'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected
                          ? '1.5px solid rgba(255, 105, 180, 0.5)'
                          : '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: isSelected
                          ? '0 0 20px rgba(255, 105, 180, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                          : 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      {/* Sparkle particles on selection */}
                      <AnimatePresence>
                        {isSelected && (
                          <>
                            <SparkleParticle delay={0} x={10} y={10} />
                            <SparkleParticle delay={0.15} x={80} y={5} />
                            <SparkleParticle delay={0.3} x={15} y={80} />
                            <SparkleParticle delay={0.1} x={85} y={75} />
                            <SparkleParticle delay={0.25} x={50} y={0} />
                          </>
                        )}
                      </AnimatePresence>

                      {/* Emoji */}
                      <div className="relative">
                        <FloatingEmoji>{gift.emoji}</FloatingEmoji>
                      </div>

                      {/* Name */}
                      <span className="text-white/80 text-xs font-medium text-center truncate w-full">
                        {gift.name}
                      </span>

                      {/* Cost */}
                      <div className="flex items-center gap-1">
                        <CoinIcon size={14} />
                        <span className="text-[#FFD700] text-[11px] font-semibold">
                          {gift.cost}
                        </span>
                      </div>

                      {/* Can't afford indicator */}
                      {!affordable && (
                        <span className="text-[9px] text-red-400/80 font-medium">
                          Not enough
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Selected Gift Preview & Send */}
            <AnimatePresence>
              {selectedGift && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="mx-5 mb-4 rounded-2xl p-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 105, 180, 0.08), rgba(18, 140, 126, 0.08))',
                      border: '1px solid rgba(255, 105, 180, 0.2)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Large emoji preview */}
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                        className="text-5xl"
                      >
                        {selectedGift.emoji}
                      </motion.div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">
                          {selectedGift.name}
                        </p>
                        <p className="text-white/50 text-xs mt-0.5">
                          {selectedGift.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <CoinIcon size={14} />
                          <span className="text-[#FFD700] text-sm font-bold">
                            {selectedGift.cost} coins
                          </span>
                        </div>
                      </div>

                      {/* Send button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleSend}
                        className="shrink-0 px-5 py-2.5 rounded-full font-semibold text-sm text-white flex items-center gap-2"
                        style={{
                          background: 'linear-gradient(135deg, #FF6B9D, #C850C0, #FF6B9D)',
                          backgroundSize: '200% 200%',
                          boxShadow: '0 4px 20px rgba(255, 107, 157, 0.3)',
                        }}
                      >
                        <motion.span
                          animate={{ y: [0, -2, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          {selectedGift.emoji}
                        </motion.span>
                        Send
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Not enough coins warning bar */}
            {selectedGift && !canAfford(selectedGift) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-5 pb-4"
              >
                <div className="rounded-xl px-4 py-3 text-center"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                  }}
                >
                  <p className="text-red-400 text-sm font-medium">
                    Not enough coins! You need {selectedGift.cost - coinBalance} more.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Bottom safe area */}
            <div className="h-[max(0.5rem,env(safe-area-inset-bottom))]" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
