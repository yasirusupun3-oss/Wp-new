'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, MessageCircle, LogIn, UserPlus, X, Users } from 'lucide-react';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useChatList } from '@/hooks/useChatList';
import { useAuth } from '@/hooks/useAuth';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';

const avatarColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#82E0AA', '#F1948A', '#AED6F1', '#F9E79F',
];

function getAvatarColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatLastMessageTime(date: Date | null): string {
  if (!date) return '';
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return format(date, 'EEE');
  return format(date, 'MMM d');
}

export default function ChatList() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { chatList, isLoading: chatLoading } = useChatList();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [realUsers, setRealUsers] = useState<{ uid: string; displayName: string; photoURL: string | null }[]>([]);

  // Real registered users from Firestore (excluding yourself)
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

  // Filter chats by search query
  const filteredChats = chatList.filter((chat) =>
    chat.otherUser.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectChat = (otherUid: string) => {
    router.push(`/chat/${otherUid}`);
  };

  const handleStartNewChat = (otherUid: string) => {
    setShowDiscover(false);
    router.push(`/chat/${otherUid}`);
  };

  const handleRefresh = () => {
    setShowDiscover(true);
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#111B21' }}>
        <div
          className="px-4 pt-3 pb-2 shrink-0"
          style={{
            background: 'linear-gradient(135deg, #075E54, #128C7E)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          <h1 className="text-white text-xl font-bold mb-3">Chats</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin"
          />
        </div>
      </div>
    );
  }

  // Not authenticated state
  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#111B21' }}>
        <div
          className="px-4 pt-3 pb-2 shrink-0"
          style={{
            background: 'linear-gradient(135deg, #075E54, #128C7E)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          <h1 className="text-white text-xl font-bold mb-3">Chats</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'rgba(37, 211, 102, 0.1)',
                border: '1px solid rgba(37, 211, 102, 0.2)',
              }}
            >
              <LogIn className="w-8 h-8 text-[#25D366]" />
            </div>
            <p className="text-white/70 text-lg font-medium mb-2">Log in to see your chats</p>
            <p className="text-white/40 text-sm mb-6">
              Sign in to start messaging and connecting with people
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/login')}
              className="px-8 py-3 rounded-full font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                boxShadow: '0 4px 20px rgba(37, 211, 102, 0.3)',
              }}
            >
              Log In
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#111B21' }}>
      {/* Header */}
      <div
        className="px-4 pt-3 pb-2 shrink-0"
        style={{
          background: 'linear-gradient(135deg, #075E54, #128C7E)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        <h1 className="text-white text-xl font-bold mb-3">Chats</h1>

        {/* Search bar with glassmorphism */}
        <div
          className="flex items-center gap-2 rounded-full px-4 py-2.5 mb-1"
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Search className="w-4 h-4 text-white/50 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="flex-1 bg-transparent text-white/90 text-sm placeholder:text-white/40 outline-none"
          />
        </div>
      </div>

      {/* Pull to refresh hint */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 40, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-center overflow-hidden shrink-0"
            style={{ background: '#1F2C34' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state */}
        {chatLoading && (
          <div className="flex items-center justify-center py-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin"
            />
          </div>
        )}

        {/* Chat items */}
        {!chatLoading && (
          <AnimatePresence mode="popLayout">
            {filteredChats.map((chat, index) => {
              const color = getAvatarColor(chat.otherUser.uid);
              const initials = getInitials(chat.otherUser.displayName);
              const timeStr = formatLastMessageTime(chat.lastMessageTime);

              return (
                <motion.div
                  key={chat.chatId}
                  layoutId={`chat-item-${chat.chatId}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30,
                    delay: index * 0.03,
                  }}
                  onClick={() => handleSelectChat(chat.otherUser.uid)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors active:bg-white/5 hover:bg-white/[0.03]"
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm overflow-hidden"
                      style={{ background: color }}
                    >
                      {chat.otherUser.photoURL ? (
                        <img
                          src={chat.otherUser.photoURL}
                          alt={chat.otherUser.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                  </div>

                  {/* Chat info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white font-semibold text-[15px] truncate">
                        {chat.otherUser.displayName}
                      </p>
                      <span
                        className={`text-xs shrink-0 ${
                          chat.unreadCount > 0 ? 'text-[#25D366]' : 'text-white/40'
                        }`}
                      >
                        {timeStr}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-white/50 text-[13px] truncate leading-tight">
                        {chat.lastMessage}
                      </p>
                      {chat.unreadCount > 0 && (
                        <motion.div
                          layoutId={`badge-${chat.chatId}`}
                          className="shrink-0 min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center"
                          style={{
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            boxShadow: '0 0 8px rgba(37, 211, 102, 0.4)',
                          }}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        >
                          <span className="text-white text-[11px] font-bold">
                            {chat.unreadCount}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Empty state - no conversations */}
        {!chatLoading && filteredChats.length === 0 && !searchQuery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-3"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
              style={{
                background: 'rgba(37, 211, 102, 0.08)',
                border: '1px solid rgba(37, 211, 102, 0.15)',
              }}
            >
              <MessageCircle className="w-9 h-9 text-white/20" />
            </div>
            <p className="text-white/50 text-base font-medium">No conversations yet</p>
            <p className="text-white/30 text-sm text-center max-w-[240px]">
              Start chatting! Discover new people and send your first message.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDiscover(true)}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm text-white"
              style={{
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                boxShadow: '0 4px 16px rgba(37, 211, 102, 0.25)',
              }}
            >
              <UserPlus className="w-4 h-4" />
              Discover People
            </motion.button>
          </motion.div>
        )}

        {/* No search results */}
        {!chatLoading && filteredChats.length === 0 && searchQuery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-3"
          >
            <Search className="w-10 h-10 text-white/15" />
            <p className="text-white/40 text-sm">No chats found for &quot;{searchQuery}&quot;</p>
          </motion.div>
        )}
      </div>

      {/* FAB - New Chat / Discover Button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleRefresh}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center z-40 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #25D366, #128C7E)',
          boxShadow: '0 6px 24px rgba(37, 211, 102, 0.4)',
        }}
        aria-label="New Chat"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
      </motion.button>

      {/* Discover People panel — real registered Firestore users */}
      <AnimatePresence>
        {showDiscover && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end"
            onClick={() => setShowDiscover(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-h-[75vh] bg-[#111B21] rounded-t-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="text-white text-base font-semibold">Discover People</h3>
                <button onClick={() => setShowDiscover(false)} className="p-1 text-white/60">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto px-4 py-3 space-y-1">
                {realUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Users className="w-8 h-8 text-white/20" />
                    <p className="text-white/40 text-sm text-center">
                      No one else has signed up yet — invite a friend to start chatting for real.
                    </p>
                  </div>
                ) : (
                  realUsers.map((u) => (
                    <button
                      key={u.uid}
                      onClick={() => handleStartNewChat(u.uid)}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 text-left"
                    >
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ background: getAvatarColor(u.uid) }}
                      >
                        {getInitials(u.displayName)}
                      </div>
                      <span className="text-white text-sm font-medium">{u.displayName}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
