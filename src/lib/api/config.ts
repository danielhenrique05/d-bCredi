import { ApiError } from './errors.ts';

export interface ApiConfigOptions { baseUrl?: string; production?: boolean }
export type ApiQuery = Record<string, string | number | boolean | null | undefined>;

export function resolveApiBaseUrl(options: ApiConfigOptions = {}): string {
  const value = options.baseUrl ?? import.meta.env?.VITE_DNB_API_BASE_URL;
  const viteProduction = import.meta.env?.PROD;
  // A opção de testes não pode desligar as proteções de um bundle de produção.
  const production = viteProduction === true || (options.production ?? viteProduction ?? true);
  if (!value || /[\s\\]/u.test(value)) throw new ApiError('configuration');
  try {
    const url = new URL(value);
    const local = /^(?:localhost\.?|.*\.localhost\.?|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\]|\[::\]|\[::ffff:(?:7f[\da-f]{2}:[\da-f]{1,4}|0:0)\])$/i.test(url.hostname);
    if (!/^https?:\/\//i.test(value) || !['http:', 'https:'].includes(url.protocol)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash
      || (production && (url.protocol !== 'https:' || local))) throw new Error();
    return url.origin;
  } catch { throw new ApiError('configuration'); }
}

/** Caminhos da API são separados da origem; nunca aceita destino externo por requisição. */
export function apiUrl(baseUrl: string, path: string, query: ApiQuery = {}): URL {
  if (!path.startsWith('/api/') || /[\\?#\p{Cc}]/u.test(path)) throw new ApiError('invalid_request');
  const url = new URL(path, baseUrl);
  if (url.origin !== baseUrl || !url.pathname.startsWith('/api/')) throw new ApiError('invalid_request');
  for (const [name, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new ApiError('invalid_request');
    }
    url.searchParams.set(name, String(value));
  }
  return url;
}
