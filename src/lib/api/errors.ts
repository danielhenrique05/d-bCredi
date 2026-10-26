export type ApiErrorKind = 'http' | 'network' | 'invalid_response' | 'cancelled' | 'configuration' | 'invalid_request';

function httpMessage(status: number): string {
  switch (status) {
    case 400: return 'Dados inválidos. Confira as informações enviadas.';
    case 401: return 'Não foi possível autenticar a solicitação. Confira suas credenciais ou a sessão.';
    case 403: return 'A operação não foi autorizada. Verifique suas permissões ou atualize a sessão.';
    case 404: return 'Recurso não encontrado.';
    case 409: return 'A operação conflita com o estado atual dos dados.';
    case 429: return 'Muitas solicitações. Aguarde antes de tentar novamente.';
    default: return status >= 500 ? 'Serviço temporariamente indisponível. Tente novamente mais tarde.' : 'Não foi possível concluir a solicitação.';
  }
}

const messages: Record<Exclude<ApiErrorKind, 'http'>, string> = {
  network: 'Não foi possível conectar à API. Verifique sua conexão.',
  invalid_response: 'A API retornou uma resposta inválida.',
  cancelled: 'Requisição cancelada.',
  configuration: 'Configure VITE_DNB_API_BASE_URL com uma origem válida da API; produção exige HTTPS e um endereço não local.',
  invalid_request: 'A solicitação contém um caminho, parâmetros ou corpo JSON inválidos.',
};

/** Não incorpora corpo, URL, credenciais, causa de rede ou mensagens externas. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(kind: ApiErrorKind, status?: number, retryAfterSeconds?: number) {
    super(kind === 'http' ? httpMessage(status ?? 500) : messages[kind]);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ApiError('cancelled');
}

/** Cancela a espera de um consumidor sem cancelar uma obtenção CSRF compartilhada. */
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const aborted = () => { signal.removeEventListener('abort', aborted); reject(new ApiError('cancelled')); };
    if (signal.aborted) {
      // Consome também eventual rejeição de uma operação já iniciada.
      void promise.catch(() => {});
      aborted();
      return;
    }
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(value => {
      signal.removeEventListener('abort', aborted);
      resolve(value);
    }, error => {
      signal.removeEventListener('abort', aborted);
      reject(error);
    });
  });
}
