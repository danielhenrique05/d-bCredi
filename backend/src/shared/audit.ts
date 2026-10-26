import type { Queryable } from '../database/transaction.js';
import type { Usuario } from '../modules/usuarios/usuarios.repository.js';

export async function audit(db: Queryable, actor: Usuario, action: 'CREATE' | 'UPDATE' | 'DELETE', targetId: string,
  description: string, entity: 'usuario' | 'imovel' = 'usuario'): Promise<void> {
  await db.query(`INSERT INTO historico (user_id,usuario_nome,usuario_email,acao,entidade,entidade_id,descricao)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [actor.id, actor.nome, actor.email, action, entity, targetId, description]);
}
