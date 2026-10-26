import type { Queryable } from '../../database/transaction.js';
import type { ListHistoricoInput } from './historico.schema.js';

export interface RegistroHistorico {
  id: string;
  user_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  acao: 'CREATE' | 'UPDATE' | 'DELETE';
  entidade: string;
  entidade_id: string;
  descricao: string;
  criado_em: Date;
}

const columns = 'id::text,user_id,usuario_nome,usuario_email,acao,entidade,entidade_id,descricao,criado_em';

export const historicoRepository = {
  async list(db: Queryable, input: ListHistoricoInput): Promise<RegistroHistorico[]> {
    const values: unknown[] = [];
    const filters: string[] = [];
    const filter = (sql: string, value: unknown) => { values.push(value); filters.push(`${sql}$${values.length}`); };
    if (input.acao !== undefined) filter('acao=', input.acao);
    if (input.entidade !== undefined) filter('entidade=', input.entidade);
    if (input.usuario_id !== undefined) filter('user_id=', input.usuario_id);
    if (input.entidade_id !== undefined) filter('entidade_id=', input.entidade_id);
    if (input.data_inicio !== undefined) filter('criado_em>=', input.data_inicio);
    if (input.data_fim !== undefined) filter('criado_em<', input.data_fim);
    values.push(input.limit + 1, input.offset);
    return (await db.query<RegistroHistorico>(`SELECT ${columns} FROM historico
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY historico.criado_em DESC,historico.id DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`, values)).rows;
  },
  async byId(db: Queryable, id: string): Promise<RegistroHistorico | undefined> {
    return (await db.query<RegistroHistorico>(`SELECT ${columns} FROM historico WHERE id=$1::bigint`, [id])).rows[0];
  },
};
