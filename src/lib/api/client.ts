import { apiUrl, resolveApiBaseUrl, type ApiConfigOptions, type ApiQuery } from './config.ts';
import { createCsrfStore } from './csrf.ts';
import { abortable, ApiError, throwIfAborted } from './errors.ts';

export interface ApiRequestOptions { signal?: AbortSignal; query?: ApiQuery }
export interface ApiClientOptions extends ApiConfigOptions { fetchImpl?: typeof fetch }

function serializeJson(value: unknown): string {
  try {
    const body = JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === 'function' || typeof item === 'symbol' || (typeof item === 'number' && !Number.isFinite(item))) throw new Error();
      return item;
    });
    if (body === undefined) throw new Error();
    return body;
  } catch { throw new ApiError('invalid_request'); }
}

/** Criar uma instância por origem da API. Importar o módulo não inicia conexões. */
export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = resolveApiBaseUrl(options);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  async function transport<T>(url: URL, init: RequestInit): Promise<T> {
    const signal = init.signal ?? undefined;
    throwIfAborted(signal);
    try {
      const response = await abortable(fetchImpl(url.href, {
        ...init, credentials: 'include', cache: 'no-store', redirect: 'error',
      }), signal);
      throwIfAborted(signal);
      if (!response.ok) {
        const retry = response.headers.get('Retry-After');
        const seconds = response.status === 429 && retry && /^\d{1,5}$/.test(retry) ? Number(retry) : undefined;
        void response.body?.cancel().catch(() => {});
        throw new ApiError('http', response.status, seconds);
      }
      if (response.status === 204) return undefined as T;
      const mediaType = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
      if (!mediaType || !/^application\/(?:json|[\w.+-]+\+json)$/.test(mediaType)) {
        void response.body?.cancel().catch(() => {});
        throw new ApiError('invalid_response', response.status);
      }
      const text = await abortable(response.text(), signal);
      throwIfAborted(signal);
      try { return JSON.parse(text) as T; }
      catch { throw new ApiError('invalid_response', response.status); }
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw new ApiError('cancelled');
      if (error instanceof ApiError) throw error;
      throw new ApiError('network');
    }
  }

  const csrf = createCsrfStore(signal => transport<unknown>(apiUrl(baseUrl, '/api/auth/csrf'), {
    method: 'GET', headers: { Accept: 'application/json' }, signal,
  }));

  async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown, settings: ApiRequestOptions = {}): Promise<T> {
    throwIfAborted(settings.signal);
    const url = apiUrl(baseUrl, path, settings.query);
    const headers: Record<string, string> = { Accept: 'application/json' };
    let json: string | undefined;
    if (method !== 'GET') {
      json = serializeJson(body);
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = await csrf.get(settings.signal);
    }
    // Express aceita essas rotas também com barra final e sem distinguir caixa.
    const route = url.pathname.toLowerCase().replace(/\/+$/u, '');
    const changesSession = method === 'POST' && ['/api/auth/login', '/api/auth/logout', '/api/auth/change-password'].includes(route);
    let result: T;
    try { result = await transport<T>(url, { method, headers, body: json, signal: settings.signal }); }
    catch (error) {
      // Uma falha na resposta não comprova se o servidor já alterou o cookie.
      if (changesSession) csrf.clear();
      throw error;
    }
    if (method === 'POST' && route === '/api/auth/login') {
      // O cookie foi rotacionado pelo servidor; não reutilizar o CSRF anterior.
      try { csrf.set(result); }
      catch (error) { csrf.clear(); throw error; }
    }
    if (changesSession && route !== '/api/auth/login') csrf.clear();
    return result;
  }

  return {
    get: <T = unknown>(path: string, settings?: ApiRequestOptions) => request<T>('GET', path, undefined, settings),
    post: <T = unknown>(path: string, body: unknown = {}, settings?: ApiRequestOptions) => request<T>('POST', path, body, settings),
    patch: <T = unknown>(path: string, body: unknown, settings?: ApiRequestOptions) => request<T>('PATCH', path, body, settings),
    // O backend exige JSON e corpo vazio inclusive na exclusão de imóveis.
    delete: <T = void>(path: string, settings?: ApiRequestOptions) => request<T>('DELETE', path, {}, settings),
    refreshCsrf: (signal?: AbortSignal) => csrf.refresh(signal),
    clearCsrf: () => csrf.clear(),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
