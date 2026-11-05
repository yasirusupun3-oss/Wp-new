'use client';

import { useAppStore } from '@/lib/store';
import { requestAppFullscreen } from '@/lib/utils';
import { Search, MoreVertical, Camera, QrCode } from 'lucide-react';

const tabConfig: Record<string, { title: string; icons: Array<{ Icon: typeof Search; isLive?: boolean }> }> = {
  chats: {
    title: 'Wp-earn-money',
    icons: [
      { Icon: Search },
      { Icon: Camera, isLive: true },
      { Icon: MoreVertical },
    ],
  },
  calls: {
    title: 'Calls',
    icons: [
      { Icon: Search },
      { Icon: MoreVertical },
    ],
  },
  wallet: {
    title: 'Wallet',
    icons: [
      { Icon: QrCode },
      { Icon: MoreVertical },
    ],
  },
  settings: {
    title: 'Settings',
    icons: [
      { Icon: QrCode },
      { Icon: MoreVertical },
    ],
  },
};

export default function AppHeader() {
  const { activeTab, setShowLivePage } = useAppStore();
  const config = tabConfig[activeTab] || tabConfig.chats;

  return (
    <header className="sticky top-0 z-40 safe-top">
      {/* WhatsApp header with glassmorphism */}
      <div className="wa-header-gradient glass" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center justify-between px-3 py-2.5">
          {/* Left side: avatar */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                }}
              >
                U
              </div>
              {/* Online indicator */}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#25D366] border-2 border-[#075E54]" />
            </div>
            <h1 className="text-white text-lg font-semibold tracking-tight">
              {config.title}
            </h1>
          </div>

          {/* Right side: action icons */}
          <div className="flex items-center gap-1">
            {config.icons.map(({ Icon, isLive }, i) => (
              <button
                key={i}
                onClick={isLive ? () => { requestAppFullscreen(); setShowLivePage(true); } : undefined}
                className="touch-target relative flex items-center justify-center rounded-full p-2 text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={isLive ? 'Go Live' : 'action'}
              >
                <Icon size={20} />
                {/* Pulsing red dot for the Live Camera icon */}
                {isLive && (
                  <span
                    className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-[#EA4335] border-2 border-[#075E54] live-pulse-dot"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Haptic-like bottom shadow */}
      <div
        className="h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0, 168, 132, 0.2), transparent)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}
      />
    </header>
  );
}
