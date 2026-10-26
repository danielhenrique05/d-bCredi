import type { Queryable } from '../../database/transaction.js';
import type { Usuario } from '../usuarios/usuarios.repository.js';

export interface AuthContext { sessionId: string; user: Usuario }

export const authRepository = {
  // now() fica fixo no BEGIN; o prazo deve avançar inclusive durante espera por locks.
  async session(db: Queryable, tokenHash: string): Promise<AuthContext | undefined> {
    const result = await db.query<Usuario & { session_id: string }>(`SELECT u.id,u.nome,u.email,u.papel,u.ativo,u.criado_em,u.troca_senha_obrigatoria,s.id AS session_id
      FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id
      WHERE s.token_hash=$1 AND s.revogada_em IS NULL AND s.expira_em>clock_timestamp() AND u.ativo=true`, [tokenHash]);
    const row = result.rows[0];
    if (!row) return undefined;
    const { session_id, ...user } = row;
    return { sessionId: session_id, user };
  },
  async current(db: Queryable, sessionId: string): Promise<AuthContext | undefined> {
    const result = await db.query<Usuario>(`SELECT u.id,u.nome,u.email,u.papel,u.ativo,u.criado_em,u.troca_senha_obrigatoria
      FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id
      WHERE s.id=$1 AND s.revogada_em IS NULL AND s.expira_em>clock_timestamp() AND u.ativo=true`, [sessionId]);
    return result.rows[0] ? { sessionId, user: result.rows[0] } : undefined;
  },
  async create(db: Queryable, userId: string, hash: string, seconds: number): Promise<void> {
    await db.query(`INSERT INTO sessoes (usuario_id,token_hash,expira_em)
      VALUES ($1,$2,now()+$3::int*interval '1 second')`, [userId, hash, seconds]);
  },
  async revoke(db: Queryable, sessionId: string): Promise<void> {
    await db.query('UPDATE sessoes SET revogada_em=now() WHERE id=$1 AND revogada_em IS NULL', [sessionId]);
  },
  async revokeUser(db: Queryable, userId: string): Promise<void> {
    await db.query('UPDATE sessoes SET revogada_em=now() WHERE usuario_id=$1 AND revogada_em IS NULL', [userId]);
  },
  async rateBucket(db: Queryable, key: string, seconds: number, limit: number): Promise<boolean> {
    const result = await db.query<{ tentativas: number }>(`INSERT INTO auth_login_limites (chave_hash,tentativas,janela_inicio)
      VALUES ($1,1,now()) ON CONFLICT (chave_hash) DO UPDATE SET
      tentativas=CASE WHEN auth_login_limites.janela_inicio<=now()-$2::int*interval '1 second'
        THEN 1 ELSE LEAST(auth_login_limites.tentativas+1,$3::int+1) END,
      janela_inicio=CASE WHEN auth_login_limites.janela_inicio<=now()-$2::int*interval '1 second'
        THEN now() ELSE auth_login_limites.janela_inicio END RETURNING tentativas`, [key, seconds, limit]);
    return result.rows[0]!.tentativas > limit;
  },
};
