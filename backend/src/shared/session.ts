import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseCookie } from 'cookie';
import type { Request, Response, CookieOptions } from 'express';
import { authConfig } from '../config/auth.js';

export const newToken = (): string => randomBytes(32).toString('base64url');
export const digestToken = (value: string): string => createHash('sha256').update(value).digest('hex');
export const csrfToken = (token: string): string => createHmac('sha256', token).update('dnb-credi:csrf:v1').digest('base64url');
export function equalToken(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function readToken(request: Request, name: string): string | undefined {
  const value = parseCookie(request.headers.cookie ?? '')[name];
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
const cookieOptions: CookieOptions = {
  httpOnly: true, secure: authConfig.secureCookies, sameSite: authConfig.sameSite, path: '/',
};
export function setSessionCookie(response: Response, token: string): void {
  response.cookie(authConfig.sessionCookie, token, { ...cookieOptions, maxAge: authConfig.sessionSeconds * 1000 });
  response.clearCookie(authConfig.csrfCookie, cookieOptions);
}
export function clearSessionCookie(response: Response): void {
  response.clearCookie(authConfig.sessionCookie, cookieOptions);
  response.clearCookie(authConfig.csrfCookie, cookieOptions);
}
export function issueCsrf(request: Request, response: Response): void {
  let token = readToken(request, authConfig.sessionCookie);
  if (!token) {
    token = newToken();
    response.cookie(authConfig.csrfCookie, token, { ...cookieOptions, maxAge: 600000 });
  }
  response.json({ csrfToken: csrfToken(token) });
}
