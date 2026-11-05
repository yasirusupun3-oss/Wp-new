'use client';

import { motion } from 'framer-motion';

interface ChatBubbleProps {
  text: string;
  sent: boolean;
  time: string;
  isGift?: boolean;
  giftEmoji?: string;
  giftValue?: number;
}

export default function ChatBubble({
  text,
  sent,
  time,
  isGift,
  giftEmoji,
  giftValue,
}: ChatBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: sent ? 30 : -30 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
        mass: 0.8,
      }}
      className={`flex ${sent ? 'justify-end' : 'justify-start'} mb-2 px-3`}
    >
      <div
        className={`relative max-w-[80%] ${
          sent ? 'order-2' : 'order-1'
        }`}
        style={{ perspective: '800px' }}
      >
        {/* Tail / arrow */}
        <div
          className={`absolute top-0 w-0 h-0 ${
            sent
              ? '-right-2 border-t-[8px] border-t-transparent border-l-[10px] border-l-[#25D366]/20'
              : '-left-2 border-t-[8px] border-t-transparent border-r-[10px] border-r-white/10'
          }`}
          style={{
            borderTopColor: sent
              ? 'rgba(37, 211, 102, 0.2)'
              : 'rgba(255, 255, 255, 0.08)',
          }}
        />

        {/* Gift message wrapper */}
        {isGift ? (
          <motion.div
            initial={{ rotateY: -15 }}
            animate={{ rotateY: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 152, 0, 0.1))',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              boxShadow: sent
                ? '0 4px 24px rgba(255, 193, 7, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                : '0 4px 24px rgba(255, 193, 7, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="flex items-center gap-3">
              <motion.span
                className="text-4xl"
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {giftEmoji || '🎁'}
              </motion.span>
              <div className="flex-1">
                <p className="text-white/90 text-sm leading-relaxed">{text}</p>
                <p
                  className="text-base font-bold mt-1"
                  style={{
                    background:
                      'linear-gradient(135deg, #FFD700, #FFA000)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  💰 {giftValue || 0} Coins
                </p>
              </div>
            </div>
            <p className="text-[10px] text-white/40 mt-2 text-right">{time}</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ rotateY: sent ? 8 : -8 }}
            animate={{ rotateY: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className={`rounded-2xl px-4 py-2.5 relative overflow-hidden ${
              sent ? 'rounded-tr-sm' : 'rounded-tl-sm'
            }`}
            style={{
              background: sent
                ? 'linear-gradient(135deg, rgba(37, 211, 102, 0.18), rgba(18, 140, 126, 0.12))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: sent
                ? '1px solid rgba(37, 211, 102, 0.25)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: sent
                ? '0 4px 24px rgba(37, 211, 102, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                : '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              transformStyle: 'preserve-3d',
            }}
          >
            <p className="text-white/90 text-[15px] leading-relaxed break-words">
              {text}
            </p>
            <p className="text-[10px] text-white/40 mt-1 text-right">{time}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
