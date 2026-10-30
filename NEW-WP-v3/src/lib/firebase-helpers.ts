import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Generate a consistent chat ID from two user IDs.
 * Sorts lexicographically so the same pair always produces the same ID.
 */
export function generateChatId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

/**
 * Get a reference to the messages sub-collection for a given chat room.
 * Path: chats/{chatId}/messages
 */
export function getChatMessagesRef(chatId: string): CollectionReference {
  return collection(db, 'chats', chatId, 'messages');
}

/**
 * Get a document reference to a specific chat room.
 * Path: chats/{chatId}
 */
export function getChatRoomRef(chatId: string): DocumentReference {
  return doc(db, 'chats', chatId);
}

/**
 * Get a document reference to a user profile.
 * Path: users/{uid}
 */
export function getUserRef(uid: string): DocumentReference {
  return doc(db, 'users', uid);
}

/**
 * Get a reference to the top-level liveStreams collection.
 */
export function getLiveStreamsRef(): CollectionReference {
  return collection(db, 'liveStreams');
}

/**
 * Create or ensure a chat room document exists.
 * Uses setDoc with merge so existing rooms are not overwritten.
 *
 * Firestore structure:
 * {
 *   participants: string[],
 *   lastMessage: string,
 *   lastMessageTime: timestamp,
 *   lastMessageSender: string,
 *   unreadCount: Record<string, number>,
 *   updatedAt: timestamp
 * }
 */
export async function ensureChatRoom(
  chatId: string,
  participantIds: string[],
  lastMessage?: string,
): Promise<void> {
  const roomRef = getChatRoomRef(chatId);

  const roomData: Record<string, unknown> = {
    participants: participantIds,
    updatedAt: serverTimestamp(),
  };

  // Only set lastMessage fields if a message is provided
  if (lastMessage !== undefined) {
    roomData.lastMessage = lastMessage;
    roomData.lastMessageTime = serverTimestamp();
  }

  await setDoc(roomRef, roomData, { merge: true });
}
