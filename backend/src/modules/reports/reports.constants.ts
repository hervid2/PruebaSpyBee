/**
 * Header alternative to `?token=` on `GET /reports/dashboard-data` (F9.5).
 *
 * The query parameter stays, and stays supported: the endpoint exists so a
 * URL can be pasted once into Power BI's Web connector or Looker Studio, and
 * some of those paths accept nothing but a URL. But a credential in a URL
 * reaches places a header never does — API Gateway access logs, browser
 * history, the `Referer` on anything the response links to, and the clipboard
 * of whoever shares the link. This app does not log it, which bounds the
 * damage without removing it.
 *
 * So: a caller that *can* set a header should, and now can. The header wins
 * when both are present, because the more careful call should not be
 * downgraded by a stale query parameter left on the URL.
 */
export const DATA_TOKEN_HEADER = 'x-data-token';
