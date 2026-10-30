'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Video, Phone, Wallet, Settings } from 'lucide-react';
import { useAppStore, type AppTab } from '@/lib/store';

const tabs: { key: AppTab; label: string; icon: typeof MessageCircle }[] = [
  { key: 'chats', label: 'Chats', icon: MessageCircle },
  { key: 'video-calls', label: 'Video Call', icon: Video },
  { key: 'calls', label: 'Calls', icon: Phone },
  { key: 'wallet', label: 'Wallet', icon: Wallet },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useAppStore();

  const activeIndex = tabs.findIndex((t) => t.key === activeTab);

  const handleTabClick = (tab: (typeof tabs)[number]) => {
    setActiveTab(tab.key);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-dark safe-bottom">
      {/* Subtle top border glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00A884]/30 to-transparent" />

      <div className="relative flex items-center justify-around px-2 pt-1 pb-1">
        {/* Sliding active indicator — 5 tabs now → 20% width each */}
        <motion.div
          className="absolute top-0 h-[3px] w-[calc(20%-8px)] rounded-b-full"
          style={{
            background:
              activeTab === 'video-calls'
                ? 'linear-gradient(90deg, #10B981, #34D399)'
                : 'linear-gradient(90deg, #00A884, #25D366)',
            boxShadow:
              activeTab === 'video-calls'
                ? '0 2px 8px rgba(16, 185, 129, 0.5)'
                : '0 2px 8px rgba(0, 168, 132, 0.5)',
          }}
          animate={{
            x: `${activeIndex * 100}%`,
            left: '4%',
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
          }}
        />

        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isVideoCall = tab.key === 'video-calls';
          const Icon = tab.icon;

          // Video Call tab uses emerald-500 glow, others use the default teal
          const activeColor = isVideoCall ? 'text-emerald-500' : 'text-[#00A884]';
          const activeShadow = isVideoCall
            ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]'
            : 'drop-shadow-[0_0_6px_rgba(0,168,132,0.5)]';
          const activeFill = isVideoCall ? '#10B981' : '#00A884';
          const activeLabel = isVideoCall ? 'text-emerald-500' : 'text-[#00A884]';

          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab)}
              className="touch-target relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors"
              aria-label={tab.label}
              aria-selected={isActive}
              role="tab"
            >
              {/* Teal / Emerald glow underneath active icon */}
              {isActive && (
                <motion.div
                  layoutId="nav-glow"
                  className="absolute -top-1 h-8 w-8 rounded-full"
                  style={{
                    background: isVideoCall
                      ? 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(0, 168, 132, 0.25) 0%, transparent 70%)',
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                />
              )}

              <div className="relative">
                <Icon
                  size={22}
                  className={`transition-all duration-300 ${
                    isActive
                      ? `${activeColor} ${activeShadow}`
                      : 'text-[#8696A0]'
                  }`}
                  fill={isActive ? activeFill : 'none'}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </div>

              <span
                className={`text-[10px] leading-tight transition-all duration-300 ${
                  isActive ? `${activeLabel} font-semibold` : 'text-[#8696A0]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
