import { HttpError } from '../../shared/http-error.js';

export const CONTEMPLADOS_URL = 'https://fragaebitelloconsorcios.com.br/api/json/contemplados';
export const CONTEMPLADOS_TIMEOUT_MS = 5_000;
export const CONTEMPLADOS_MAX_BYTES = 2 * 1024 * 1024;

const unavailable = () => new HttpError(502, 'Não foi possível consultar as cartas contempladas. Tente novamente mais tarde.');
const timeout = () => new HttpError(504, 'O fornecedor de cartas contempladas demorou para responder. Tente novamente mais tarde.');

/** Transporte HTTP somente de leitura; não recebe URL nem credenciais do cliente. */
export class ContempladosClient {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
    private readonly timeoutMs = CONTEMPLADOS_TIMEOUT_MS,
  ) {}

  async list(): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    let response: Response | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const discardBody = () => {
      // Cancelamento não deve prolongar o prazo máximo nem mascarar o erro original.
      const cancellation = reader ? reader.cancel() : response?.body?.cancel();
      void cancellation?.catch(() => {});
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        discardBody();
        reject(timeout());
      }, this.timeoutMs);
    });

    const request = async (): Promise<unknown> => {
      response = await this.fetchImpl(CONTEMPLADOS_URL, {
        method: 'GET', headers: { Accept: 'application/json' },
        credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
      });
      // Um transporte simulado também pode terminar depois do cancelamento.
      if (timedOut) { discardBody(); throw timeout(); }
      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
      if (response.status !== 200 || contentType !== 'application/json' || !response.body) throw unavailable();
      const declaredLength = response.headers.get('content-length');
      if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > CONTEMPLADOS_MAX_BYTES)) {
        throw unavailable();
      }

      reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > CONTEMPLADOS_MAX_BYTES) throw unavailable();
          chunks.push(value);
        }
      } finally { reader.releaseLock(); reader = undefined; }
      // O limite vale para bytes efetivamente lidos, inclusive após descompressão.
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    };

    try {
      return await Promise.race([request(), deadline]);
    } catch {
      // Não propaga body, URL, headers, causa de rede ou detalhes de validação externos.
      throw timedOut ? timeout() : unavailable();
    } finally {
      clearTimeout(timer);
      controller.abort();
      discardBody();
    }
  }
}
