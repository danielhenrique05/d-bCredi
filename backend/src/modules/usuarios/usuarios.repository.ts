import type { Queryable } from '../../database/transaction.js';

export interface Usuario {
  id: string; nome: string; email: string; papel: 'admin' | 'vendedor'; ativo: boolean; criado_em: Date;
  troca_senha_obrigatoria: boolean;
}
export interface UsuarioCredentials extends Usuario { senha_hash: string }
export const publicColumns = 'id, nome, email, papel, ativo, criado_em, troca_senha_obrigatoria';

export const usersRepository = {
  async byId(db: Queryable, id: string): Promise<Usuario | undefined> {
    return (await db.query<Usuario>(`SELECT ${publicColumns} FROM usuarios WHERE id=$1`, [id])).rows[0];
  },
  async credentialsById(db: Queryable, id: string): Promise<UsuarioCredentials | undefined> {
    return (await db.query<UsuarioCredentials>(`SELECT ${publicColumns}, senha_hash FROM usuarios WHERE id=$1`, [id])).rows[0];
  },
  async byEmail(db: Queryable, email: string): Promise<UsuarioCredentials | undefined> {
    return (await db.query<UsuarioCredentials>(`SELECT ${publicColumns}, senha_hash FROM usuarios WHERE lower(email)=$1`, [email])).rows[0];
  },
  async list(db: Queryable, limit: number, offset: number): Promise<Usuario[]> {
    return (await db.query<Usuario>(`SELECT ${publicColumns} FROM usuarios ORDER BY criado_em, id LIMIT $1 OFFSET $2`, [limit, offset])).rows;
  },
  async create(db: Queryable, data: { nome: string; email: string; hash: string; papel: Usuario['papel']; forceChange: boolean }): Promise<Usuario> {
    const result = await db.query<Usuario>(`INSERT INTO usuarios (nome,email,senha_hash,papel,troca_senha_obrigatoria)
      VALUES ($1,$2,$3,$4,$5) RETURNING ${publicColumns}`, [data.nome, data.email, data.hash, data.papel, data.forceChange]);
    return result.rows[0]!;
  },
  async update(db: Queryable, id: string, data: { nome: string; email: string; papel: Usuario['papel']; ativo: boolean }): Promise<Usuario> {
    const result = await db.query<Usuario>(`UPDATE usuarios SET nome=$2,email=$3,papel=$4,ativo=$5
      WHERE id=$1 RETURNING ${publicColumns}`, [id, data.nome, data.email, data.papel, data.ativo]);
    return result.rows[0]!;
  },
  async password(db: Queryable, id: string, hash: string, forceChange = false): Promise<void> {
    await db.query('UPDATE usuarios SET senha_hash=$2,troca_senha_obrigatoria=$3 WHERE id=$1', [id, hash, forceChange]);
  },
  async adminCount(db: Queryable, onlyActive = true): Promise<number> {
    const result = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM usuarios
      WHERE papel='admin' AND ($1::boolean=false OR ativo=true)`, [onlyActive]);
    return result.rows[0]!.total;
  },
};

// Lista explícita evita que hashes escapem mesmo em respostas construídas com credenciais.
export function publicUser(user: Usuario): Usuario {
  return { id: user.id, nome: user.nome, email: user.email, papel: user.papel, ativo: user.ativo,
    criado_em: user.criado_em, troca_senha_obrigatoria: user.troca_senha_obrigatoria };
}
