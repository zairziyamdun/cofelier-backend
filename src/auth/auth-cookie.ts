import type { CookieOptions } from 'express';

import type { Env } from '../config/env';

export const ACCESS_TOKEN_COOKIE = 'access_token';

type CookieEnv = Pick<Env, 'NODE_ENV' | 'JWT_TTL_SECONDS' | 'COOKIE_DOMAIN'>;

// httpOnly — токен недоступен JS страницы; lax — уходит с сайта на API того же домена.
export function accessTokenCookieOptions(env: CookieEnv): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    domain: env.COOKIE_DOMAIN,
    maxAge: env.JWT_TTL_SECONDS * 1000,
  };
}

// Токен из сырого заголовка Cookie — для WebSocket, где нет cookie-parser.
export function readAccessToken(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === ACCESS_TOKEN_COOKIE) {
      return decodeURIComponent(value.join('='));
    }
  }
  return null;
}
