import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware: cookie security flags + strip server info leakage.
 * HTTP security headers are set in next.config.js.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Harden every Set-Cookie emitted by API routes
  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    response.headers.delete('Set-Cookie');
    for (const cookie of setCookies) {
      response.headers.append('Set-Cookie', hardenCookie(cookie));
    }
  }

  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');

  return response;
}

function hardenCookie(raw: string): string {
  const lower = raw.toLowerCase();
  let cookie = raw;
  if (!lower.includes('secure')) cookie += '; Secure';
  if (!lower.includes('httponly')) cookie += '; HttpOnly';
  if (!lower.includes('samesite')) cookie += '; SameSite=Lax';
  else if (lower.includes('samesite=none') && !lower.includes('secure')) cookie += '; Secure';
  return cookie;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
