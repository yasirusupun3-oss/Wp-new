import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Request true browser fullscreen (hides the address bar / browser chrome
 * on mobile) for an immersive live-streaming view. Best called directly
 * inside a user-gesture handler (e.g. an onClick), since most browsers
 * only grant fullscreen requests made synchronously within one.
 * Fails silently if unsupported or denied — this is a nice-to-have, not
 * something that should ever block the live view from opening.
 */
export function requestAppFullscreen() {
  try {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (document.fullscreenElement) return;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  } catch {
    // Fullscreen isn't available (e.g. iOS Safari, or user gesture
    // requirement wasn't met) — the live view still works, just windowed.
  }
}

/** Exit fullscreen if currently active. Safe to call even if not in fullscreen. */
export function exitAppFullscreen() {
  try {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  } catch {
    // No-op
  }
}

