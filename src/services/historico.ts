import { getSupabaseClient } from '../lib/supabase';
import { obterUsuarioAtual } from './usuarios';

export interface RegistroHistorico {
  id: number;
  user_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  acao: 'CREATE' | 'UPDATE' | 'DELETE';
  entidade: string;
  entidade_id: string;
  descricao: string;
  criado_em: string;
}

const TAMANHO_PAGINA = 50;

// A interface não depende da forma de consulta; este serviço poderá usar a API própria.
export const listarHistorico = async (data: string, pagina: number) => {
  await obterUsuarioAtual();

  let query = getSupabaseClient().from('historico')
    .select('id, user_id, usuario_nome, usuario_email, acao, entidade, entidade_id, descricao, criado_em')
    .order('criado_em', { ascending: false })
    .order('id', { ascending: false });

  if (data) {
    const [ano, mes, dia] = data.split('-').map(Number);
    // O filtro e a exibição usam o mesmo fuso local do navegador, inclusive em mudanças de horário.
    const inicio = new Date(ano, mes - 1, dia);
    const fim = new Date(ano, mes - 1, dia + 1);
    query = query.gte('criado_em', inicio.toISOString()).lt('criado_em', fim.toISOString());
  }

  const inicio = pagina * TAMANHO_PAGINA;
  const { data: registros, error } = await query.range(inicio, inicio + TAMANHO_PAGINA)
    .returns<RegistroHistorico[]>();
  if (error) throw new Error('Não foi possível carregar o histórico. Verifique sua permissão e a configuração do banco.');

  return {
    registros: (registros ?? []).slice(0, TAMANHO_PAGINA),
    temMais: (registros?.length ?? 0) > TAMANHO_PAGINA,
  };
};
