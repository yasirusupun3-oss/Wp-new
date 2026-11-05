'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteVideoTrack,
  type IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';

export interface UseAgoraCallReturn {
  joinCall: (channelName: string) => Promise<void>;
  leaveCall: () => void;
  localVideoTrack: ICameraVideoTrack | null;
  remoteVideoTrack: IRemoteVideoTrack | null;
  isJoined: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  toggleMute: () => void;
  toggleCamera: () => void;
  remoteUser: IAgoraRTCRemoteUser | null;
  error: string | null;
  callDuration: number;
}

export function useAgoraCall(): UseAgoraCallReturn {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<IRemoteVideoTrack | null>(null);
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Cleanup all resources
  const cleanup = useCallback(() => {
    // Stop duration timer
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    // Close local tracks
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.close().catch(() => {});
      localVideoTrackRef.current = null;
    }
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.close().catch(() => {});
      localAudioTrackRef.current = null;
    }

    // Leave client
    if (clientRef.current) {
      clientRef.current.leave().catch(() => {});
      clientRef.current = null;
    }

    // Reset state
    setLocalVideoTrack(null);
    setRemoteVideoTrack(null);
    setRemoteUser(null);
    setIsJoined(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setError(null);
    setCallDuration(0);
  }, []);

  // Join the call channel
  const joinCall = useCallback(async (channelName: string) => {
    // Reset previous state
    cleanup();

    try {
      if (!APP_ID) {
        setError('Agora APP_ID is not configured. Set NEXT_PUBLIC_AGORA_APP_ID in your environment.');
        return;
      }

      // Create client
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      // Generate a random numeric UID
      const uid = Math.floor(Math.random() * 1000000).toString();

      // Fetch token from our API
      const tokenRes = await fetch('/api/agora-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, uid, role: 'publisher' }),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({ error: 'Failed to get token' }));
        throw new Error(errData.error || 'Failed to get Agora token');
      }

      const { token } = await tokenRes.json();

      // Join the channel
      await client.join(APP_ID, channelName, token, uid);

      // Create local tracks
      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      localAudioTrackRef.current = microphoneTrack;
      localVideoTrackRef.current = cameraTrack;
      setLocalVideoTrack(cameraTrack);

      // Publish local tracks
      await client.publish([microphoneTrack, cameraTrack]);
      setIsJoined(true);

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Handle remote user publishing
      client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
        try {
          await client.subscribe(user, mediaType);

          if (mediaType === 'video') {
            const track = user.videoTrack as IRemoteVideoTrack;
            if (track) {
              setRemoteVideoTrack(track);
              setRemoteUser(user);
            }
          }

          // Auto-play remote audio
          if (mediaType === 'audio' && user.audioTrack) {
            user.audioTrack.play();
          }
        } catch (err) {
          console.error('[useAgoraCall] Error subscribing to remote user:', err);
        }
      });

      // Handle remote user unpublishing
      client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
        if (mediaType === 'video') {
          setRemoteVideoTrack(null);
          // If the user has no more published tracks, clear the remote user
          if (!user.audioTrack) {
            setRemoteUser(null);
          }
        }
      });

      // Handle remote user leaving
      client.on('user-left', (user: IAgoraRTCRemoteUser) => {
        if (remoteUser?.uid === user.uid) {
          setRemoteVideoTrack(null);
          setRemoteUser(null);
        }
      });

      // Handle errors
      client.on('error', (err) => {
        console.error('[useAgoraCall] Agora client error:', err);
        setError(`Connection error: ${err.reason || 'Unknown error'}`);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join call';
      setError(message);
      cleanup();
    }
  }, [cleanup]);

  // Leave the call
  const leaveCall = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    if (localAudioTrackRef.current) {
      const newMuted = !isMuted;
      localAudioTrackRef.current.setEnabled(!newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // Toggle camera on/off
  const toggleCamera = useCallback(() => {
    if (localVideoTrackRef.current) {
      const newCameraOff = !isCameraOff;
      localVideoTrackRef.current.setEnabled(!newCameraOff);
      setIsCameraOff(newCameraOff);
    }
  }, [isCameraOff]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    joinCall,
    leaveCall,
    localVideoTrack,
    remoteVideoTrack,
    isJoined,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    remoteUser,
    error,
    callDuration,
  };
}
