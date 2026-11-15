'use client';

import { useEffect, useCallback, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore, useWalletStore } from '@/lib/store';
import { useGiftContext } from '@/contexts/GiftContext';
import type { GiftData } from '@/lib/firebase';
import { romanticGifts, type RomanticGift } from '@/lib/store';

// ─── Result type ────────────────────────────────────────
interface UseGiftsReturn {
  /** Whether the Firestore listener is currently loading */
  isLoading: boolean;
  /** Check if the current user can afford a specific gift */
  canAffordGift: (giftCost: number) => boolean;
  /**
   * Send a gift to another user via Firestore.
   * Handles coin deduction and triggers the overlay animation.
   * Returns `true` on success, or a string error message on failure.
   */
  sendGift: (
    receiverId: string,
    receiverName: string,
    gift: RomanticGift,
    context: 'chat' | 'video-call' | 'live',
  ) => Promise<boolean | string>;
  /** The full catalog of available gifts */
  giftCatalog: RomanticGift[];
}

/**
 * Custom hook that:
 *  1. Listens to the Firestore `gifts` collection for incoming gifts to the
 *     current user and triggers the global GiftOverlay animation.
 *  2. Provides a `canAffordGift()` check against the user's Firestore
 *     coin balance.
 *  3. Provides a `sendGift()` function that writes to Firestore and
 *     optionally triggers the local overlay.
 */
export function useGifts(): UseGiftsReturn {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { coinBalance, setCoinBalance } = useWalletStore();
  const { triggerGift } = useGiftContext();

  const [isLoading, setIsLoading] = useState(true);

  // ─── Firestore listener for incoming gifts ───────────
  useEffect(() => {
    if (!user || !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Listen for gifts where the current user is the receiver
    const giftsRef = collection(db, 'gifts');
    const q = query(
      giftsRef,
      where('receiverId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );

    // Keep track of already-processed gift IDs to avoid duplicate animations
    const processedIds = new Set<string>();

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as GiftData & { context?: string; animation?: string; createdAt?: { toDate: () => Date } };

            // Skip already-processed
            if (processedIds.has(change.doc.id)) return;
            processedIds.add(change.doc.id);

            // Convert Firestore timestamp
            const ts = data.createdAt?.toDate?.() ?? new Date();

            // Only trigger animation for recent gifts (last 60 seconds)
            const ageMs = Date.now() - ts.getTime();
            if (ageMs > 60_000) return;

            // Determine animation type from the gift data
            const matchedGift = romanticGifts.find((g) => g.id === data.giftId);
            const animationType = data.animation ?? matchedGift?.animation ?? 'float';

            triggerGift({
              emoji: data.giftEmoji,
              giftName: data.giftName,
              senderName: data.senderName,
              coinValue: data.coinValue,
              animation: animationType as 'float' | 'burst' | 'rain' | 'spiral',
              context: (data.context as 'chat' | 'video-call' | 'live') ?? 'chat',
              duration: data.coinValue >= 1000 ? 5000 : data.coinValue >= 100 ? 4000 : 3500,
            });
          }
        });
        setIsLoading(false);
      },
      (error) => {
        console.error('[useGifts] Firestore listener error:', error);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user, isAuthenticated, triggerGift]);

  // ─── Coin balance check ──────────────────────────────
  const canAffordGift = useCallback(
    (giftCost: number) => coinBalance >= giftCost,
    [coinBalance],
  );

  // ─── Send gift ───────────────────────────────────────
  const sendGift = useCallback(
    async (
      receiverId: string,
      receiverName: string,
      gift: RomanticGift,
      context: 'chat' | 'video-call' | 'live',
    ): Promise<boolean | string> => {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return 'Not authenticated';

      // ── Optimistic local coin check ──
      if (coinBalance < gift.cost) {
        return 'Not enough coins';
      }

      try {
        // ── Deduct coins optimistically from local state ──
        setCoinBalance((prev) => prev - gift.cost);

        // ── Also call the API route for server-side atomic deduction ──
        const response = await fetch('/api/coins/send-gift', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: currentUser.uid,
            receiverId,
            giftId: gift.id,
            context,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          // Rollback local deduction on failure
          setCoinBalance((prev) => prev + gift.cost);
          return result.error ?? 'Failed to send gift';
        }

        // ── Write the gift document to Firestore ──
        const giftDoc = {
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          receiverId,
          receiverName,
          giftId: gift.id,
          giftName: gift.name,
          giftEmoji: gift.emoji,
          coinValue: gift.cost,
          context,
          animation: gift.animation,
          createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'gifts'), giftDoc);

        // ── Trigger local animation for sender (so they see their own gift) ──
        triggerGift({
          emoji: gift.emoji,
          giftName: gift.name,
          senderName: 'You',
          coinValue: gift.cost,
          animation: gift.animation as 'float' | 'burst' | 'rain' | 'spiral',
          context,
          duration: gift.cost >= 1000 ? 5000 : gift.cost >= 100 ? 4000 : 3500,
        });

        // ── Update local wallet transaction history ──
        useWalletStore.getState().addTransaction({
          id: `tx_gift_${Date.now()}`,
          type: 'gift_sent',
          amount: gift.cost,
          description: `Sent ${gift.emoji} ${gift.name} to ${receiverName}`,
          timestamp: Date.now(),
        });

        return true;
      } catch (error) {
        console.error('[useGifts] sendGift error:', error);
        // Rollback on unexpected error
        setCoinBalance((prev) => prev + gift.cost);
        return 'An unexpected error occurred';
      }
    },
    [coinBalance, setCoinBalance, triggerGift],
  );

  return {
    isLoading,
    canAffordGift,
    sendGift,
    giftCatalog: romanticGifts,
  };
}
