'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  query,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore, useWalletStore } from '@/lib/store';
import { generateChatId, getChatMessagesRef, ensureChatRoom, getChatRoomRef } from '@/lib/firebase-helpers';
import type { UserProfile } from '@/lib/firebase';

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  text: string;
  type: 'text' | 'gift';
  giftData?: {
    giftId: string;
    giftName: string;
    giftEmoji: string;
    coinValue: number;
  };
  createdAt: Date;
  read: boolean;
}

interface OtherUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

export function useMessages(otherUserId: string) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [messages, setMessages] = useState<Message[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);

  // Derive isLoading: only loading when authenticated and haven't received data yet
  const isLoading = isAuthenticated && !hasLoaded;

  useEffect(() => {
    // When there is no authenticated user, nothing to subscribe to
    if (!user || !isAuthenticated) {
      return;
    }

    const currentUid = user.uid;
    const chatId = generateChatId(currentUid, otherUserId);
    const messagesRef = getChatMessagesRef(chatId);

    // Ensure the chat room exists
    ensureChatRoom(chatId, [currentUid, otherUserId]).catch((err) => {
      console.error('Failed to ensure chat room:', err);
    });

    // Fetch the other user's profile
    getDoc(doc(db, 'users', otherUserId))
      .then((userDoc) => {
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          setOtherUser({
            uid: profile.uid,
            displayName: profile.displayName,
            photoURL: profile.photoURL,
          });
        } else {
          setOtherUser({ uid: otherUserId, displayName: 'Unknown', photoURL: null });
        }
      })
      .catch(() => {
        setOtherUser({ uid: otherUserId, displayName: 'Unknown', photoURL: null });
      });

    // Listen to messages in real time, ordered by creation time ascending
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const msgs: Message[] = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data();
          return {
            id: snapshotDoc.id,
            senderId: data.senderId ?? '',
            senderName: data.senderName ?? '',
            senderPhoto: data.senderPhoto ?? null,
            text: data.text ?? '',
            type: data.type ?? 'text',
            giftData: data.giftData
              ? {
                  giftId: data.giftData.giftId,
                  giftName: data.giftData.giftName,
                  giftEmoji: data.giftData.giftEmoji,
                  coinValue: data.giftData.coinValue,
                }
              : undefined,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            read: data.read ?? false,
          };
        });

        setMessages(msgs);
        setHasLoaded(true);

        // Mark messages from the other user as read
        const unreadMsgs = msgs.filter(
          (m) => m.senderId === otherUserId && !m.read,
        );
        if (unreadMsgs.length > 0) {
          unreadMsgs.forEach((m) => {
            const msgDocRef = doc(messagesRef, m.id);
            updateDoc(msgDocRef, { read: true }).catch(() => {
              // Silently ignore mark-as-read failures
            });
          });

          // Reset unread count for current user in the chat room
          const chatRoomRef = getChatRoomRef(chatId);
          updateDoc(chatRoomRef, {
            [`unreadCount.${currentUid}`]: 0,
          }).catch(() => {
            // Silently ignore
          });
        }
      },
      (error) => {
        console.error('Error listening to messages:', error);
        setHasLoaded(true);
      },
    );

    return () => unsubscribe();
  }, [otherUserId, user, isAuthenticated]);

  const sendMessage = useCallback(
    async (text: string) => {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;
      if (!text.trim()) return;

      const currentUid = currentUser.uid;
      const chatId = generateChatId(currentUid, otherUserId);
      const messagesRef = getChatMessagesRef(chatId);

      // Add the message document
      const messageDoc = await addDoc(messagesRef, {
        senderId: currentUid,
        senderName: currentUser.displayName,
        senderPhoto: currentUser.photoURL,
        text: text.trim(),
        type: 'text',
        createdAt: serverTimestamp(),
        read: false,
      });

      // Bill the sender for this message (server-side atomic deduction)
      try {
        const res = await fetch('/api/coins/deduct-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUid, chatId, messageId: messageDoc.id }),
        });
        const data = await res.json();
        if (data.success && typeof data.balanceAfter === 'number') {
          useWalletStore.getState().setCoinBalance(data.balanceAfter);
        }
      } catch {
        // Silently ignore billing failures — message was still delivered
      }

      // Increment unread count for the other user in the chat room
      const chatRoomRef = getChatRoomRef(chatId);
      try {
        const chatDoc = await getDoc(chatRoomRef);
        const currentUnread = chatDoc.exists()
          ? (chatDoc.data().unreadCount?.[otherUserId] ?? 0)
          : 0;

        await updateDoc(chatRoomRef, {
          lastMessage: text.trim(),
          lastMessageTime: serverTimestamp(),
          lastMessageSender: currentUid,
          updatedAt: serverTimestamp(),
          [`unreadCount.${otherUserId}`]: currentUnread + 1,
        });
      } catch {
        // Fallback: update without unread count if read fails
        await updateDoc(chatRoomRef, {
          lastMessage: text.trim(),
          lastMessageTime: serverTimestamp(),
          lastMessageSender: currentUid,
          updatedAt: serverTimestamp(),
        }).catch(() => {
          // Silently ignore
        });
      }
    },
    [otherUserId],
  );

  const sendMessageWithGift = useCallback(
    async (
      text: string,
      gift: { emoji: string; name: string; cost: number },
    ) => {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      const currentUid = currentUser.uid;
      const chatId = generateChatId(currentUid, otherUserId);
      const messagesRef = getChatMessagesRef(chatId);

      const displayText = text.trim() || `${gift.emoji} ${gift.name}`;

      // Add the gift message document
      await addDoc(messagesRef, {
        senderId: currentUid,
        senderName: currentUser.displayName,
        senderPhoto: currentUser.photoURL,
        text: displayText,
        type: 'gift',
        giftData: {
          giftId: gift.name.toLowerCase().replace(/\s+/g, '_'),
          giftName: gift.name,
          giftEmoji: gift.emoji,
          coinValue: gift.cost,
        },
        createdAt: serverTimestamp(),
        read: false,
      });

      // Update the chat room with the latest message info
      const chatRoomRef = getChatRoomRef(chatId);
      await updateDoc(chatRoomRef, {
        lastMessage: displayText,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: currentUid,
        updatedAt: serverTimestamp(),
      }).catch(() => {
        // Silently ignore
      });
    },
    [otherUserId],
  );

  return {
    messages,
    sendMessage,
    sendMessageWithGift,
    isLoading,
    otherUser,
  };
}
