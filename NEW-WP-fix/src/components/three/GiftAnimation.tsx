'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export interface GiftItem {
  id: string;
  emoji: string;
  senderName?: string;
  name?: string;
  coinValue?: number;
  cost?: number;
  sender?: string;
  timestamp?: number;
}

interface GiftAnimationProps {
  gifts: GiftItem[];
  position?: 'left' | 'right';
}

export function GiftAnimation({ gifts, position = 'right' }: GiftAnimationProps) {
  const [visibleGifts, setVisibleGifts] = useState<GiftItem[]>([]);
  const prevLengthRef = useRef(gifts.length);

  useEffect(() => {
    if (gifts.length > prevLengthRef.current) {
      // New gifts were added - process only the new ones
      const newGifts = gifts.slice(prevLengthRef.current);
      for (const gift of newGifts) {
        setVisibleGifts((prev) => [...prev.slice(-3), gift]);
        const giftId = gift.id;
        const timer = setTimeout(() => {
          setVisibleGifts((prev) => prev.filter((g) => g.id !== giftId));
        }, 3000);
        // Store timeout cleanup isn't easily possible here without more complex logic
        // but the auto-removal after 3s still works
      }
    }
    prevLengthRef.current = gifts.length;
  }, [gifts.length]);

  const isRight = position === 'right';

  return (
    <div
      className={`fixed bottom-24 z-50 flex flex-col-reverse items-end gap-2 pointer-events-none ${
        isRight ? 'right-3' : 'left-3'
      }`}
    >
      <AnimatePresence>
        {visibleGifts.map((gift, index) => {
          const senderLabel = gift.senderName || gift.sender || 'Someone';
          const coinLabel = gift.coinValue || gift.cost || 0;

          return (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, x: isRight ? 100 : -100, y: 50, scale: 0.3, rotateZ: isRight ? -15 : 15 }}
              animate={{
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
                rotateZ: 0,
              }}
              exit={{
                opacity: 0,
                y: -30,
                scale: 0.8,
                transition: { duration: 0.5 },
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
                delay: index * 0.05,
              }}
              className="pointer-events-auto"
            >
              <div
                className="glass-teal rounded-2xl p-3 flex items-center gap-3 min-w-[200px] max-w-[280px]"
                style={{
                  boxShadow:
                    '0 4px 24px rgba(255, 215, 0, 0.15), 0 0 0 1px rgba(255, 215, 0, 0.2)',
                }}
              >
                {/* Large emoji */}
                <motion.div
                  className="flex-shrink-0"
                  animate={{
                    y: [0, -6, 0],
                    rotateY: [0, 10, -10, 0],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <span className="text-4xl leading-none">{gift.emoji}</span>
                </motion.div>

                {/* Gift info */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-[#8696A0] truncate">
                    {senderLabel}
                  </span>
                  <span className="text-sm font-semibold text-[#E9EDEF] truncate">
                    sent {gift.emoji}
                  </span>
                  {coinLabel > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-[#FFD700] font-bold">
                        💰 {coinLabel} coins
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default GiftAnimation;
