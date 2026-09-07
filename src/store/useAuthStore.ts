'use client';
/**
 * Global authentication store. The access token lives in memory (this
 * store), not in a persisted `zustand/middleware` cookie — it's mirrored into
 * a short, non-`httpOnly` cookie purely so the Edge middleware can verify it
 * and Server Components can forward it (see `lib/auth-cookie.ts`), not as the
 * source of truth. `hydrateFromCookie` reconciles that mirror (or a silent
 * refresh) into this store once per page load.
 */
import { create } from 'zustand';
import type { UserRef } from '@/domain/models';
import { decodeJwtExp, isJwtExpired } from '@/lib/jwt';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-cookie';
import * as authService from '@/services/auth.service';

/** Authenticated user enriched with role and organization beyond the base ref. */
export interface AuthUser extends UserRef {
  role: string;
  orgId: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  login: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => Promise<void>;
  hydrateFromCookie: () => Promise<void>;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function writeAccessTokenCookie(token: string) {
  if (typeof document === 'undefined') return;
  const exp = decodeJwtExp(token);
  const maxAge = exp ? Math.max(exp - Math.floor(Date.now() / 1000), 0) : 900;
  // `Secure` in production, and conditional rather than unconditional because
  // a `Secure` cookie is silently dropped over plain HTTP — which is what
  // local dev and the CI e2e run are (F9.4, same reasoning as the backend's
  // `setRefreshCookie`). Without it, one downgraded request is enough to put
  // a live access token on the wire in the clear.
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function clearAccessTokenCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  hydrated: false,

  login: (user, accessToken) => {
    writeAccessTokenCookie(accessToken);
    set({ user, accessToken, isAuthenticated: true, hydrated: true });
  },

  setAccessToken: (token) => {
    writeAccessTokenCookie(token);
    set({ accessToken: token, isAuthenticated: true });
  },

  // Applied after a successful profile update so the TopBar/sidebar avatar
  // and name reflect the change immediately, without re-fetching /users/me.
  updateUser: (patch) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...patch } });
  },

  logout: async () => {
    await authService.logout(get().accessToken);
    clearAccessTokenCookie();
    set({ user: null, accessToken: null, isAuthenticated: false, hydrated: true });
  },

  // Called once on mount by AuthBootstrap. Tries the cookie mirror first (no
  // network round-trip needed when it's still fresh), then falls back to a
  // silent refresh via the httpOnly cookie, then gives up as logged-out.
  hydrateFromCookie: async () => {
    if (get().hydrated) return;

    const cookieToken = readCookie(ACCESS_TOKEN_COOKIE);
    if (cookieToken && !isJwtExpired(cookieToken)) {
      try {
        const user = await authService.getMe(cookieToken);
        set({ user, accessToken: cookieToken, isAuthenticated: true, hydrated: true });
        return;
      } catch {
        // Rejected by the backend despite looking unexpired (revoked, clock skew) — fall through.
      }
    }

    const freshToken = await authService.refresh();
    if (freshToken) {
      try {
        const user = await authService.getMe(freshToken);
        writeAccessTokenCookie(freshToken);
        set({ user, accessToken: freshToken, isAuthenticated: true, hydrated: true });
        return;
      } catch {
        // Fall through to logged-out below.
      }
    }

    clearAccessTokenCookie();
    set({ user: null, accessToken: null, isAuthenticated: false, hydrated: true });
  },
}));

/**
 * Refresh callback handed to `apiFetch` by client-side services for their
 * silent-retry-on-401. Lives here (not api-client.ts) because it's the one
 * place allowed to know about the Zustand store.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const freshToken = await authService.refresh();
  if (freshToken) useAuthStore.getState().setAccessToken(freshToken);
  return freshToken;
}
