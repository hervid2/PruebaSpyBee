// Short-lived and single-use per incident upload (requirements.md §1.7 —
// "a single-use URL with a short expiration").
export const DEFAULT_PRESIGNED_URL_EXPIRES_IN_SECONDS = 5 * 60;

/**
 * Reads get their own, longer expiry (F9.6). An upload URL is spent within
 * seconds of being issued; a download URL has to outlive however long someone
 * leaves the gallery open, and a tile whose URL expired mid-session is a
 * broken image with no way to recover but a reload.
 */
export const DEFAULT_PRESIGNED_DOWNLOAD_EXPIRES_IN_SECONDS = 30 * 60;

/**
 * Download URLs are signed as of the start of the current window rather than
 * "now", which makes every request inside one window produce a byte-identical
 * URL (F9.6).
 *
 * That identity is the whole point. The gallery renders through `next/image`,
 * so each URL is fetched and re-encoded by the image optimizer and cached
 * under the URL as its key — and a signature containing a fresh `X-Amz-Date`
 * per request is a fresh cache key per request, meaning every page view
 * re-downloads and re-optimizes every photo, and the browser cache never hits
 * either. Rounding the signing time collapses that back to one optimization
 * per image per window.
 *
 * Kept well under `DEFAULT_PRESIGNED_DOWNLOAD_EXPIRES_IN_SECONDS`, so a URL
 * handed out at the very end of a window still has most of its life left.
 */
export const PRESIGNED_DOWNLOAD_SIGNING_WINDOW_SECONDS = 10 * 60;
