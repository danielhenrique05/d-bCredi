import type { MensagemResponse, UsuarioApi, UsuariosResponse } from '../../lib/api/contracts.ts';
import { ApiError } from '../../lib/api/errors.ts';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Projeta somente campos públicos, mesmo se uma resposta futura trouxer extras. */
function readUsuario(value: unknown): UsuarioApi {
  if (!record(value) || typeof value.id !== 'string' || !value.id
    || typeof value.nome !== 'string' || typeof value.email !== 'string'
    || (value.papel !== 'admin' && value.papel !== 'vendedor')
    || typeof value.ativo !== 'boolean' || typeof value.criado_em !== 'string'
    || !Number.isFinite(Date.parse(value.criado_em)) || typeof value.troca_senha_obrigatoria !== 'boolean') {
    throw new ApiError('invalid_response');
  }
  return {
    id: value.id, nome: value.nome, email: value.email, papel: value.papel,
    ativo: value.ativo, criado_em: value.criado_em, troca_senha_obrigatoria: value.troca_senha_obrigatoria,
  };
}

export function readUsuarioResponse(payload: unknown): UsuarioApi {
  if (!record(payload)) throw new ApiError('invalid_response');
  return readUsuario(payload.usuario);
}

export function readUsuariosResponse(payload: unknown): UsuariosResponse {
  if (!record(payload) || !Array.isArray(payload.usuarios)
    || typeof payload.limit !== 'number' || !Number.isInteger(payload.limit) || payload.limit < 1
    || typeof payload.offset !== 'number' || !Number.isInteger(payload.offset) || payload.offset < 0) {
    throw new ApiError('invalid_response');
  }
  return { usuarios: payload.usuarios.map(readUsuario), limit: payload.limit, offset: payload.offset };
}

export function readMensagemResponse(payload: unknown): MensagemResponse {
  if (!record(payload) || typeof payload.message !== 'string' || !payload.message.trim()) throw new ApiError('invalid_response');
  return { message: payload.message };
}
