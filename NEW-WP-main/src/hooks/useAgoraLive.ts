'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteVideoTrack,
  type IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '@/lib/store';

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';

export interface UseAgoraLiveReturn {
  startBroadcasting: (title: string, channelName: string) => Promise<{ channelName: string; streamId: string } | null>;
  stopBroadcasting: () => Promise<void>;
  watchStream: (streamId: string, channelName: string) => Promise<void>;
  leaveStream: () => void;
  setMicEnabled: (enabled: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  switchCamera: () => Promise<void>;
  localVideoTrack: ICameraVideoTrack | null;
  remoteVideoTrack: IRemoteVideoTrack | null;
  isBroadcasting: boolean;
  isWatching: boolean;
  error: string | null;
  currentStreamId: string | null;
  channelName: string | null;
}

export function useAgoraLive(): UseAgoraLiveReturn {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<IRemoteVideoTrack | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);

  // Cleanup all resources (stop tracks, leave client)
  const cleanupClient = useCallback(() => {
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.close().catch(() => {});
      localVideoTrackRef.current = null;
    }
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.close().catch(() => {});
      localAudioTrackRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.leave().catch(() => {});
      clientRef.current = null;
    }
    setLocalVideoTrack(null);
    setRemoteVideoTrack(null);
  }, []);

  // Start broadcasting as host (publisher)
  const startBroadcasting = useCallback(async (title: string, chName: string) => {
    try {
      cleanupClient();
      setError(null);

      if (!APP_ID) {
        setError('Agora APP_ID is not configured.');
        return null;
      }

      const user = useAuthStore.getState().user;

      // End any previously active stream by this host to prevent duplicates
      // in the discovery feed when they go live a second time.
      if (user?.uid) {
        try {
          const { getDocs, where, query: fsQuery } = await import('firebase/firestore');
          const staleQuery = fsQuery(
            collection(db, 'liveStreams'),
            where('hostId', '==', user.uid),
            where('status', '==', 'active')
          );
          const staleSnap = await getDocs(staleQuery);
          await Promise.all(
            staleSnap.docs.map((d) =>
              updateDoc(doc(db, 'liveStreams', d.id), { status: 'ended', endedAt: serverTimestamp() })
            )
          );
        } catch {
          // Non-critical — proceed even if cleanup fails
        }
      }

      // Create Firestore document first
      const liveStreamsRef = collection(db, 'liveStreams');
      const docRef = await addDoc(liveStreamsRef, {
        hostId: user?.uid || 'anonymous',
        hostName: user?.displayName || 'Anonymous',
        hostPhoto: user?.photoURL || null,
        channelName: chName,
        title,
        status: 'active',
        viewerCount: 0,
        startedAt: serverTimestamp(),
      });

      const streamId = docRef.id;
      setCurrentStreamId(streamId);
      setChannelName(chName);

      // Create Agora client in LIVE mode (not rtc) — this is what enables
      // proper host/audience role distinction so viewers receive the stream.
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await client.setClientRole('host');
      clientRef.current = client;

      const uid = user?.uid || Math.floor(Math.random() * 1000000).toString();

      // Fetch publisher token
      const tokenRes = await fetch('/api/agora-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: chName, uid, role: 'publisher' }),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({ error: 'Token fetch failed' }));
        throw new Error(errData.error || 'Failed to get token');
      }

      const { token } = await tokenRes.json();

      // Join channel as publisher
      await client.join(APP_ID, chName, token, uid);

      // Create and publish tracks
      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      localAudioTrackRef.current = microphoneTrack;
      localVideoTrackRef.current = cameraTrack;
      setLocalVideoTrack(cameraTrack);

      await client.publish([microphoneTrack, cameraTrack]);
      setIsBroadcasting(true);

      // Handle client errors
      client.on('error', (err) => {
        console.error('[useAgoraLive] Broadcasting error:', err);
        setError(`Broadcast error: ${err.reason || 'Unknown'}`);
      });

      return { channelName: chName, streamId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start broadcast';
      setError(message);
      cleanupClient();
      setIsBroadcasting(false);
      setCurrentStreamId(null);
      return null;
    }
  }, [cleanupClient]);

  // Stop broadcasting — always marks the Firestore stream as ended
  const stopBroadcasting = useCallback(async () => {
    // Use the hook's own state first, fall back to the zustand store in case
    // the hook's state was cleared before this is called (can happen if the
    // component re-mounts mid-stream).
    const streamId = currentStreamId || (await import('@/lib/store').then(m => m.useLiveStore.getState().currentStreamId));
    try {
      if (streamId) {
        await updateDoc(doc(db, 'liveStreams', streamId), {
          status: 'ended',
          endedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('[useAgoraLive] Error ending stream in Firestore:', err);
    } finally {
      cleanupClient();
      setIsBroadcasting(false);
      setCurrentStreamId(null);
      setChannelName(null);
      setError(null);
    }
  }, [currentStreamId, cleanupClient]);

  // Watch a stream as subscriber (audience)
  const watchStream = useCallback(async (streamId: string, chName: string) => {
    try {
      cleanupClient();
      setError(null);

      if (!APP_ID) {
        setError('Agora APP_ID is not configured.');
        return;
      }

      setCurrentStreamId(streamId);
      setChannelName(chName);

      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await client.setClientRole('audience');
      clientRef.current = client;

      const user = useAuthStore.getState().user;
      const uid = user?.uid || Math.floor(Math.random() * 1000000).toString();

      const tokenRes = await fetch('/api/agora-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: chName, uid, role: 'subscriber' }),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({ error: 'Token fetch failed' }));
        throw new Error(errData.error || 'Failed to get viewer token');
      }

      const { token } = await tokenRes.json();

      // Helper to subscribe to one remote user's tracks
      const subscribeToUser = async (remoteUser: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
        try {
          await client.subscribe(remoteUser, mediaType);
          if (mediaType === 'video' && remoteUser.videoTrack) {
            setRemoteVideoTrack(remoteUser.videoTrack as IRemoteVideoTrack);
          }
          if (mediaType === 'audio' && remoteUser.audioTrack) {
            remoteUser.audioTrack.play();
          }
        } catch (err) {
          console.error('[useAgoraLive] subscribe error:', err);
        }
      };

      // Set up future-publish listener BEFORE joining
      client.on('user-published', (remoteUser, mediaType) => {
        subscribeToUser(remoteUser, mediaType);
      });

      client.on('user-unpublished', (remoteUser: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
        if (mediaType === 'video') setRemoteVideoTrack(null);
      });

      client.on('user-left', () => {
        setRemoteVideoTrack(null);
      });

      client.on('error', (err) => {
        console.error('[useAgoraLive] Viewing error:', err);
        setError(`Stream error: ${err.reason || 'Unknown'}`);
      });

      // Join the channel
      await client.join(APP_ID, chName, token, uid);
      setIsWatching(true);

      // ── KEY FIX: Subscribe to users already in the channel ──────────────
      // The 'user-published' event only fires for tracks published AFTER we
      // joined. The host is already there, so we must check remoteUsers and
      // subscribe to each existing published track immediately.
      for (const remoteUser of client.remoteUsers) {
        if (remoteUser.hasVideo) {
          await subscribeToUser(remoteUser, 'video');
        }
        if (remoteUser.hasAudio) {
          await subscribeToUser(remoteUser, 'audio');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to watch stream';
      setError(message);
      cleanupClient();
      setIsWatching(false);
      setCurrentStreamId(null);
      setChannelName(null);
    }
  }, [cleanupClient]);

  // Toggle local mic on/off (host only — no-op if not broadcasting)
  const setMicEnabled = useCallback((enabled: boolean) => {
    localAudioTrackRef.current?.setEnabled(enabled).catch(() => {});
  }, []);

  // Toggle local camera on/off (host only — no-op if not broadcasting)
  const setCameraEnabled = useCallback((enabled: boolean) => {
    localVideoTrackRef.current?.setEnabled(enabled).catch(() => {});
  }, []);

  // Switch between front/back camera on mobile (host only).
  const switchCamera = useCallback(async () => {
    const track = localVideoTrackRef.current;
    if (!track) return;
    try {
      const cameras = await AgoraRTC.getCameras();
      if (cameras.length < 2) return; // only one camera available — nothing to switch to
      const currentLabel = track.getTrackLabel?.() || '';
      const nextCamera = cameras.find((c) => c.label !== currentLabel) || cameras[1];
      await track.setDevice(nextCamera.deviceId);
    } catch {
      // Some devices/browsers don't support switching mid-stream — fail silently
      // rather than crashing the live view.
    }
  }, []);

  // Leave the stream
  const leaveStream = useCallback(() => {
    cleanupClient();
    setIsWatching(false);
    setCurrentStreamId(null);
    setChannelName(null);
    setError(null);
  }, [cleanupClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupClient();
      setIsBroadcasting(false);
      setIsWatching(false);
    };
  }, []);

  return {
    startBroadcasting,
    stopBroadcasting,
    watchStream,
    leaveStream,
    setMicEnabled,
    setCameraEnabled,
    switchCamera,
    localVideoTrack,
    remoteVideoTrack,
    isBroadcasting,
    isWatching,
    error,
    currentStreamId,
    channelName,
  };
}
