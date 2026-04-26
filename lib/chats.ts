"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "./types";

const STORAGE_KEY = "tripfinder-chats-v1";
const CHANGE_EVENT = "tripfinder:chats-changed";

type ChatStore = Record<string, ChatMessage[]>;

function read(): ChatStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatStore) : {};
  } catch {
    return {};
  }
}

function write(store: ChatStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const REQUESTER_REPLIES = [
  "Got it, thanks! 🙌",
  "Sounds good — I'm in.",
  "Yes, agree. What dates work for everyone?",
  "Same here. What's the pace looking like — early starts or slow mornings?",
  "Perfect. I'll start looking at flights tonight.",
  "Hey all — really excited about this. 🙌",
  "I'm flexible on most things, just let me know what's the plan.",
  "Quick q — anyone want to share an Airbnb to keep costs down?",
  "Just chiming in — agreed with the above. Down for whatever.",
  "Sounds great. Adding it to my calendar now.",
];

function pickReplyText(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return REQUESTER_REPLIES[h % REQUESTER_REPLIES.length];
}

export type ChatParticipant = {
  id: string; // "host" or requester id
  name: string;
  isHost?: boolean;
};

export function useGroupChat(tripId: string, participants: ChatParticipant[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages(read()[tripId] ?? []);
    const onChange = () => setMessages(read()[tripId] ?? []);
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [tripId]);

  const sendAsHost = (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const host = participants.find((p) => p.isHost);
    if (!host) return;
    const store = read();
    const list = store[tripId] ?? [];
    const hostMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      senderId: host.id,
      senderName: host.name,
      body: trimmed,
      timestamp: Date.now(),
    };
    store[tripId] = [...list, hostMsg];
    write(store);

    // Simulate one (or sometimes two) participant replies
    const others = participants.filter((p) => !p.isHost);
    if (others.length === 0) return;

    const firstDelay = 1500 + Math.random() * 1500;
    setTimeout(() => {
      const replier = others[Math.floor(Math.random() * others.length)];
      const latest = read();
      const updated = latest[tripId] ?? [];
      const replyText = pickReplyText(`${tripId}:${replier.id}:${updated.length}`);
      const reply: ChatMessage = {
        id: `m-${Date.now()}-r1`,
        senderId: replier.id,
        senderName: replier.name,
        body: replyText,
        timestamp: Date.now(),
      };
      latest[tripId] = [...updated, reply];
      write(latest);

      // ~30% chance a second participant chimes in
      if (others.length >= 2 && Math.random() < 0.3) {
        const secondDelay = 1200 + Math.random() * 1500;
        setTimeout(() => {
          const remaining = others.filter((p) => p.id !== replier.id);
          const second = remaining[Math.floor(Math.random() * remaining.length)];
          const next = read();
          const nextUpdated = next[tripId] ?? [];
          const secondText = pickReplyText(`${tripId}:${second.id}:${nextUpdated.length}`);
          const secondReply: ChatMessage = {
            id: `m-${Date.now()}-r2`,
            senderId: second.id,
            senderName: second.name,
            body: secondText,
            timestamp: Date.now(),
          };
          next[tripId] = [...nextUpdated, secondReply];
          write(next);
        }, secondDelay);
      }
    }, firstDelay);
  };

  return { messages, sendAsHost };
}
