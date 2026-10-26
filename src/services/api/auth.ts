import type { ApiClient } from '../../lib/api/client.ts';
import type {
  AlterarSenhaInput, AtualizarPerfilInput, AuthState, CsrfResponse, LoginInput,
  LoginResponse, MensagemResponse, UsuarioApi, UsuarioResponse,
} from '../../lib/api/contracts.ts';
import { ApiError } from '../../lib/api/errors.ts';
import { readMensagemResponse, readUsuarioResponse } from './responses.ts';

const unauthorized = (error: unknown) => error instanceof ApiError && error.kind === 'http' && error.status === 401;

export function createAuthService(api: ApiClient) {
  let state: AuthState = { status: 'unknown', usuario: null };
  let revision = 0;
  let changingSession = false;

  const remember = (usuario: UsuarioApi) => {
    state = { status: usuario.troca_senha_obrigatoria ? 'password_change_required' : 'authenticated', usuario: { ...usuario } };
  };
  const forget = () => {
    state = { status: 'anonymous', usuario: null };
    api.clearCsrf();
  };

  async function sessionChange<T>(work: () => Promise<T>, apply: (value: T) => void): Promise<T> {
    // Evita logins/logouts concorrentes disputando os cookies no navegador.
    if (changingSession) throw new ApiError('invalid_request');
    changingSession = true;
    revision += 1;
    try {
      const result = await work();
      apply(result);
      return result;
    } finally { revision += 1; changingSession = false; }
  }

  async function profileRequest(work: () => Promise<UsuarioResponse>): Promise<UsuarioApi> {
    if (changingSession) throw new ApiError('cancelled');
    const startedAt = revision;
    try {
      const usuario = readUsuarioResponse(await work());
      if (startedAt !== revision || changingSession) throw new ApiError('cancelled');
      remember(usuario);
      return usuario;
    } catch (error) {
      if (unauthorized(error) && startedAt === revision && !changingSession) {
        revision += 1;
        forget();
      }
      throw error;
    }
  }

  return {
    login(input: LoginInput, signal?: AbortSignal): Promise<UsuarioApi> {
      return sessionChange(async () => readUsuarioResponse(await api.post<LoginResponse>('/api/auth/login', {
        email: input.email, senha: input.senha,
      }, { signal })), remember);
    },
    logout(signal?: AbortSignal): Promise<MensagemResponse> {
      return sessionChange(async () => {
        try { return readMensagemResponse(await api.post<MensagemResponse>('/api/auth/logout', {}, { signal })); }
        catch (error) {
          // 401 confirma que já não há sessão válida, sem anunciar logout realizado.
          if (unauthorized(error)) forget();
          throw error;
        }
      }, forget);
    },
    me(signal?: AbortSignal): Promise<UsuarioApi> {
      return profileRequest(() => api.get<UsuarioResponse>('/api/auth/me', { signal }));
    },
    updateProfile(input: AtualizarPerfilInput, signal?: AbortSignal): Promise<UsuarioApi> {
      return profileRequest(() => api.patch<UsuarioResponse>('/api/auth/me', { nome: input.nome }, { signal }));
    },
    changePassword(input: AlterarSenhaInput, signal?: AbortSignal): Promise<MensagemResponse> {
      // Um 401 aqui também pode significar senha atual incorreta: não apagar o perfil.
      return sessionChange(async () => readMensagemResponse(await api.post<MensagemResponse>('/api/auth/change-password', {
        senha_atual: input.senha_atual, nova_senha: input.nova_senha,
      }, { signal })), forget);
    },
    async refreshCsrf(signal?: AbortSignal): Promise<CsrfResponse> {
      return { csrfToken: await api.refreshCsrf(signal) };
    },
    getState(): AuthState {
      const current = state;
      return current.usuario === null ? { ...current } : { ...current, usuario: { ...current.usuario } };
    },
  };
}
