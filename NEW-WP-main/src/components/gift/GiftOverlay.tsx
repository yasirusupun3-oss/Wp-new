'use client';

import { useCallback, useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Sparkles, Zap, Crown } from 'lucide-react';
import type { GiftEvent } from '@/contexts/GiftContext';

// ─── Types ──────────────────────────────────────────────
interface GiftOverlayProps {
  gifts: GiftEvent[];
  onDismiss: (id: string) => void;
}

// ─── 3D Framer Motion Variants ─────────────────────────
const overlayVariants = {
  hidden: {
    opacity: 0,
    scale: 0.2,
    rotateX: -60,
    rotateY: 25,
    z: -200,
  },
  enter: {
    opacity: 1,
    scale: 1,
    rotateX: 0,
    rotateY: 0,
    z: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 18,
      mass: 0.8,
    },
  },
  bounce: {
    opacity: 1,
    scale: [1, 1.15, 0.95, 1.05, 1],
    rotateX: [0, -3, 2, -1, 0],
    z: [0, 30, -10, 5, 0],
    transition: {
      duration: 0.7,
      ease: 'easeInOut' as const,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.6,
    rotateX: 30,
    rotateY: -20,
    y: -60,
    z: -150,
    transition: {
      duration: 0.5,
      ease: 'easeIn' as const,
    },
  },
};

const particleContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.15 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
};

const particleVariants = {
  hidden: { opacity: 0, scale: 0, x: 0, y: 0 },
  visible: (angle: number) => ({
    opacity: [0, 1, 1, 0],
    scale: [0, 1.5, 1, 0],
    x: Math.cos(angle) * (40 + Math.random() * 50),
    y: Math.sin(angle) * (40 + Math.random() * 50),
    rotate: [0, (Math.random() - 0.5) * 360],
    transition: {
      duration: 1.2 + Math.random() * 0.5,
      ease: 'easeOut' as const,
    },
  }),
};

// ─── Color mapping per animation type ──────────────────
const ANIMATION_COLORS: Record<string, { primary: string; glow: string; gradient: string[] }> = {
  float: {
    primary: 'rgba(255, 105, 180, 1)',
    glow: 'rgba(255, 105, 180, 0.4)',
    gradient: ['rgba(255, 105, 180, 0.2)', 'rgba(255, 215, 0, 0.1)'],
  },
  burst: {
    primary: 'rgba(255, 215, 0, 1)',
    glow: 'rgba(255, 215, 0, 0.5)',
    gradient: ['rgba(255, 215, 0, 0.2)', 'rgba(255, 165, 0, 0.1)'],
  },
  rain: {
    primary: 'rgba(139, 92, 246, 1)',
    glow: 'rgba(139, 92, 246, 0.4)',
    gradient: ['rgba(139, 92, 246, 0.2)', 'rgba(236, 72, 153, 0.1)'],
  },
  spiral: {
    primary: 'rgba(16, 185, 129, 1)',
    glow: 'rgba(16, 185, 129, 0.5)',
    gradient: ['rgba(16, 185, 129, 0.2)', 'rgba(59, 130, 246, 0.1)'],
  },
};

// ─── Particle Component ─────────────────────────────────
function GiftParticles({ animation, color }: { animation: string; color: string }) {
  const particles = useMemo(() => {
    const count = animation === 'burst' ? 12 : animation === 'spiral' ? 8 : 6;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return { id: i, angle };
    });
  }, [animation]);

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      variants={particleContainerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 6px ${color}`,
            marginLeft: -4,
            marginTop: -4,
          }}
          custom={p.angle}
          variants={particleVariants}
        />
      ))}
    </motion.div>
  );
}

// ─── Sparkle Ring Component ─────────────────────────────
function SparkleRing({ color }: { color: string }) {
  const sparkles = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        delay: i * 0.12,
        x: 50 + Math.cos((i / 6) * Math.PI * 2) * 48,
        y: 50 + Math.sin((i / 6) * Math.PI * 2) * 48,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none">
      {sparkles.map((s) => (
        <motion.div
          key={s.id}
          className="absolute"
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.2, 0],
            rotate: [0, 180],
          }}
          transition={{
            duration: 1.5,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: 0.5,
            ease: 'easeInOut',
          }}
        >
          <Star
            className="w-3 h-3"
            style={{ color, fill: color }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Single Gift Card ───────────────────────────────────
function GiftCard({
  gift,
  index,
  onDismiss,
}: {
  gift: GiftEvent;
  index: number;
  onDismiss: (id: string) => void;
}) {
  const [phase, setPhase] = useState<'enter' | 'bounce' | 'showing'>('enter');
  const colors = ANIMATION_COLORS[gift.animation] ?? ANIMATION_COLORS.float;

  // Transition from enter → bounce → showing
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('bounce'), 500);
    const t2 = setTimeout(() => setPhase('showing'), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Auto-dismiss fallback (handled by context, but we also listen here)
  useEffect(() => {
    const duration = gift.duration ?? 3500;
    const t = setTimeout(() => onDismiss(gift.id), duration);
    return () => clearTimeout(t);
  }, [gift.id, gift.duration, onDismiss]);

  // High-value gifts get extra glow tiers
  const tier = gift.coinValue >= 1000 ? 'legendary' : gift.coinValue >= 100 ? 'epic' : 'common';
  const tierGlowSize = tier === 'legendary' ? '0 0 40px, 0 0 80px, 0 0 120px' : tier === 'epic' ? '0 0 30px, 0 0 60px' : '0 0 20px';

  const currentVariant = phase === 'enter' ? overlayVariants.enter : phase === 'bounce' ? overlayVariants.bounce : undefined;

  return (
    <motion.div
      layout
      initial="hidden"
      animate={currentVariant ?? 'visible'}
      exit="exit"
      variants={overlayVariants}
      transition={{ delay: index * 0.05 }}
      className="pointer-events-auto cursor-pointer"
      onClick={() => onDismiss(gift.id)}
      style={{ perspective: 800 }}
    >
      <div
        className="relative rounded-3xl p-5 min-w-[240px] max-w-[320px] overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${colors.gradient[0]}, rgba(17, 27, 33, 0.92))`,
          border: `1.5px solid ${colors.primary}33`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: `${tierGlowSize} ${colors.glow}, 0 0 0 1px rgba(255,255,255,0.05)`,
        }}
      >
        {/* ─── Particle effects ──────────────────────── */}
        <GiftParticles animation={gift.animation} color={colors.primary} />
        <SparkleRing color={colors.primary} />

        {/* ─── 3D Gift Icon Container ────────────────── */}
        <div className="flex items-center gap-4 relative z-10">
          {/* Spinning 3D emoji orb */}
          <motion.div
            className="relative flex-shrink-0"
            style={{ perspective: 400 }}
            animate={
              phase === 'showing'
                ? {
                    y: [0, -5, 0],
                    rotateY: [0, 360],
                  }
                : {}
            }
            transition={
              phase === 'showing'
                ? {
                    y: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                    rotateY: { duration: 4, repeat: Infinity, ease: 'linear' },
                  }
                : {}
            }
          >
            {/* Glow ring behind emoji */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
                transform: 'scale(1.8)',
              }}
              animate={phase === 'showing' ? { scale: [1.8, 2.2, 1.8], opacity: [0.6, 1, 0.6] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Glass orb */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center relative"
              style={{
                background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.2) 0%, ${colors.gradient[0]} 100%)`,
                border: `1.5px solid ${colors.primary}55`,
                boxShadow: `inset 0 2px 8px rgba(255,255,255,0.1), inset 0 -2px 8px rgba(0,0,0,0.2)`,
              }}
            >
              <motion.span
                className="text-3xl"
                style={{
                  filter: `drop-shadow(0 2px 8px ${colors.glow})`,
                }}
              >
                {gift.emoji}
              </motion.span>
            </div>
          </motion.div>

          {/* ─── Gift Info ────────────────────────────── */}
          <div className="flex flex-col min-w-0 flex-1">
            {/* Tier badge for legendary/epic */}
            {tier !== 'common' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1 mb-1"
              >
                {tier === 'legendary' && <Crown className="w-3 h-3" style={{ color: '#FFD700', fill: '#FFD700' }} />}
                {tier === 'epic' && <Sparkles className="w-3 h-3" style={{ color: colors.primary, fill: colors.primary }} />}
                <span
                  className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: colors.primary }}
                >
                  {tier}
                </span>
              </motion.div>
            )}

            <motion.span
              className="text-xs truncate"
              style={{ color: '#8696A0' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {gift.senderName}
            </motion.span>

            <motion.p
              className="text-sm font-semibold truncate mt-0.5"
              style={{ color: '#E9EDEF' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Sent a{' '}
              <span style={{ color: colors.primary }}>{gift.giftName}</span>
              {tier === 'legendary' && ' ✨'}
            </motion.p>

            {/* Coin value */}
            <motion.div
              className="flex items-center gap-1.5 mt-1"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Zap className="w-3 h-3" style={{ color: '#FFD700' }} />
              <span className="text-xs font-bold" style={{ color: '#FFD700' }}>
                {gift.coinValue.toLocaleString()} coins
              </span>
            </motion.div>
          </div>
        </div>

        {/* ─── Bottom gradient fade ──────────────────── */}
        <div
          className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
          style={{
            background: `linear-gradient(to top, ${colors.gradient[0]}, transparent)`,
          }}
        />
      </div>
    </motion.div>
  );
}

// ─── Main Overlay Component ─────────────────────────────
export function GiftOverlay({ gifts, onDismiss }: GiftOverlayProps) {
  const handleDismiss = useCallback(
    (id: string) => onDismiss(id),
    [onDismiss],
  );

  // Position based on context of the most recent gift
  const context = gifts.length > 0 ? gifts[gifts.length - 1].context : 'chat';
  const positionClass =
    context === 'live'
      ? 'top-1/3 right-4'
      : context === 'video-call'
        ? 'top-20 right-4'
        : 'bottom-28 right-4';

  return (
    <div
      className={`fixed z-[100] flex flex-col items-end gap-3 pointer-events-none ${positionClass}`}
    >
      <AnimatePresence mode="popLayout">
        {gifts.map((gift, index) => (
          <GiftCard
            key={gift.id}
            gift={gift}
            index={index}
            onDismiss={handleDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
