import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (prevent re-initialization in dev with HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;

// Type definitions for Firestore documents
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  coinBalance: number;
  totalEarned: number;
  totalSpent: number;
  isLive: boolean;
  liveChannelName: string | null;
  createdAt: Date;
  lastSeen: Date;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  text: string;
  type: 'text' | 'image' | 'gift';
  giftData?: GiftData;
  createdAt: Date;
  read: boolean;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageSender: string;
  unreadCount: Record<string, number>;
  updatedAt: Date;
}

export interface GiftData {
  giftId: string;
  giftName: string;
  giftEmoji: string;
  coinValue: number;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  timestamp: Date;
}

export interface LiveStream {
  id: string;
  hostId: string;
  hostName: string;
  hostPhoto: string | null;
  channelName: string;
  title: string;
  viewerCount: number;
  totalGifts: number;
  totalCoins: number;
  isLive: boolean;
  startedAt: Date;
  thumbnailURL: string | null;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  type: 'purchase' | 'gift_sent' | 'gift_received' | 'withdrawal';
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  createdAt: Date;
}
