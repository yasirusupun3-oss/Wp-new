'use client';

import { motion } from 'framer-motion';

interface CoinIconProps {
  size?: 'sm' | 'md' | 'lg' | number;
  className?: string;
  balance?: number;
}

const stringSizeMap = {
  sm: { outer: 24, inner: 18, text: 9, border: 1.5 },
  md: { outer: 36, inner: 28, text: 14, border: 2 },
  lg: { outer: 48, inner: 38, text: 18, border: 3 },
};

export function CoinIcon({ size = 'md', className = '', balance }: CoinIconProps) {
  const numericSize = typeof size === 'number' ? size : null;
  const stringSize = typeof size === 'string' ? stringSizeMap[size] : null;

  const outer = numericSize || stringSize?.outer || 36;
  const inner = numericSize ? outer * 0.78 : stringSize?.inner || 28;
  const text = numericSize ? outer * 0.4 : stringSize?.text || 14;
  const border = numericSize ? outer * 0.06 : stringSize?.border || 2;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="perspective-1000 inline-flex items-center justify-center">
        <motion.div
          className="preserve-3d relative rounded-full flex items-center justify-center"
          style={{
            width: outer,
            height: outer,
          }}
          animate={{ rotateY: 360 }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {/* Front face */}
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center backface-hidden"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
              boxShadow: `0 2px 8px rgba(255, 215, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.15)`,
            }}
          >
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: inner,
                height: inner,
                border: `${border}px solid rgba(255, 255, 255, 0.3)`,
                background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.3) 0%, transparent 60%)',
              }}
            >
              <span
                className="font-bold text-[#8B6914]"
                style={{
                  fontSize: text,
                  textShadow: '0 1px 0 rgba(255,255,255,0.5)',
                }}
              >
                ¢
              </span>
            </div>
          </div>

          {/* Back face */}
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center backface-hidden"
            style={{
              background: 'linear-gradient(135deg, #FFA500 0%, #FFD700 50%, #FFA500 100%)',
              transform: 'rotateY(180deg)',
              boxShadow: `0 2px 8px rgba(255, 215, 0, 0.3)`,
            }}
          >
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: inner,
                height: inner,
                border: `${border}px solid rgba(255, 255, 255, 0.2)`,
                background: 'radial-gradient(circle at 65% 65%, rgba(255,255,255,0.2) 0%, transparent 60%)',
              }}
            >
              <span
                className="font-bold text-[#8B6914]"
                style={{
                  fontSize: text * 0.75,
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                $
              </span>
            </div>
          </div>

          {/* Moving shadow */}
          <motion.div
            className="absolute rounded-full -z-10"
            style={{
              width: outer * 0.8,
              height: outer * 0.25,
              background: 'radial-gradient(ellipse, rgba(255, 215, 0, 0.15) 0%, transparent 70%)',
              bottom: -(outer * 0.15),
            }}
            animate={{
              scaleX: [1, 0.6, 1, 0.6, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </motion.div>
      </div>

      {/* Balance display */}
      {balance !== undefined && (
        <motion.span
          className="text-xs font-bold text-[#FFD700]"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {balance.toLocaleString()}
        </motion.span>
      )}
    </div>
  );
}

export default CoinIcon;
