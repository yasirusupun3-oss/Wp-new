'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Radio } from 'lucide-react';
import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore, useLiveStore } from '@/lib/store';
import { requestAppFullscreen } from '@/lib/utils';

interface LiveStreamItem {
  id: string;
  hostId: string;
  hostName: string;
  hostPhoto: string | null;
  channelName: string;
  title: string;
  viewerCount: number;
  status: string;
  startedAtMillis: number | null;
}

// A stream whose doc was never marked "ended" (tab closed, app killed,
// crash) but hasn't been touched in this long is treated as stale and
// hidden — this is what stops the same host from showing up as "live"
// several times over from old, abandoned stream docs.
const STALE_STREAM_MS = 6 * 60 * 60 * 1000; // 6 hours

// Hash a string to get a consistent color
function getHashColor(str: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#82E0AA', '#F1948A', '#AED6F1', '#F9E79F',
    '#FF8C42', '#98D8C8', '#C3B1E1', '#FFB6C1', '#87CEEB',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function LiveFeedList() {
  const [streams, setStreams] = useState<LiveStreamItem[]>([]);
  const { setShowLivePage } = useAppStore();
  const { setViewing } = useLiveStore();

  // Real-time listener for active live streams
  useEffect(() => {
    const q = query(
      collection(db, 'liveStreams'),
      where('status', '==', 'active')
    );

    let unsubscribe: Unsubscribe;
    try {
      unsubscribe = onSnapshot(q, (snapshot) => {
        const now = Date.now();
        let activeStreams: LiveStreamItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const startedAtMillis: number | null = data.startedAt?.toMillis?.() ?? null;
          // Skip streams whose doc never got cleaned up after the host's
          // tab/app closed abruptly.
          if (startedAtMillis && now - startedAtMillis > STALE_STREAM_MS) return;
          activeStreams.push({
            id: doc.id,
            hostId: data.hostId || '',
            hostName: data.hostName || 'Anonymous',
            hostPhoto: data.hostPhoto || null,
            channelName: data.channelName || '',
            title: data.title || 'Live Stream',
            viewerCount: data.viewerCount || 0,
            status: data.status || 'active',
            startedAtMillis,
          });
        });

        // A host should only ever appear once — if duplicate active docs
        // exist for the same host (e.g. from a stream that never got
        // marked "ended"), keep only their most recently started one.
        const newestPerHost = new Map<string, LiveStreamItem>();
        for (const stream of activeStreams) {
          const key = stream.hostId || stream.id;
          const existing = newestPerHost.get(key);
          if (!existing || (stream.startedAtMillis ?? 0) > (existing.startedAtMillis ?? 0)) {
            newestPerHost.set(key, stream);
          }
        }
        activeStreams = Array.from(newestPerHost.values());

        // Sort by viewer count (most popular first), limit to 10
        activeStreams.sort((a, b) => b.viewerCount - a.viewerCount);
        setStreams(activeStreams.slice(0, 10));
      }, (err) => {
        console.error('[LiveFeedList] Error listening to live streams:', err);
      });
    } catch (err) {
      console.error('[LiveFeedList] Error setting up listener:', err);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleStreamClick = (stream: LiveStreamItem) => {
    requestAppFullscreen();
    setViewing(true, stream.channelName, stream.id, stream.hostId, stream.hostName, stream.title);
    setShowLivePage(true);
  };

  // Memoize list variants
  const listVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  }), []);

  const itemVariants = useMemo(() => ({
    hidden: { opacity: 0, scale: 0.8, y: 10 },
    show: { opacity: 1, scale: 1, y: 0 },
  }), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="px-4 py-2"
    >
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Radio className="w-4 h-4 text-red-500" />
        </motion.div>
        <h3 className="text-[#E9EDEF] text-sm font-semibold">Live Now</h3>
        {streams.length > 0 && (
          <span className="text-[#8696A0] text-xs">• {streams.length} stream{streams.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {streams.length === 0 ? (
        /* Empty state */
        <div
          className="rounded-2xl px-4 py-4"
          style={{
            background: 'rgba(0,0,0,0.2)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <Radio className="w-5 h-5 text-[#8696A0]" />
            </div>
            <div>
              <p className="text-[#8696A0] text-sm font-medium">No live streams right now</p>
              <p className="text-[#8696A0]/60 text-xs mt-0.5">Check back later</p>
            </div>
          </div>
        </div>
      ) : (
        /* Horizontal scrollable stream list */
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <AnimatePresence>
            {streams.map((stream) => (
              <motion.button
                key={stream.id}
                variants={itemVariants}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                onClick={() => handleStreamClick(stream)}
                className="flex-shrink-0 w-[72px] flex flex-col items-center gap-1.5 cursor-pointer"
              >
                {/* Circular avatar with LIVE badge */}
                <div className="relative">
                  {/* Outer ring pulse */}
                  <motion.div
                    className="absolute -inset-0.5 rounded-full"
                    style={{
                      background: 'conic-gradient(from 0deg, #EF4444, #F97316, #EF4444)',
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                  <motion.div
                    className="absolute -inset-0.5 rounded-full"
                    style={{
                      background: 'conic-gradient(from 180deg, #EF4444, #F97316, #EF4444)',
                    }}
                    animate={{ rotate: -360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Avatar circle */}
                  <div
                    className="relative w-[56px] h-[56px] rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
                    style={{
                      background: getHashColor(stream.hostName),
                      border: '2px solid #0B141A',
                    }}
                  >
                    {stream.hostPhoto ? (
                      <img
                        src={stream.hostPhoto}
                        alt={stream.hostName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      stream.hostName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    )}
                  </div>

                  {/* LIVE badge */}
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-[1px] rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #DC2626, #EF4444)',
                      boxShadow: '0 2px 8px rgba(220,38,38,0.5)',
                      border: '1.5px solid #0B141A',
                    }}
                  >
                    <motion.div
                      className="w-1 h-1 rounded-full bg-white"
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                    <span className="text-[8px] font-bold text-white tracking-wide">LIVE</span>
                  </div>
                </div>

                {/* Streamer name */}
                <div className="w-full text-center">
                  <p className="text-[#E9EDEF] text-[11px] font-medium truncate px-0.5">
                    {stream.hostName.split(' ')[0]}
                  </p>
                  {/* Viewer count */}
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    <Eye className="w-2.5 h-2.5 text-[#8696A0]" />
                    <span className="text-[#8696A0] text-[10px]">
                      {stream.viewerCount >= 1000
                        ? `${(stream.viewerCount / 1000).toFixed(1)}K`
                        : stream.viewerCount}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}
