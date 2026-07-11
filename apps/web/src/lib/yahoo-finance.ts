/**
 * Yahoo Finance unofficial API helper — handles cookie + crumb authentication.
 * The crumb is cached in module scope for ~55 min; Next.js server keeps it
 * warm between requests.
 */

let _crumb = "";
let _cookie = "";
let _fetchedAt = 0;
const CRUMB_TTL_MS = 55 * 60_000; // 55 min (YF crumbs last ~1 h)

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function refreshCrumb(): Promise<void> {
  // Step 1 — hit the consent/landing page to get initial cookies
  const homeRes = await fetch("https://fc.yahoo.com/", {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });

  // Collect all Set-Cookie values into a single Cookie header string
  const rawCookies: string[] = [];
  homeRes.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie") {
      // Each value may contain "; Path=..." — keep only key=value part
      const pair = value.split(";")[0].trim();
      if (pair) rawCookies.push(pair);
    }
  });
  _cookie = rawCookies.join("; ");

  // Step 2 — exchange the cookie for a crumb
  const crumbRes = await fetch(
    "https://query1.finance.yahoo.com/v1/test/getcrumb",
    {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": UA, Cookie: _cookie },
    },
  );

  if (!crumbRes.ok) {
    throw new Error(`getcrumb returned ${crumbRes.status}`);
  }

  _crumb = (await crumbRes.text()).trim();
  _fetchedAt = Date.now();
}

export async function yahooFetch(url: string): Promise<Response> {
  // Refresh crumb if stale or missing
  if (!_crumb || Date.now() - _fetchedAt > CRUMB_TTL_MS) {
    await refreshCrumb();
  }

  const sep = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${sep}crumb=${encodeURIComponent(_crumb)}`;

  const res = await fetch(fullUrl, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Cookie: _cookie,
    },
  });

  // On 401 try once more with a fresh crumb (crumb expired mid-cache period)
  if (res.status === 401) {
    await refreshCrumb();
    const sep2 = url.includes("?") ? "&" : "?";
    return fetch(`${url}${sep2}crumb=${encodeURIComponent(_crumb)}`, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Cookie: _cookie,
      },
    });
  }

  return res;
}
