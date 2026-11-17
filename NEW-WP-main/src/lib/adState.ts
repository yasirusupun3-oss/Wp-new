// Local-only cache of "how many ads have I watched today" so the UI can
// show an up-to-date count instantly without a round trip. This is NOT the
// source of truth for the daily cap — /api/coins/ad-reward and
// /api/coins/daily-bonus both check the user's real Firestore fields
// (adsWatchedToday / lastAdDate / lastDailyBonus) and will reject a request
// past the limit even if this local cache is stale or was cleared.

export const AD_COINS = 50;
export const MAX_ADS_PER_DAY = 10;

const STORAGE_KEY = 'wp_ad_state';

export interface AdState {
  date: string; // 'YYYY-MM-DD' — resets daily
  adsWatchedToday: number;
  lastDailyBonusDone: boolean;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadAdState(): AdState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdState;
      if (parsed.date === todayStr()) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { date: todayStr(), adsWatchedToday: 0, lastDailyBonusDone: false };
}

export function saveAdState(state: AdState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

