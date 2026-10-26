import type { Queryable } from '../../database/transaction.js';
import type { CreateImovelInput, ListImoveisInput, UpdateImovelInput } from './imoveis.schema.js';

export interface Imovel {
  id: string; titulo: string; tipo: string; preco: string; cidade: string; bairro: string;
  quartos: number | null; banheiros: number | null; vagas: number | null; area: string | null;
  descricao: string | null; imagem_url: string | null; imagens: string[] | null;
  criado_em: Date; destaque: boolean | null; user_id: string | null;
}
export type PublicImovel = Omit<Imovel, 'user_id'>;
export type ListedImovel = PublicImovel & { user_id?: string | null };
const publicColumns = 'id,titulo,tipo,preco::text,cidade,bairro,quartos,banheiros,vagas,area::text,descricao,imagem_url,imagens,criado_em,destaque';
const columns = `${publicColumns},user_id`;
// As únicas partes interpoladas no SQL vêm desta lista interna, nunca do cliente.
const writable = {
  titulo: 'text', tipo: 'text', preco: 'numeric', cidade: 'text', bairro: 'text',
  quartos: 'integer', banheiros: 'integer', vagas: 'integer', area: 'numeric',
  descricao: 'text', imagem_url: 'text', imagens: 'text[]', destaque: 'boolean',
} as const;

export function publicImovel(row: Imovel): PublicImovel {
  const { user_id: _owner, ...imovel } = row;
  return imovel;
}

export const imoveisRepository = {
  async list(db: Queryable, input: ListImoveisInput, managed = false, owner?: string) {
    const values: unknown[] = [];
    const where: string[] = [];
    const filter = (sql: string, value: unknown, suffix = '') => { values.push(value); where.push(`${sql}$${values.length}${suffix}`); };
    if (owner !== undefined) filter('user_id=', owner);
    if (input.tipo !== undefined) filter('tipo=', input.tipo);
    if (input.cidade !== undefined) filter('lower(cidade)=lower(', input.cidade, ')');
    if (input.bairro !== undefined) filter('lower(bairro)=lower(', input.bairro, ')');
    if (input.preco_min !== undefined) filter('preco>=', input.preco_min);
    if (input.preco_max !== undefined) filter('preco<=', input.preco_max);
    if (input.quartos !== undefined) filter('quartos=', input.quartos);
    if (input.destaque !== undefined) filter('coalesce(destaque,false)=', input.destaque);
    values.push(input.limit, input.offset);
    return (await db.query<ListedImovel>(`SELECT ${managed ? columns : publicColumns} FROM imoveis
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY coalesce(destaque,false) DESC,criado_em DESC,id DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`, values)).rows;
  },
  async byId(db: Queryable, id: string, lock = false): Promise<Imovel | undefined> {
    return (await db.query<Imovel>(`SELECT ${columns} FROM imoveis WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  },
  async create(db: Queryable, input: CreateImovelInput, owner: string): Promise<Imovel> {
    const result = await db.query<Imovel>(`INSERT INTO imoveis
      (titulo,tipo,preco,cidade,bairro,quartos,banheiros,vagas,area,descricao,imagem_url,imagens,destaque,user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING ${columns}`,
    [input.titulo, input.tipo, input.preco, input.cidade, input.bairro, input.quartos ?? null,
      input.banheiros ?? null, input.vagas ?? null, input.area ?? null, input.descricao ?? null,
      input.imagem_url ?? null, input.imagens ?? null, input.destaque === undefined ? false : input.destaque, owner]);
    return result.rows[0]!;
  },
  async update(db: Queryable, id: string, input: UpdateImovelInput): Promise<Imovel | undefined> {
    const keys = (Object.keys(writable) as (keyof typeof writable)[]).filter(key => input[key] !== undefined);
    const values: unknown[] = [id, ...keys.map(key => input[key])];
    const parameter = (key: keyof typeof writable, index: number) => `$${index + 2}::${writable[key]}`;
    const result = await db.query<Imovel>(`UPDATE imoveis SET ${keys.map((key, index) => `${key}=${parameter(key, index)}`).join(',')}
      WHERE id=$1 AND (${keys.map((key, index) => `${key} IS DISTINCT FROM ${parameter(key, index)}`).join(' OR ')})
      RETURNING ${columns}`, values);
    return result.rows[0];
  },
  async delete(db: Queryable, id: string): Promise<void> {
    await db.query('DELETE FROM imoveis WHERE id=$1', [id]);
  },
};
