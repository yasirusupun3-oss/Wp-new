'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Video, Search, ChevronRight, AlertCircle, Sparkles, Users } from 'lucide-react';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCallStore, useWalletStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { GlassmorphismCard } from '@/components/three/GlassmorphismCard';

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

export default function VideoCallsHome() {
  const [searchQuery, setSearchQuery] = useState('');
  const { setInCall } = useCallStore();
  const { coinBalance } = useWalletStore();
  const { user } = useAuth();
  const [realUsers, setRealUsers] = useState<RealUser[]>([]);

  // ── Real registered users from Firestore (excluding yourself) ──
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'), limit(30));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRealUsers(
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

  const handleVideoCall = useCallback(
    (partner: string) => {
      setInCall(true, 'video', partner);
    },
    [setInCall]
  );

  const filteredContacts = realUsers.filter((c) =>
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase())
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
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#E9EDEF] placeholder-[#8696A0] outline-none"
            />
          </div>
        </GlassmorphismCard>
      </motion.div>

      {/* ── Hero: Start a Video Call ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
        <GlassmorphismCard
          className="rounded-2xl p-5"
          style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.25)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)', boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)' }}
            >
              <Video size={26} className="text-white" fill="white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#E9EDEF] text-sm font-semibold flex items-center gap-1.5">
                Face-to-face, instantly <Sparkles size={13} className="text-[#A855F7]" />
              </p>
              <p className="text-[#8696A0] text-xs mt-1">1500 coins/min • Pick a real registered person below</p>
            </div>
          </div>
        </GlassmorphismCard>
      </motion.div>

      {/* ── Real Registered People ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#E9EDEF] text-base font-semibold">People</h2>
          <span className="text-[#8696A0] text-xs">{filteredContacts.length} people</span>
        </div>

        <motion.div variants={listVariants} initial="hidden" animate="show" className="space-y-2 max-h-96 overflow-y-auto rounded-xl">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <Users size={32} className="text-[#8696A0] mx-auto mb-2" />
              <p className="text-[#8696A0] text-sm">
                {realUsers.length === 0
                  ? 'No one else has signed up yet — invite a friend to test real calls.'
                  : 'No one found'}
              </p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <motion.div key={contact.uid} variants={itemVariants} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
                <GlassmorphismCard variant="dark" className="rounded-xl px-3 py-3" onClick={() => handleVideoCall(contact.displayName)}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: colorForId(contact.uid) }}
                    >
                      {contact.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-[#E9EDEF]">{contact.displayName}</p>
                      <p className="text-xs text-[#8696A0] mt-0.5">Registered user</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)', boxShadow: '0 2px 10px rgba(139, 92, 246, 0.4)' }}
                      >
                        <Video size={16} className="text-white" fill="white" />
                      </div>
                      <ChevronRight size={14} className="text-[#8696A0]" />
                    </div>
                  </div>
                </GlassmorphismCard>
              </motion.div>
            ))
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
                Video calls cost <span className="text-[#E9EDEF] font-semibold">1500 coins/minute</span> •{' '}
                Balance: <span className="text-[#FFD700] font-semibold">{coinBalance.toLocaleString()} coins</span>
              </p>
            </div>
          </div>
        </GlassmorphismCard>
      </motion.div>
    </div>
  );
}
