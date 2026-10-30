'use client';

import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { GiftOverlay } from '@/components/gift/GiftOverlay';

// ─── Types ──────────────────────────────────────────────
export interface GiftEvent {
  /** Unique ID for this animation instance */
  id: string;
  /** Gift emoji (e.g. 👑, 💎, ❤️) */
  emoji: string;
  /** Display name of the gift (e.g. "Royal Crown") */
  giftName: string;
  /** Sender display name */
  senderName: string;
  /** Coin value of the gift */
  coinValue: number;
  /** Animation style — determines particle effect type */
  animation: 'float' | 'burst' | 'rain' | 'spiral';
  /** Timestamp when this gift event was created */
  timestamp: number;
  /** How long (ms) to show before auto-hiding. Default: 3500 */
  duration?: number;
  /** Where the overlay should appear */
  context: 'chat' | 'video-call' | 'live';
}

interface GiftContextValue {
  /** Queue of currently active (or recently active) gift animations */
  activeGifts: GiftEvent[];
  /** Programmatically trigger a gift animation */
  triggerGift: (gift: Omit<GiftEvent, 'id' | 'timestamp'>) => void;
  /** Immediately dismiss a specific gift animation */
  dismissGift: (giftId: string) => void;
  /** Clear all active gift animations */
  clearAllGifts: () => void;
}

// ─── Context ────────────────────────────────────────────
const GiftContext = createContext<GiftContextValue | null>(null);

// ─── Counter for unique IDs ─────────────────────────────
let giftCounter = 0;

// ─── Provider ───────────────────────────────────────────
export function GiftProvider({ children }: { children: React.ReactNode }) {
  const [activeGifts, setActiveGifts] = useState<GiftEvent[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /**
   * Dismiss a single gift by ID and clean up its auto-hide timer.
   */
  const dismissGift = useCallback((giftId: string) => {
    setActiveGifts((prev) => prev.filter((g) => g.id !== giftId));
    const timer = timersRef.current.get(giftId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(giftId);
    }
  }, []);

  /**
   * Clear all active gift animations and their timers.
   */
  const clearAllGifts = useCallback(() => {
    setActiveGifts([]);
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  /**
   * Trigger a new gift animation.
   * Auto-removes after `duration` ms (default 3500ms).
   */
  const triggerGift = useCallback(
    (gift: Omit<GiftEvent, 'id' | 'timestamp'>) => {
      const id = `gift_${++giftCounter}_${Date.now()}`;
      const timestamp = Date.now();
      const duration = gift.duration ?? 3500;

      const newGift: GiftEvent = { ...gift, id, timestamp, duration };

      // Keep max 5 active to prevent performance issues
      setActiveGifts((prev) => {
        const updated = [...prev, newGift].slice(-5);
        // Clean up timers for gifts that fell off the queue
        prev
          .slice(0, prev.length - 4)
          .forEach((removed) => {
            const t = timersRef.current.get(removed.id);
            if (t) clearTimeout(t);
            timersRef.current.delete(removed.id);
          });
        return updated;
      });

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        dismissGift(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [dismissGift],
  );

  return (
    <GiftContext.Provider value={{ activeGifts, triggerGift, dismissGift, clearAllGifts }}>
      {children}

      {/* ─── Global Gift Overlay ──────────────────────── */}
      <AnimatePresence>
        {activeGifts.length > 0 && (
          <GiftOverlay gifts={activeGifts} onDismiss={dismissGift} />
        )}
      </AnimatePresence>
    </GiftContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────
export function useGiftContext() {
  const ctx = useContext(GiftContext);
  if (!ctx) {
    throw new Error('useGiftContext must be used within a <GiftProvider>');
  }
  return ctx;
}
