/**
 * Thin fetch wrapper around the real FlyWorkFlow backend. Framework-agnostic
 * (no Zustand, no `next/headers`) so it works from both Server Components,
 * which pass down a token read from the cookie, and client code, which
 * supplies a refresh callback for a one-shot silent retry on 401.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RefreshFn = () => Promise<string | null>;

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  accessToken?: string | null;
  /** Skips the silent-refresh retry — used by /auth/* calls to avoid loops. */
  skipAuthRetry?: boolean;
}

async function parseErrorBody(res: Response): Promise<{ message: string; details?: string[] }> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      return { message: data.message[0] ?? res.statusText, details: data.message };
    }
    return { message: typeof data.message === 'string' ? data.message : res.statusText };
  } catch {
    return { message: res.statusText };
  }
}

function rawFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const { body, accessToken, headers, ...rest } = options;
  return fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Calls the backend and returns the parsed JSON body (or `undefined` for a
 * 204). On a 401, if `onUnauthorized` is provided it's used to obtain a fresh
 * access token and the request is retried exactly once before giving up.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
  onUnauthorized?: RefreshFn,
): Promise<T> {
  let res = await rawFetch(path, options);

  if (res.status === 401 && onUnauthorized && !options.skipAuthRetry) {
    const freshToken = await onUnauthorized();
    if (freshToken) {
      res = await rawFetch(path, { ...options, accessToken: freshToken });
    }
  }

  if (!res.ok) {
    const { message, details } = await parseErrorBody(res);
    throw new ApiError(res.status, message, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Resolves to `null` when the call is refused with a 403, and rethrows
 * anything else.
 *
 * Exists so a role-gated page can pick its fallback UI *outside* the
 * try/catch that guards the fetch (F9.7). Wrapping the JSX in the `try`
 * instead — what `/historial` and `/papelera` used to do — is what
 * `react-hooks/error-boundaries` flags, and correctly: React builds an
 * element eagerly but renders it later, so a `catch` around a `return
 * <View />` never sees the render errors it looks like it is catching, only
 * the fetch's. Narrowing the block to the await says exactly that, and a
 * real render error now reaches the error boundary that can handle it.
 */
export async function nullIfForbidden<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) return null;
    throw err;
  }
}
