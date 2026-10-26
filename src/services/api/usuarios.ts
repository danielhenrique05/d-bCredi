import type { ApiClient } from '../../lib/api/client.ts';
import type {
  AtualizarUsuarioInput, CriarUsuarioInput, MensagemResponse, PaginacaoUsuariosInput,
  ReautenticarAdminInput, ResetPasswordUsuarioInput, StatusUsuarioInput,
  UsuarioApi, UsuarioResponse, UsuariosResponse,
} from '../../lib/api/contracts.ts';
import { ApiError } from '../../lib/api/errors.ts';
import { readMensagemResponse, readUsuarioResponse, readUsuariosResponse } from './responses.ts';

function userPath(id: string): string {
  if (typeof id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw new ApiError('invalid_request');
  return `/api/usuarios/${encodeURIComponent(id)}`;
}

export function createUsuariosService(api: ApiClient) {
  return {
    async list(input: PaginacaoUsuariosInput = {}, signal?: AbortSignal): Promise<UsuariosResponse> {
      return readUsuariosResponse(await api.get<UsuariosResponse>('/api/usuarios', { query: { limit: input.limit, offset: input.offset }, signal }));
    },
    async get(id: string, signal?: AbortSignal): Promise<UsuarioApi> {
      return readUsuarioResponse(await api.get<UsuarioResponse>(userPath(id), { signal }));
    },
    async create(input: CriarUsuarioInput, signal?: AbortSignal): Promise<UsuarioApi> {
      // O papel é determinado pelo backend; nunca repassar papel/ativo do chamador.
      return readUsuarioResponse(await api.post<UsuarioResponse>('/api/usuarios', {
        nome: input.nome, email: input.email, senha: input.senha,
      }, { signal }));
    },
    async update(id: string, input: AtualizarUsuarioInput, signal?: AbortSignal): Promise<UsuarioApi> {
      return readUsuarioResponse(await api.patch<UsuarioResponse>(userPath(id), {
        nome: input.nome, email: input.email, papel: input.papel, senha_admin: input.senha_admin,
      }, { signal }));
    },
    async setStatus(id: string, input: StatusUsuarioInput, signal?: AbortSignal): Promise<UsuarioApi> {
      return readUsuarioResponse(await api.patch<UsuarioResponse>(`${userPath(id)}/status`, {
        ativo: input.ativo, senha_admin: input.senha_admin,
      }, { signal }));
    },
    async resetPassword(id: string, input: ResetPasswordUsuarioInput, signal?: AbortSignal): Promise<MensagemResponse> {
      return readMensagemResponse(await api.post<MensagemResponse>(`${userPath(id)}/reset-password`, {
        nova_senha: input.nova_senha, senha_admin: input.senha_admin,
      }, { signal }));
    },
    async revokeSessions(id: string, input: ReautenticarAdminInput, signal?: AbortSignal): Promise<MensagemResponse> {
      return readMensagemResponse(await api.post<MensagemResponse>(`${userPath(id)}/revoke-sessions`, {
        senha_admin: input.senha_admin,
      }, { signal }));
    },
  };
}
