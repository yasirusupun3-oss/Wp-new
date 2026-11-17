'use client';

import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';

interface LiveButton3DProps {
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LiveButton3D({ onClick, className = '', size = 'md' }: LiveButton3DProps) {
  const sizeMap = {
    sm: { outer: 56, icon: 22, textSize: 'text-[9px]' },
    md: { outer: 80, icon: 28, textSize: 'text-[10px]' },
    lg: { outer: 100, icon: 32, textSize: 'text-sm' },
  };

  const s = sizeMap[size];

  return (
    <div className="perspective-1000 inline-flex flex-col items-center">
      <motion.button
        onClick={onClick}
        className={`
          relative touch-target
          flex items-center justify-center
          rounded-full cursor-pointer
          preserve-3d
          ${className}
        `}
        style={{
          width: s.outer,
          height: s.outer,
          background: 'linear-gradient(135deg, #075E54 0%, #25D366 50%, #128C7E 100%)',
          boxShadow:
            '0 8px 32px rgba(0, 168, 132, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
        }}
        whileHover={{
          scale: 1.08,
          rotateX: -5,
          rotateY: 5,
          boxShadow:
            '0 12px 40px rgba(0, 168, 132, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
        whileTap={{
          scale: 0.95,
          rotateX: 0,
          rotateY: 0,
        }}
        animate={{
          boxShadow: [
            '0 8px 32px rgba(0, 168, 132, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
            '0 12px 48px rgba(0, 168, 132, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
            '0 8px 32px rgba(0, 168, 132, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
          ],
        }}
        transition={{
          boxShadow: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        }}
      >
        {/* Rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: '2px solid rgba(37, 211, 102, 0.4)',
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {/* Ring dots */}
          <span
            className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-[#25D366]"
            style={{ boxShadow: '0 0 6px rgba(37, 211, 102, 0.8)' }}
          />
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-[#128C7E]"
            style={{ boxShadow: '0 0 4px rgba(18, 140, 126, 0.8)' }}
          />
        </motion.div>

        {/* Inner circle shine */}
        <div
          className="absolute inset-2 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)',
          }}
        />

        {/* Radio icon */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Radio size={s.icon} className="text-white" fill="white" />
        </motion.div>
      </motion.button>

      {/* GO LIVE text */}
      <motion.p
        className={`${s.textSize} mt-2 font-bold tracking-widest text-[#25D366]`}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        GO LIVE
      </motion.p>
    </div>
  );
}

export default LiveButton3D;
