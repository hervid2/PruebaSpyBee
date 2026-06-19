'use client';
/**
 * Global authentication store. Persists the session to a cookie (not
 * localStorage) so the Next.js middleware can read it server-side and gate
 * protected routes. Components subscribe here for the current user and auth state.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserRef } from '@/domain/models';

/** Authenticated user enriched with role and company beyond the base ref. */
export interface AuthUser extends UserRef {
  role: string;
  company: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
}

/**
 * Custom persist storage backed by `document.cookie`. Also writes a companion
 * `spybee-session` flag cookie that the middleware checks to authorize routes.
 * SSR-safe: every accessor no-ops when `document` is unavailable.
 */
function cookieStorage() {
  return createJSONStorage<AuthState>(() => ({
    getItem(name) {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? decodeURIComponent(match[2]) : null;
    },
    setItem(name, value) {
      if (typeof document === 'undefined') return;
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `spybee-session=1; path=/; max-age=86400; SameSite=Lax`;
    },
    removeItem(name) {
      if (typeof document === 'undefined') return;
      document.cookie = `${name}=; path=/; max-age=0`;
      document.cookie = `spybee-session=; path=/; max-age=0`;
    },
  }));
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'spybee-auth',
      storage: cookieStorage(),
    },
  ),
);
