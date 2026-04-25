"use client";

import { useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  provider: "google" | "email";
  createdAt: number;
};

const STORAGE_KEY = "tripfinder-auth-v1";
const CHANGE_EVENT = "tripfinder:auth-changed";

function read(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function write(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(read());
    const onChange = () => setUser(read());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const signInWithGoogle = () => {
    write({
      id: `google-${Date.now()}`,
      name: "Demo Google User",
      email: "demo.user@gmail.com",
      provider: "google",
      createdAt: Date.now(),
    });
  };

  const signUpWithEmail = (name: string, email: string) => {
    write({
      id: `email-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      provider: "email",
      createdAt: Date.now(),
    });
  };

  const signInWithEmail = (email: string) => {
    const existingName = email.split("@")[0];
    write({
      id: `email-${Date.now()}`,
      name: existingName,
      email: email.trim().toLowerCase(),
      provider: "email",
      createdAt: Date.now(),
    });
  };

  const signOut = () => write(null);

  return { user, signInWithGoogle, signUpWithEmail, signInWithEmail, signOut };
}
