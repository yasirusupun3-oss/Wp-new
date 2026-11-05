'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Camera, CameraOff, PhoneOff, SwitchCamera, AlertCircle } from 'lucide-react';
import { useAgoraCall } from '@/hooks/useAgoraCall';
import { useAuthStore, useWalletStore } from '@/lib/store';

interface VideoCallOverlayProps {
  channelName: string;
  partnerName: string;
  callType: 'voice' | 'video';
  onEndCall: () => void;
}

// Format seconds to mm:ss
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function VideoCallOverlay({
  channelName,
  partnerName,
  callType,
  onEndCall,
}: VideoCallOverlayProps) {
  const {
    joinCall,
    leaveCall,
    localVideoTrack,
    remoteVideoTrack,
    isJoined,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    error,
    callDuration,
  } = useAgoraCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const hasJoinedRef = useRef(false);

  // Attach local video track to video element
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.play().then(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localVideoTrack.getMediaStream();
        }
      }).catch(() => {});
    }
  }, [localVideoTrack]);

  // Attach remote video track to video element
  useEffect(() => {
    if (remoteVideoTrack && remoteVideoRef.current) {
      remoteVideoTrack.play().then(() => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteVideoTrack.getMediaStream();
        }
      }).catch(() => {});
    }
  }, [remoteVideoTrack]);

  // Auto-join on mount
  useEffect(() => {
    if (!hasJoinedRef.current && channelName) {
      hasJoinedRef.current = true;
      joinCall(channelName).catch(() => {});
    }
  }, [channelName, joinCall]);

  // Handle end call — bill the user for the call duration, then tear down
  const handleEndCall = useCallback(() => {
    const finalDuration = callDuration;
    leaveCall();
    onEndCall();

    if (finalDuration > 0) {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        fetch('/api/coins/call-billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.uid,
            callType,
            partnerId: partnerName,
            durationSeconds: finalDuration,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && typeof data.balanceAfter === 'number') {
              useWalletStore.getState().setCoinBalance(data.balanceAfter);
            }
          })
          .catch(() => {
            // Silently ignore billing failures
          });
      }
    }
  }, [leaveCall, onEndCall, callDuration, callType, partnerName]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: '#0B141A' }}
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {/* ═══════ TOP BAR ═══════ */}
      <div className="relative z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 pt-3 pb-8">
        <div className="flex items-center justify-between">
          {/* Partner name + call type */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col">
              <p className="text-white font-semibold text-base truncate max-w-[200px]">
                {partnerName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isJoined ? (
                  <>
                    <motion.div
                      className="w-2 h-2 rounded-full bg-[#25D366]"
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-white/70 text-xs font-mono">
                      {formatDuration(callDuration)}
                    </span>
                  </>
                ) : (
                  <motion.span
                    className="text-white/50 text-xs"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    Connecting...
                  </motion.span>
                )}
                {callType === 'voice' && (
                  <span className="text-white/40 text-xs">• Voice Call</span>
                )}
              </div>
            </div>
          </div>

          {/* End call in top bar */}
          <motion.button
            onClick={handleEndCall}
            className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40"
            whileTap={{ scale: 0.9 }}
          >
            <PhoneOff className="w-5 h-5 text-white" />
          </motion.button>
        </div>
      </div>

      {/* ═══════ VIDEO AREA ═══════ */}
      <div className="relative flex-1 min-h-0">
        {callType === 'video' ? (
          <>
            {/* Remote user video (full screen) */}
            <div className="absolute inset-0 bg-[#111B21]">
              {remoteVideoTrack ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : isJoined ? (
                /* Waiting for remote user */
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    {/* Animated avatar placeholder */}
                    <motion.div
                      className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                      style={{
                        background: 'linear-gradient(135deg, #075E54, #128C7E)',
                      }}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      {partnerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </motion.div>
                    <div className="text-center">
                      <p className="text-white/80 text-sm font-medium">{partnerName}</p>
                      <motion.p
                        className="text-white/40 text-xs mt-1"
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        Waiting for video...
                      </motion.p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Connecting state */
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    className="flex flex-col items-center gap-4"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    <div className="w-16 h-16 rounded-full border-4 border-[#25D366]/30 border-t-[#25D366] animate-spin" />
                    <span className="text-white/60 text-sm">Connecting to {partnerName}...</span>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Local video PIP (bottom-right) */}
            <motion.div
              className="absolute bottom-4 right-4 z-10 overflow-hidden rounded-2xl shadow-2xl shadow-black/60"
              style={{
                width: 120,
                height: 160,
                border: '2px solid rgba(255,255,255,0.15)',
              }}
              initial={{ opacity: 0, scale: 0.5, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4, type: 'spring', stiffness: 200 }}
              whileTap={{ scale: 0.95 }}
            >
              {localVideoTrack && !isCameraOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="w-full h-full bg-[#1F2C34] flex items-center justify-center">
                  <CameraOff className="w-6 h-6 text-gray-500" />
                </div>
              )}
              {/* Camera off overlay */}
              {isCameraOff && localVideoTrack && (
                <div className="absolute inset-0 bg-[#1F2C34]/90 flex items-center justify-center">
                  <CameraOff className="w-8 h-8 text-gray-500" />
                </div>
              )}
            </motion.div>
          </>
        ) : (
          /* Voice call view */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              {/* Animated avatar */}
              <motion.div
                className="w-28 h-28 rounded-full flex items-center justify-center text-white text-3xl font-bold relative"
                style={{
                  background: 'linear-gradient(135deg, #075E54, #25D366)',
                  boxShadow: isJoined
                    ? '0 0 60px rgba(37, 211, 102, 0.3)'
                    : '0 0 20px rgba(37, 211, 102, 0.1)',
                }}
                animate={isJoined ? { scale: [1, 1.08, 1] } : { scale: [0.95, 1, 0.95] }}
                transition={{ duration: isJoined ? 3 : 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {partnerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                {/* Ripple rings when connected */}
                {isJoined && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-[#25D366]/30"
                      animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-[#25D366]/20"
                      animate={{ scale: [1, 1.5, 1.5], opacity: [0.3, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                    />
                  </>
                )}
              </motion.div>

              <div className="text-center">
                <p className="text-white font-semibold text-lg">{partnerName}</p>
                {isJoined ? (
                  <motion.p
                    className="text-[#25D366] text-sm mt-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {formatDuration(callDuration)}
                  </motion.p>
                ) : (
                  <motion.p
                    className="text-white/50 text-sm mt-1"
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    Calling...
                  </motion.p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ ERROR DISPLAY ═══════ */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="absolute top-20 left-4 right-4 z-30"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600/20 backdrop-blur-sm border border-red-500/30">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-xs flex-1">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════ BOTTOM CONTROLS ═══════ */}
      <div className="relative z-20 px-6 py-4 pb-8">
        <div
          className="flex items-center justify-center gap-5 px-6 py-4 rounded-3xl mx-auto max-w-xs"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Speaker / Camera flip */}
          <motion.button
            onClick={toggleCamera}
            className="flex flex-col items-center gap-1"
            whileTap={{ scale: 0.9 }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <SwitchCamera className="w-5 h-5 text-white" />
            </div>
          </motion.button>

          {/* Mute toggle */}
          <motion.button
            onClick={toggleMute}
            className="flex flex-col items-center gap-1"
            whileTap={{ scale: 0.9 }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: isMuted ? 'rgba(220,38,38,0.9)' : 'rgba(255,255,255,0.1)',
                border: isMuted ? '1px solid rgba(220,38,38,0.6)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5 text-white" />
              )}
            </div>
          </motion.button>

          {/* End Call (big red) */}
          <motion.button
            onClick={handleEndCall}
            className="flex flex-col items-center gap-1"
            whileTap={{ scale: 0.9 }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #DC2626, #EF4444)',
                boxShadow: '0 4px 20px rgba(220, 38, 38, 0.5)',
              }}
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </div>
          </motion.button>

          {/* Camera toggle */}
          <motion.button
            onClick={toggleCamera}
            className="flex flex-col items-center gap-1"
            whileTap={{ scale: 0.9 }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: isCameraOff ? 'rgba(220,38,38,0.9)' : 'rgba(255,255,255,0.1)',
                border: isCameraOff ? '1px solid rgba(220,38,38,0.6)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {isCameraOff ? (
                <CameraOff className="w-5 h-5 text-white" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
          </motion.button>

          {/* Placeholder for symmetry */}
          <div className="w-12 h-12" />
        </div>
      </div>
    </motion.div>
  );
}
