'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassmorphismCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'teal' | 'dark';
  hover?: boolean;
  glow?: boolean;
  glowColor?: string;
  noPadding?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const variantStyles = {
  default: {
    bg: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.12)',
    glow: 'rgba(255, 255, 255, 0.05)',
  },
  teal: {
    bg: 'rgba(0, 168, 132, 0.12)',
    border: 'rgba(0, 168, 132, 0.25)',
    glow: 'rgba(0, 168, 132, 0.1)',
  },
  dark: {
    bg: 'rgba(0, 0, 0, 0.25)',
    border: 'rgba(255, 255, 255, 0.06)',
    glow: 'rgba(0, 0, 0, 0.2)',
  },
};

export function GlassmorphismCard({
  children,
  className = '',
  variant = 'default',
  hover = true,
  glow = false,
  glowColor,
  noPadding = false,
  style,
  onClick,
}: GlassmorphismCardProps) {
  const styleConfig = variantStyles[variant];
  const resolvedGlowColor = glowColor || styleConfig.glow;

  return (
    <motion.div
      className={cn('relative rounded-2xl overflow-hidden', noPadding ? '' : '', className)}
      style={{
        background: style?.background || styleConfig.bg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: style?.border || `1px solid ${styleConfig.border}`,
        boxShadow: glow
          ? `0 0 24px ${resolvedGlowColor}`
          : style?.boxShadow
            ? style.boxShadow
            : undefined,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
        background: style?.background || styleConfig.bg,
      }}
      whileHover={
        hover
          ? {
              y: -4,
              boxShadow: `0 8px 32px ${resolvedGlowColor}, 0 0 0 1px ${styleConfig.border}`,
            }
          : undefined
      }
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Animated border gradient effect */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: `conic-gradient(from var(--angle, 0deg), transparent 60%, ${styleConfig.border} 80%, transparent 100%)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1px',
          borderRadius: '1rem',
        }}
        animate={{
          '--angle': [0, 360],
        } as any}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

export default GlassmorphismCard;
