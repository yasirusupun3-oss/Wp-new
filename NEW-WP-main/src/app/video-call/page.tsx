'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react'; // Suspense එකතු කළා
import { useRouter, useSearchParams } from 'next/navigation';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWalletStore } from '@/lib/store';

// --- වීඩියෝ කෝල් එකේ ඇතුළත කොටස (Content) ---
function VideoCallContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerName = searchParams.get('name') || 'User';
  
  const { user } = useAuth();
  const { setCoinBalance } = useWalletStore();
  const [callTime, setCallTime] = useState(0);

  useEffect(() => {
    const coinTimer = setInterval(() => {
      setCoinBalance((prev: number) => {
        if (prev < 2800) {
          alert("කොයින්ස් අවසන් වී ඇත!");
          router.back();
          return prev;
        }
        return prev - 2800;
      });
    }, 60000);

    const timeTimer = setInterval(() => setCallTime(p => p + 1), 1000);
    return () => { clearInterval(coinTimer); clearInterval(timeTimer); };
  }, [router, setCoinBalance]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 shadow-xl shadow-blue-500/20">
          {partnerName[0]}
        </div>
        <h2 className="text-2xl font-semibold">{partnerName}</h2>
        <p className="text-blue-400 animate-pulse mt-1">Video Calling...</p>
        
        <div className="mt-6 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-sm font-mono inline-block">
          {formatTime(callTime)} | <span className="text-yellow-400">2800 🪙/min</span>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <button 
          onClick={() => router.back()} 
          className="p-6 rounded-full bg-red-600 hover:bg-red-700 transition-all shadow-lg shadow-red-600/30"
        >
          <PhoneOff size={32} />
        </button>
      </div>
    </div>
  );
}

// --- ප්‍රධාන පේජ් එක (මෙතනයි වැරැද්ද හැදුවේ) ---
export default function VideoCallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p className="animate-pulse">Loading Video Call...</p>
      </div>
    }>
      <VideoCallContent />
    </Suspense>
  );
}
