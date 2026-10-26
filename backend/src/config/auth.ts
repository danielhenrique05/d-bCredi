import { env } from './env.js';

function integer(name: string, fallback: number, min: number, max: number): number {
  const value = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`Configuração inválida: ${name}.`);
  }
  return Number(value);
}

const origins = (process.env.AUTH_ALLOWED_ORIGINS ?? (env.nodeEnv === 'production' ? ''
  : 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000'))
  .split(',').map(value => value.trim()).filter(Boolean);
if (!origins.length || origins.some(origin => {
  try {
    const url = new URL(origin);
    return url.origin !== origin || !['http:', 'https:'].includes(url.protocol)
      || (env.nodeEnv === 'production' && url.protocol !== 'https:');
  } catch { return true; }
})) throw new Error('AUTH_ALLOWED_ORIGINS deve conter origens exatas e HTTPS em produção.');

const sameSite = process.env.AUTH_COOKIE_SAME_SITE ?? 'lax';
if (!['lax', 'strict', 'none'].includes(sameSite)
  || (sameSite === 'none' && env.nodeEnv !== 'production')) {
  throw new Error('AUTH_COOKIE_SAME_SITE inválido; none exige produção e HTTPS.');
}

export const authConfig = {
  allowedOrigins: new Set(origins),
  secureCookies: env.nodeEnv === 'production',
  sameSite: sameSite as 'lax' | 'strict' | 'none',
  sessionCookie: env.nodeEnv === 'production' ? '__Host-dnb_session' : 'dnb_session',
  csrfCookie: env.nodeEnv === 'production' ? '__Host-dnb_csrf' : 'dnb_csrf',
  sessionSeconds: integer('AUTH_SESSION_SECONDS', 28800, 300, 604800),
  rateWindowSeconds: integer('AUTH_LOGIN_WINDOW_SECONDS', 900, 60, 3600),
  rateIpLimit: integer('AUTH_LOGIN_IP_LIMIT', 50, 5, 1000),
  rateAccountLimit: integer('AUTH_LOGIN_ACCOUNT_LIMIT', 10, 3, 100),
  trustProxyHops: integer('TRUST_PROXY_HOPS', 0, 0, 3),
};
