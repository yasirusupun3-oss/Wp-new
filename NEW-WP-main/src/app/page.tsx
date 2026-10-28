'use client';

import dynamic from 'next/dynamic';

// AppShell එක සර්වර් එකේ (SSR) රෙන්ඩර් වෙන්න උත්සාහ කරන එක නවත්තන්න මෙහෙම ඉම්පෝට් කරමු.
const AppShell = dynamic(() => import("@/components/layout/AppShell"), { 
  ssr: false 
});

export default function Home() {
  return (
    <div className="relative min-h-screen w-full max-w-lg mx-auto overflow-hidden" style={{ background: '#000' }}>
      {/* --- Main App Shell (Header + Tab Content + Bottom Nav) --- */}
      <AppShell />
    </div>
  );
}
