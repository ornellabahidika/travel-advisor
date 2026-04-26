"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "./types";

const STORAGE_KEY = "tripfinder-chats-v1";
const CHANGE_EVENT = "tripfinder:chats-changed";

type ChatStore = Record<string, ChatMessage[]>;

function chatKey(tripId: string, requestId: string): string {
  return `${tripId}__${requestId}`;
}

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
  "Got it, thanks for getting back so fast! 🙌",
  "Sounds good — really excited about this. What dates work best for you to chat more?",
  "Yes, totally agree. Anything I should pre-book or bring?",
  "Same here! What's your usual pace — early starts or slow mornings?",
  "Perfect. I'll start looking at flights on my end.",
  "Hey, really appreciate the reply. Looking forward to it!",
  "I'm flexible on most things — just let me know what you're thinking.",
];

function pickReply(seedSeed: string, alreadySent: number): string {
  let h = 0;
  const seed = seedSeed + ":" + alreadySent;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return REQUESTER_REPLIES[h % REQUESTER_REPLIES.length];
}

export function useChat(tripId: string, requestId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const key = chatKey(tripId, requestId);

  useEffect(() => {
    setMessages(read()[key] ?? []);
    const onChange = () => setMessages(read()[key] ?? []);
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [key]);

  const sendMessage = (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const store = read();
    const list = store[key] ?? [];
    const hostMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      sender: "host",
      body: trimmed,
      timestamp: Date.now(),
    };
    store[key] = [...list, hostMsg];
    write(store);

    // Simulate a reply after 2-3 seconds
    const replyDelay = 2000 + Math.random() * 1500;
    setTimeout(() => {
      const latest = read();
      const updated = latest[key] ?? [];
      const hostMessagesSoFar = updated.filter((m) => m.sender === "host").length;
      const reply: ChatMessage = {
        id: `m-${Date.now()}-r`,
        sender: "requester",
        body: pickReply(key, hostMessagesSoFar),
        timestamp: Date.now(),
      };
      latest[key] = [...updated, reply];
      write(latest);
    }, replyDelay);
  };

  return { messages, sendMessage };
}

export function unreadCount(tripId: string, requestId: string, lastSeen: number): number {
  const list = read()[chatKey(tripId, requestId)] ?? [];
  return list.filter((m) => m.sender === "requester" && m.timestamp > lastSeen).length;
}
