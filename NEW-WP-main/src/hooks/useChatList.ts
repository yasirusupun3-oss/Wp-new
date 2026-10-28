'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/lib/store';
import type { UserProfile } from '@/lib/firebase';

export interface ChatListItem {
  chatId: string;
  otherUser: {
    uid: string;
    displayName: string;
    photoURL: string | null;
  };
  lastMessage: string;
  lastMessageTime: Date | null;
  lastMessageSender: string;
  unreadCount: number;
}

export function useChatList() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Derive isLoading: only loading when authenticated and haven't received data yet
  const isLoading = isAuthenticated && !hasLoaded;

  useEffect(() => {
    // When there is no authenticated user, nothing to subscribe to
    if (!user || !isAuthenticated) {
      return;
    }

    const currentUid = user.uid;

    // Query chat rooms where the current user is a participant, ordered by most recent message
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUid),
      orderBy('lastMessageTime', 'desc'),
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        // Build chat list items, fetching other user profiles in parallel
        const chatItems = await Promise.all(
          snapshot.docs.map(async (chatDoc) => {
            const chatData = chatDoc.data();
            const participants = (chatData.participants as string[]) || [];
            const chatId = chatDoc.id;

            // Find the other user's uid
            const otherUid = participants.find((p) => p !== currentUid);
            if (!otherUid) return null;

            // Fetch the other user's profile
            let otherUser: ChatListItem['otherUser'] = {
              uid: otherUid,
              displayName: 'Unknown',
              photoURL: null,
            };

            try {
              const userDoc = await getDoc(doc(db, 'users', otherUid));
              if (userDoc.exists()) {
                const profile = userDoc.data() as UserProfile;
                otherUser = {
                  uid: profile.uid,
                  displayName: profile.displayName,
                  photoURL: profile.photoURL,
                };
              }
            } catch {
              // Keep default "Unknown" profile if fetch fails
            }

            // Determine unread count for current user
            const unreadCount =
              (chatData.unreadCount as Record<string, number>)?.[currentUid] ?? 0;

            return {
              chatId,
              otherUser,
              lastMessage: chatData.lastMessage ?? '',
              lastMessageTime: chatData.lastMessageTime?.toDate?.() ?? null,
              lastMessageSender: chatData.lastMessageSender ?? '',
              unreadCount,
            } satisfies ChatListItem;
          }),
        );

        // Filter out nulls and sort by lastMessageTime descending
        const validItems = chatItems.filter((item): item is ChatListItem => item !== null);
        validItems.sort((a, b) => {
          const timeA = a.lastMessageTime?.getTime() ?? 0;
          const timeB = b.lastMessageTime?.getTime() ?? 0;
          return timeB - timeA;
        });

        setChatList(validItems);
        setHasLoaded(true);
      },
      (error) => {
        console.error('Error listening to chat list:', error);
        setHasLoaded(true);
      },
    );

    return () => unsubscribe();
  }, [user, isAuthenticated]);

  return { chatList, isLoading };
}
