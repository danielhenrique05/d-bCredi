import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

export interface UsuarioAtual {
  id: string;
  nome: string | null;
  email: string | null;
  administrador: boolean;
}

const texto = (valor: unknown): string | null =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : null;

// Adapta a conta existente para o formato usado pelo painel.
// Na futura API, somente este adaptador precisa mudar.
export const identificarUsuario = (user: User): UsuarioAtual => ({
  id: user.id,
  nome: texto(user.user_metadata?.nome) ?? texto(user.user_metadata?.full_name) ?? texto(user.user_metadata?.name),
  email: texto(user.email),
  // Nunca usar user_metadata para conceder privilégios: o usuário pode editá-lo.
  administrador: user.app_metadata?.role === 'admin',
});

export const obterUsuarioAtual = async (): Promise<UsuarioAtual> => {
  const { data: { user }, error } = await getSupabaseClient().auth.getUser();
  if (error || !user) {
    throw new Error('Sua sessão expirou. Entre novamente para continuar.');
  }
  return identificarUsuario(user);
};
