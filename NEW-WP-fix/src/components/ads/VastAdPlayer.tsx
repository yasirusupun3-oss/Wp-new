'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * Plays a real video ad from a VAST tag URL and only calls onComplete once
 * the video has actually finished playing — there is no skip button and no
 * fixed timer standing in for "watched the ad". If the VAST tag can't be
 * loaded or parsed (network error, empty response, ad blocker, no fill),
 * onError fires so the caller can decide what to do (e.g. let the user
 * close without a reward, or try a different ad slot).
 */

interface Props {
  vastTagUrl: string;
  onComplete: () => void;
  onError: (reason: string) => void;
}

interface ParsedVast {
  mediaFileUrl: string;
  impressionUrls: string[];
  trackingUrls: Partial<Record<'start' | 'firstQuartile' | 'midpoint' | 'thirdQuartile' | 'complete', string[]>>;
}

const FETCH_TIMEOUT_MS = 10000;
const MAX_WRAPPER_REDIRECTS = 3;

function fireTrackingPixel(url: string) {
  // Tracking pixels are fire-and-forget GETs — the ad network counts the
  // request itself, no response body is used.
  try {
    const img = new Image();
    img.src = url;
  } catch {
    /* non-critical */
  }
}

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`VAST request failed (${res.status})`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseVastXml(xmlText: string): { wrapperUri: string | null; parsed: ParsedVast | null } {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) return { wrapperUri: null, parsed: null };

  // A VAST "Wrapper" points to another VAST document instead of containing
  // a playable ad itself — common when the tag comes from an ad exchange
  // that redirects to whichever network actually fills the impression.
  const wrapperUriEl = doc.querySelector('Wrapper > VASTAdTagURI');
  if (wrapperUriEl?.textContent?.trim()) {
    return { wrapperUri: wrapperUriEl.textContent.trim(), parsed: null };
  }

  const mediaFiles = Array.from(doc.querySelectorAll('MediaFile'));
  if (mediaFiles.length === 0) return { wrapperUri: null, parsed: null };

  // Prefer a progressive MP4 (plays directly in a <video> tag); fall back
  // to whatever's first if nothing declares an mp4 type.
  const mp4 = mediaFiles.find((el) => (el.getAttribute('type') || '').includes('mp4'));
  const chosen = mp4 || mediaFiles[0];
  const mediaFileUrl = chosen.textContent?.trim();
  if (!mediaFileUrl) return { wrapperUri: null, parsed: null };

  const impressionUrls = Array.from(doc.querySelectorAll('Impression'))
    .map((el) => el.textContent?.trim())
    .filter((v): v is string => !!v);

  const trackingUrls: ParsedVast['trackingUrls'] = {};
  doc.querySelectorAll('Tracking').forEach((el) => {
    const event = el.getAttribute('event') as keyof ParsedVast['trackingUrls'] | null;
    const url = el.textContent?.trim();
    if (!event || !url) return;
    if (!trackingUrls[event]) trackingUrls[event] = [];
    trackingUrls[event]!.push(url);
  });

  return { wrapperUri: null, parsed: { mediaFileUrl, impressionUrls, trackingUrls } };
}

async function resolveVast(tagUrl: string, redirectsLeft = MAX_WRAPPER_REDIRECTS): Promise<ParsedVast> {
  const xml = await fetchWithTimeout(tagUrl);
  const { wrapperUri, parsed } = parseVastXml(xml);
  if (parsed) return parsed;
  if (wrapperUri && redirectsLeft > 0) return resolveVast(wrapperUri, redirectsLeft - 1);
  throw new Error('No playable ad in VAST response');
}

export default function VastAdPlayer({ vastTagUrl, onComplete, onError }: Props) {
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [progress, setProgress] = useState(0); // 0–100
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackingRef = useRef<ParsedVast['trackingUrls']>({});
  const firedQuartilesRef = useRef<Set<string>>(new Set());
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    resolveVast(vastTagUrl)
      .then((vast) => {
        if (cancelled) return;
        trackingRef.current = vast.trackingUrls;
        vast.impressionUrls.forEach(fireTrackingPixel);
        if (videoRef.current) {
          videoRef.current.src = vast.mediaFileUrl;
        }
        setStatus('playing');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        onError(err instanceof Error ? err.message : 'Failed to load ad');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vastTagUrl]);

  const fireQuartile = useCallback((key: keyof ParsedVast['trackingUrls']) => {
    if (firedQuartilesRef.current.has(key)) return;
    firedQuartilesRef.current.add(key);
    (trackingRef.current[key] || []).forEach(fireTrackingPixel);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    setProgress(pct);
    if (pct >= 25) fireQuartile('firstQuartile');
    if (pct >= 50) fireQuartile('midpoint');
    if (pct >= 75) fireQuartile('thirdQuartile');
  }, [fireQuartile]);

  const handlePlay = useCallback(() => {
    fireQuartile('start');
  }, [fireQuartile]);

  const handleEnded = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    fireQuartile('complete');
    onComplete();
  }, [fireQuartile, onComplete]);

  const handleVideoError = useCallback(() => {
    setStatus('error');
    onError('Ad video failed to play');
  }, [onError]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        muted={muted}
        playsInline
        // Intentionally no `controls` — this is a rewarded ad, not a
        // regular video: no seeking, no scrubbing past the content.
        onPlay={handlePlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleVideoError}
        onContextMenu={(e) => e.preventDefault()}
      />

      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/50 text-xs">Loading ad…</p>
        </div>
      )}

      {status === 'playing' && (
        <>
          <button
            onClick={() => setMuted((m) => !m)}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full bg-[#25D366] transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

