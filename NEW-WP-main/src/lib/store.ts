import { create } from 'zustand';

// ─── App Tab Navigation ─────────────────────────────
export type AppTab = 'chats' | 'video-calls' | 'calls' | 'wallet' | 'settings';

interface AppState {
  activeTab: AppTab;
  showLivePage: boolean;
  setShowLivePage: (show: boolean) => void;
  setActiveTab: (tab: AppTab) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'chats',
  showLivePage: false,
  setShowLivePage: (show) => set({ showLivePage: show }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

// ─── Auth State ─────────────────────────────────────
interface AuthState {
  user: {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string | null;
    coinBalance: number;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthState['user']) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

// ─── Chat State ─────────────────────────────────────
interface ChatState {
  selectedChatId: string | null;
  chatMessages: Record<string, any[]>;
  setSelectedChatId: (id: string | null) => void;
  addMessage: (chatId: string, message: any) => void;
  setMessages: (chatId: string, messages: any[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  selectedChatId: null,
  chatMessages: {},
  setSelectedChatId: (id) => set({ selectedChatId: id }),
  addMessage: (chatId, message) =>
    set((state) => ({
      chatMessages: {
        ...state.chatMessages,
        [chatId]: [...(state.chatMessages[chatId] || []), message],
      },
    })),
  setMessages: (chatId, messages) =>
    set((state) => ({
      chatMessages: { ...state.chatMessages, [chatId]: messages },
    })),
}));

// ─── Live State ─────────────────────────────────────
interface LiveState {
  isHosting: boolean;
  isViewing: boolean;
  currentChannel: string | null;
  currentStreamId: string | null;
  hostId: string | null;
  hostName: string | null;
  streamTitle: string | null;
  viewerCount: number;
  liveGifts: any[];
  liveMessages: any[];
  setHosting: (hosting: boolean, channel?: string, streamId?: string) => void;
  setViewing: (
    viewing: boolean,
    channel?: string,
    streamId?: string,
    hostId?: string,
    hostName?: string,
    title?: string
  ) => void;
  setViewerCount: (count: number | ((prev: number) => number)) => void;
  addLiveGift: (gift: any) => void;
  addLiveMessage: (msg: any) => void;
  setLiveGifts: (gifts: any[]) => void;
  setLiveMessages: (msgs: any[]) => void;
  clearLiveState: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  isHosting: false,
  isViewing: false,
  currentChannel: null,
  currentStreamId: null,
  hostId: null,
  hostName: null,
  streamTitle: null,
  viewerCount: 0,
  liveGifts: [],
  liveMessages: [],
  setHosting: (hosting, channel, streamId) =>
    set({ isHosting: hosting, currentChannel: channel || null, currentStreamId: streamId || null }),
  setViewing: (viewing, channel, streamId, hostId, hostName, title) =>
    set({
      isViewing: viewing,
      currentChannel: channel || null,
      currentStreamId: streamId || null,
      hostId: hostId || null,
      hostName: hostName || null,
      streamTitle: title || null,
    }),
  setViewerCount: (count) =>
    set((state) => ({
      viewerCount: typeof count === 'function' ? count(state.viewerCount) : count,
    })),
  addLiveGift: (gift) =>
    set((state) => ({ liveGifts: [...state.liveGifts, gift].slice(-20) })),
  addLiveMessage: (msg) =>
    set((state) => ({ liveMessages: [...state.liveMessages, msg].slice(-50) })),
  setLiveGifts: (gifts) => set({ liveGifts: gifts.slice(-20) }),
  setLiveMessages: (msgs) => set({ liveMessages: msgs.slice(-50) }),
  clearLiveState: () =>
    set({
      isHosting: false,
      isViewing: false,
      currentChannel: null,
      currentStreamId: null,
      hostId: null,
      hostName: null,
      streamTitle: null,
      viewerCount: 0,
      liveGifts: [],
      liveMessages: [],
    }),
}));

// ─── Wallet State ───────────────────────────────────
interface WalletState {
  coinBalance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: any[];
  setCoinBalance: (balance: number | ((prev: number) => number)) => void;
  addTransaction: (tx: any) => void;
  setTransactions: (txs: any[]) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  coinBalance: 0,
  totalEarned: 0,
  totalSpent: 0,
  transactions: [],
  setCoinBalance: (balance) =>
    set((state) => ({
      coinBalance: typeof balance === 'function' ? balance(state.coinBalance) : balance,
    })),
  addTransaction: (tx) =>
    set((state) => ({
      transactions: [tx, ...state.transactions].slice(0, 100),
    })),
  setTransactions: (txs) => set({ transactions: txs }),
}));

// ─── Calls State ─────────────────────────────────────
interface CallState {
  isInCall: boolean;
  callType: 'voice' | 'video' | null;
  callPartner: string | null;
  callStartTime: number | null;
  callDuration: number;
  setInCall: (inCall: boolean, type?: 'voice' | 'video' | null, partner?: string | null) => void;
  setCallDuration: (duration: number) => void;
  endCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  isInCall: false,
  callType: null,
  callPartner: null,
  callStartTime: null,
  callDuration: 0,
  setInCall: (inCall, type, partner) =>
    set({
      isInCall: inCall,
      callType: type || null,
      callPartner: partner || null,
      callStartTime: inCall ? Date.now() : null,
      callDuration: 0,
    }),
  setCallDuration: (duration) => set({ callDuration: duration }),
  endCall: () =>
    set({
      isInCall: false,
      callType: null,
      callPartner: null,
      callStartTime: null,
      callDuration: 0,
    }),
}));

// ─── Romantic Gifts Data ────────────────────────────
export interface RomanticGift {
  id: string;
  emoji: string;
  name: string;
  description: string;
  cost: number;
  animation: 'float' | 'burst' | 'rain' | 'spiral';
}

export const romanticGifts: RomanticGift[] = [
  { id: 'rose', emoji: '🌹', name: 'Rose', description: 'A single red rose', cost: 25, animation: 'float' },
  { id: 'bouquet', emoji: '💐', name: 'Bouquet', description: 'Beautiful flower bouquet', cost: 100, animation: 'burst' },
  { id: 'heart', emoji: '❤️', name: 'Heart', description: 'Big red heart', cost: 15, animation: 'float' },
  { id: 'chocolate', emoji: '🍫', name: 'Chocolate', description: 'Box of chocolates', cost: 50, animation: 'float' },
  { id: 'diamond', emoji: '💍', name: 'Diamond Ring', description: 'Sparkling diamond ring', cost: 500, animation: 'spiral' },
  { id: 'teddy', emoji: '🧸', name: 'Teddy Bear', description: 'Cute teddy bear', cost: 75, animation: 'float' },
  { id: 'wine', emoji: '🍷', name: 'Wine', description: 'Glass of red wine', cost: 60, animation: 'float' },
  { id: 'kiss', emoji: '💋', name: 'Kiss', description: 'Blowing a kiss', cost: 20, animation: 'float' },
  { id: 'crown', emoji: '👑', name: 'Crown', description: 'Royal crown', cost: 1000, animation: 'spiral' },
  { id: 'perfume', emoji: '🌸', name: 'Perfume', description: 'Designer perfume', cost: 200, animation: 'rain' },
  { id: 'love_letter', emoji: '💌', name: 'Love Letter', description: 'Handwritten love letter', cost: 30, animation: 'float' },
  { id: 'cake', emoji: '🎂', name: 'Cake', description: 'Birthday cake', cost: 150, animation: 'burst' },
];
