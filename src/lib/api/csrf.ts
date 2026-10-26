import { abortable, ApiError, throwIfAborted } from './errors.ts';

// O cookie anônimo do backend dura 10 minutos; renova antes desse prazo.
const MAX_CACHE_AGE_MS = 9 * 60 * 1000;

export function parseCsrfToken(payload: unknown): string {
  const token = typeof payload === 'object' && payload !== null && 'csrfToken' in payload ? payload.csrfToken : undefined;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError('invalid_response');
  return token;
}

export function createCsrfStore(load: (signal: AbortSignal) => Promise<unknown>) {
  let cached: { token: string; at: number } | undefined;
  let revision = 0;
  let pending: { promise: Promise<string>; controller: AbortController } | undefined;

  const clear = () => {
    revision += 1;
    cached = undefined;
    pending?.controller.abort();
    pending = undefined;
  };
  const set = (payload: unknown) => {
    const token = parseCsrfToken(payload);
    clear();
    cached = { token, at: Date.now() };
  };
  const get = (signal?: AbortSignal): Promise<string> => {
    throwIfAborted(signal);
    if (cached && Date.now() - cached.at < MAX_CACHE_AGE_MS) return Promise.resolve(cached.token);
    if (!pending) {
      const generation = revision;
      const controller = new AbortController();
      const promise = load(controller.signal).then(payload => {
        if (generation !== revision) throw new ApiError('cancelled');
        const token = parseCsrfToken(payload);
        cached = { token, at: Date.now() };
        return token;
      }).finally(() => { if (pending?.promise === promise) pending = undefined; });
      pending = { promise, controller };
    }
    return abortable(pending.promise, signal);
  };
  const refresh = (signal?: AbortSignal): Promise<string> => {
    throwIfAborted(signal);
    cached = undefined;
    return get(signal);
  };
  return { get, refresh, set, clear };
}
