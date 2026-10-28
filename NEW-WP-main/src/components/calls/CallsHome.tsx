'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Video, Search, DollarSign, ChevronRight, AlertCircle, Users } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCallStore, useWalletStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { GlassmorphismCard } from '@/components/three/GlassmorphismCard';

interface RealCallRecord {
  id: string;
  partnerId: string;
  callType: 'voice' | 'video';
  durationSeconds: number;
  totalCost: number;
  status: string;
  createdAt: number;
}

interface RealUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#F7DC6F', '#FFEAA7', '#96CEB4', '#A29BFE', '#74B9FF'];
function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0 },
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function CallsHome() {
  const [searchQuery, setSearchQuery] = useState('');
  const { setInCall } = useCallStore();
  const { coinBalance } = useWalletStore();
  const { user } = useAuth();

  const [recentCalls, setRecentCalls] = useState<RealCallRecord[]>([]);
  const [otherUsers, setOtherUsers] = useState<RealUser[]>([]);

  // ── Real call history from Firestore (written by /api/coins/call-billing) ──
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'callRecords'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecentCalls(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            partnerId: data.partnerId || 'Unknown',
            callType: data.callType || 'voice',
            durationSeconds: data.durationSeconds || 0,
            totalCost: data.totalCost || 0,
            status: data.status || 'completed',
            createdAt: data.createdAt?.toMillis?.() || Date.now(),
          };
        })
      );
    });
    return () => unsubscribe();
  }, [user]);

  // ── Real other registered users (for "who can I call") ──
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'), limit(30));
    const unsubscribe = onSnapshot(q, (snap) => {
      setOtherUsers(
        snap.docs
          .filter((d) => d.id !== user.uid)
          .map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              displayName: data.displayName || 'User',
              photoURL: data.photoURL || null,
            };
          })
      );
    });
    return () => unsubscribe();
  }, [user]);

  const handleCall = useCallback(
    (type: 'voice' | 'video', partner: string) => {
      setInCall(true, type, partner);
    },
    [setInCall]
  );

  const filteredCalls = recentCalls.filter((call) =>
    call.partnerId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="px-4 pt-4 pb-6 space-y-6">
      {/* ── Search Bar ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <GlassmorphismCard variant="dark" noPadding className="rounded-xl">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Search size={16} className="text-[#8696A0] shrink-0" />
            <input
              type="text"
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#E9EDEF] placeholder-[#8696A0] outline-none"
            />
          </div>
        </GlassmorphismCard>
      </motion.div>

      {/* ── Make a Call Section ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
        <h2 className="text-[#E9EDEF] text-base font-semibold mb-3">Make a Call</h2>
        <div className="grid grid-cols-2 gap-3">
          <GlassmorphismCard
            variant="teal"
            className="rounded-2xl p-4"
            onClick={() => otherUsers[0] && handleCall('voice', otherUsers[0].displayName)}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #00A884, #25D366)', boxShadow: '0 4px 16px rgba(0, 168, 132, 0.4)' }}
            >
              <Phone size={22} className="text-white" fill="white" />
            </div>
            <p className="text-[#E9EDEF] text-sm font-semibold text-center">Voice Call</p>
            <p className="text-[#8696A0] text-xs text-center mt-1">1500 coins/min</p>
          </GlassmorphismCard>

          <GlassmorphismCard
            className="rounded-2xl p-4"
            style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.25)' }}
            onClick={() => otherUsers[0] && handleCall('video', otherUsers[0].displayName)}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)', boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)' }}
            >
              <Video size={22} className="text-white" fill="white" />
            </div>
            <p className="text-[#E9EDEF] text-sm font-semibold text-center">Video Call</p>
            <p className="text-[#8696A0] text-xs text-center mt-1">1500 coins/min</p>
          </GlassmorphismCard>
        </div>
        {otherUsers.length === 0 && (
          <div className="mt-2 flex items-center gap-2 px-1">
            <Users size={12} className="text-[#8696A0]" />
            <p className="text-[#8696A0] text-xs">
              No one else has signed up yet — invite a friend to test real calls.
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Recent Calls Section (real data) ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#E9EDEF] text-base font-semibold">Recent Calls</h2>
          <span className="text-[#8696A0] text-xs">{filteredCalls.length} calls</span>
        </div>

        <motion.div variants={listVariants} initial="hidden" animate="show" className="space-y-2 max-h-96 overflow-y-auto rounded-xl">
          {filteredCalls.length === 0 ? (
            <div className="text-center py-8">
              <Phone size={32} className="text-[#8696A0] mx-auto mb-2" />
              <p className="text-[#8696A0] text-sm">No calls yet</p>
            </div>
          ) : (
            filteredCalls.map((call) => {
              const mins = Math.floor(call.durationSeconds / 60);
              const secs = call.durationSeconds % 60;
              return (
                <motion.div key={call.id} variants={itemVariants} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
                  <GlassmorphismCard variant="dark" className="rounded-xl px-3 py-3" onClick={() => handleCall(call.callType, call.partnerId)}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ background: colorForId(call.partnerId) }}
                      >
                        {call.partnerId.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-[#E9EDEF]">{call.partnerId}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {call.callType === 'voice' ? (
                            <Phone size={12} className="text-[#00A884]" />
                          ) : (
                            <Video size={12} className="text-[#00A884]" />
                          )}
                          <span className="text-xs text-[#8696A0]">{mins}:{secs.toString().padStart(2, '0')}</span>
                          <span className="text-[#8696A0] text-xs">•</span>
                          <span className="text-[#8696A0] text-xs">{timeAgo(call.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <div className="flex items-center gap-0.5">
                          <DollarSign size={11} className="text-[#FFD700]" />
                          <span className="text-[#FFD700] text-xs font-semibold">{call.totalCost.toLocaleString()}</span>
                        </div>
                        <ChevronRight size={14} className="text-[#8696A0] mt-0.5" />
                      </div>
                    </div>
                  </GlassmorphismCard>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </motion.div>

      {/* ── Info Banner ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
        <GlassmorphismCard variant="dark" className="rounded-xl p-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0">
              <AlertCircle size={16} className="text-[#00A884]" />
            </div>
            <div className="flex-1">
              <p className="text-[#8696A0] text-xs leading-relaxed">
                All calls cost <span className="text-[#E9EDEF] font-semibold">1500 coins/minute</span> •{' '}
                Balance: <span className="text-[#FFD700] font-semibold">{coinBalance.toLocaleString()} coins</span>
              </p>
            </div>
          </div>
        </GlassmorphismCard>
      </motion.div>
    </div>
  );
}
