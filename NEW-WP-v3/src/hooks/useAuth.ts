'use client';

import { useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthStore, useWalletStore } from '@/lib/store';
import type { UserProfile } from '@/lib/firebase';

interface AuthUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  coinBalance: number;
}

interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { setUser, setLoading, logout: storeLogout } = useAuthStore.getState();

  // Stable logout function that calls Firebase signOut and clears the store
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      // Even if Firebase signOut fails, clear the local store
    }
    storeLogout();
  }, [storeLogout]);

  useEffect(() => {
    // Set loading true when listener first attaches
    setLoading(true);

    // Safety net: if Firebase Auth's callback never fires (e.g. a mobile
    // browser blocking IndexedDB/cookies causes persistence init to hang),
    // don't leave the user stuck on the loading screen forever.
    const timeoutId = setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        console.warn('[useAuth] Firebase auth state took too long to resolve — proceeding as signed out.');
        setLoading(false);
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      clearTimeout(timeoutId);
      if (firebaseUser) {
        try {
          // Fetch the user's Firestore profile
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUser({
              uid: profile.uid,
              displayName: profile.displayName,
              email: profile.email,
              photoURL: profile.photoURL,
              coinBalance: profile.coinBalance,
            });
            // Keep the wallet store's balance (used across Wallet/Live/Chat)
            // in sync with the real profile balance — it otherwise starts
            // at its own default and never picks up the real number.
            useWalletStore.getState().setCoinBalance(profile.coinBalance ?? 0);
          } else {
            setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName ?? 'User',
              email: firebaseUser.email ?? '',
              photoURL: firebaseUser.photoURL,
              coinBalance: 0,
            });
            useWalletStore.getState().setCoinBalance(0);
          }
          // Grant daily login bonus silently — the API handles idempotency
          // (one grant per day) so calling this on every app open is safe.
          fetch('/api/rewards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: firebaseUser.uid, type: 'daily_login' }),
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (data.success && typeof data.balance === 'number') {
              // Update the local zustand store so the UI immediately reflects
              // the bonus without a page refresh.
              useAuthStore.getState().setUser(
                useAuthStore.getState().user
                  ? { ...useAuthStore.getState().user!, coinBalance: data.balance }
                  : null
              );
              useWalletStore.getState().setCoinBalance(data.balance);
            }
          }).catch(() => {});
        } catch {
          setUser({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName ?? 'User',
            email: firebaseUser.email ?? '',
            photoURL: firebaseUser.photoURL,
            coinBalance: 0,
          });
          useWalletStore.getState().setCoinBalance(0);
        }
      } else {
        // User is signed out — reset the wallet store too, so a previous
        // account's balance/transactions never leak into the next session.
        useAuthStore.getState().logout();
        useWalletStore.setState({ coinBalance: 0, totalEarned: 0, totalSpent: 0, transactions: [] });
      }

      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [setUser, setLoading]);

  return { user, isAuthenticated, isLoading, logout };
}
