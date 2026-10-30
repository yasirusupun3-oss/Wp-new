'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore, useCallStore, type AppTab } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';

import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import ChatList from '@/components/chat/ChatList';
import CallsHome from '@/components/calls/CallsHome';
import VideoCallsHome from '@/components/calls/VideoCallsHome';
import WalletHome from '@/components/wallet/WalletHome';
import SettingsHome from '@/components/settings/SettingsHome';
import LiveFullPage from '@/components/live/LiveFullPage';
import { LiveErrorBoundary } from '@/components/live/LiveErrorBoundary';
import AdRewardOverlay from '@/components/ads/AdRewardOverlay';
import LiveFeedList from '@/components/live/LiveFeedList';
import VideoCallOverlay from '@/components/calls/VideoCallOverlay';

const tabComponents: Record<AppTab, React.ComponentType> = {
  chats: ChatList,
  'video-calls': VideoCallsHome,
  calls: CallsHome,
  wallet: WalletHome,
  settings: SettingsHome,
};

const tabVariants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
};

const liveOverlayVariants = {
  initial: { opacity: 0, scale: 1.05 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export default function AppShell() {
  const { user, isLoading: loading } = useAuth();
  const router = useRouter();

  // ─── Hard local failsafe (independent of useAuth's own timeout) ─────────
  // If auth state genuinely never resolves for any reason, this guarantees
  // the loading screen can't hang forever — it doesn't rely on useAuth or
  // the zustand store at all, just plain local React state.
  const [forceReady, setForceReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const startTime = Date.now();
    const tickInterval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    const forceTimeout = setTimeout(() => setForceReady(true), 8000);
    return () => {
      clearInterval(tickInterval);
      clearTimeout(forceTimeout);
    };
  }, [loading]);

  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const adShownRef = useRef(false);

  // Show the ad/daily-bonus overlay once after each login session
  useEffect(() => {
    if (user && !loading && !forceReady && !adShownRef.current) {
      adShownRef.current = true;
      // Small delay so the main UI renders first
      const t = setTimeout(() => setShowAdOverlay(true), 1500);
      return () => clearTimeout(t);
    }
  }, [user, loading, forceReady]);

  const { activeTab, showLivePage, setShowLivePage } = useAppStore();
  const { isInCall, callType, callPartner, endCall } = useCallStore();
  const ActiveComponent = tabComponents[activeTab];

  // --- Authentication Logic ---
  useEffect(() => {
    // යූසර් ලොග් වෙලා නැත්නම් සහ ලෝඩ් වෙලා ඉවර නම් කෙලින්ම ලොගින් පේජ් එකට යවන්න
    if ((!loading || forceReady) && !user) {
      router.push('/login');
    }
  }, [user, loading, forceReady, router]);

  // ලෝඩින් අවස්ථාවේදී පෙන්වන තිරය
  if (loading && !forceReady) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-black text-white font-bold">
        <div className="animate-pulse text-xl">Loading...</div>
        {elapsedSeconds >= 3 && (
          <div className="flex flex-col items-center gap-3 text-sm font-normal text-white/50">
            <span>Still checking your session… ({elapsedSeconds}s)</span>
            <button
              onClick={() => setForceReady(true)}
              className="rounded-full border border-white/20 px-4 py-1.5 text-white/80"
            >
              Continue to Login
            </button>
          </div>
        )}
      </div>
    );
  }

  // යූසර් නැත්නම් මුකුත්ම පෙන්වන්න එපා (Redirect වෙනකන්)
  if (!user) return null;

  // Generate a channel name from call partner's name for Agora
  const callChannelName = callPartner
    ? `call_${callPartner.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`
    : '';

  return (
    <div className="flex flex-col h-dvh w-full max-w-lg mx-auto overflow-hidden bg-background">
      {/* Header */}
      <AppHeader />

      {/* Content area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden chat-bg-pattern relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="min-h-full pb-20"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>

        {/* Live Feed List - only visible on Chats tab */}
        <AnimatePresence>
          {activeTab === 'chats' && (
            <motion.div
              key="live-feed"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <LiveFeedList />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Live Full Page Overlay */}
      <AnimatePresence>
        {showLivePage && (
          <motion.div
            key="live-overlay"
            variants={liveOverlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 w-full max-w-lg mx-auto"
          >
            <LiveErrorBoundary onClose={() => setShowLivePage(false)}>
              <LiveFullPage />
            </LiveErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Call Overlay */}
      <AnimatePresence>
        {isInCall && callType && callPartner && (
          <motion.div
            key="video-call-overlay"
            variants={liveOverlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed inset-0 z-[60] w-full max-w-lg mx-auto"
          >
            <LiveErrorBoundary label="call" onClose={endCall}>
              <VideoCallOverlay
                channelName={callChannelName}
                partnerName={callPartner}
                callType={callType}
                onEndCall={endCall}
              />
            </LiveErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily login bonus + ad reward overlay */}
      {showAdOverlay && (
        <AdRewardOverlay
          afterLogin
          onClose={() => setShowAdOverlay(false)}
        />
      )}
    </div>
  );
}
