import './environment.js';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { QueryResultRow } from 'pg';
import pgDriver from 'pg';
import dotenv from 'dotenv';
import { createApp } from '../src/app.js';
import type { Database, DatabaseClient } from '../src/database/transaction.js';
import { hashPassword } from '../src/shared/password.js';
import type { Usuario } from '../src/modules/usuarios/usuarios.repository.js';
import type { PublicImovel, ListedImovel } from '../src/modules/imoveis/imoveis.repository.js';
import type { RegistroHistorico } from '../src/modules/historico/historico.repository.js';

type HistoricoJson = Omit<RegistroHistorico, 'criado_em'> & { criado_em: string };

export const testPassword = 'Frase exclusiva para testes 2026!';
export const nextPassword = 'Outra frase exclusiva para testes 2026!';
export const origin = 'http://localhost:5173';
export const fixture = `
CREATE TABLE usuarios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL, email text NOT NULL,
 senha_hash text NOT NULL, papel text NOT NULL DEFAULT 'vendedor' CHECK(papel IN ('admin','vendedor')),
 ativo boolean NOT NULL DEFAULT true, criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios(lower(email));
CREATE TABLE imoveis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL,tipo text NOT NULL,preco numeric NOT NULL,
 cidade text NOT NULL,bairro text NOT NULL,quartos integer,banheiros integer,vagas integer,area numeric,
 descricao text,imagem_url text,imagens text[],criado_em timestamptz NOT NULL DEFAULT now(),destaque boolean DEFAULT false,
 user_id uuid REFERENCES usuarios(id) ON DELETE RESTRICT
);
CREATE TABLE historico (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid,usuario_nome text,usuario_email text,
 acao text NOT NULL CHECK(acao IN ('CREATE','UPDATE','DELETE')),entidade text NOT NULL,
 entidade_id text NOT NULL,descricao text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now()
);`;

export class MemoryDatabase implements Database {
  private tail: Promise<void> = Promise.resolve();
  constructor(readonly pg: PGlite) {}
  async connect(): Promise<DatabaseClient> {
    const previous = this.tail;
    let unlock!: () => void;
    this.tail = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    let released = false;
    return {
      query: async <R extends QueryResultRow>(sql: string, values?: unknown[]) => {
        const result = await this.pg.query<R>(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows ?? null };
      },
      release: () => { if (!released) { released = true; unlock(); } },
    };
  }
  async query<R extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) {
    const client = await this.connect();
    try { return await client.query<R>(sql, values); } finally { client.release(); }
  }
}

interface Body {
  usuario?: Usuario; usuarios?: Usuario[]; csrfToken?: string; message?: string; status?: string;
  imovel?: PublicImovel; imoveis?: ListedImovel[]; limit?: number; offset?: number;
  registros?: HistoricoJson[]; registro?: HistoricoJson; temMais?: boolean;
}
export class Client {
  readonly cookies = new Map<string, string>();
  csrf?: string;
  constructor(readonly base: string) {}
  async request(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string>; csrf?: boolean } = {}) {
    const headers: Record<string, string> = { Origin: origin };
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.csrf && options.csrf !== false) headers['X-CSRF-Token'] = this.csrf;
    Object.assign(headers, options.headers);
    const response = await fetch(`${this.base}${path}`, {
      method: options.method ?? 'GET', headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const separator = pair!.indexOf('=');
      const key = pair!.slice(0, separator), value = pair!.slice(separator + 1);
      if (value) this.cookies.set(key, value); else this.cookies.delete(key);
    }
    const text = await response.text();
    const body = text ? JSON.parse(text) as Body : {};
    if (body.csrfToken) this.csrf = body.csrfToken;
    return { status: response.status, body, text, headers: response.headers };
  }
  async login(email: string, senha = testPassword) {
    await this.request('/api/auth/csrf');
    return this.request('/api/auth/login', { method: 'POST', body: { email, senha } });
  }
}

export async function createTestContext(realDatabase = process.env.DNB_TEST_DATABASE) {
  let pg: { exec(sql: string): Promise<unknown>; close(): Promise<void> };
  let db: Database;
  if (realDatabase) {
    // Nunca aceitar o banco de desenvolvimento, nem reutilizar fixtures preexistentes.
    if (!/^db_credi_test_[a-z0-9_]+$/.test(realDatabase)) throw new Error('Nome de banco de testes não permitido.');
    const local = dotenv.parse(await readFile(new URL('../.env', import.meta.url), 'utf8'));
    const real = new pgDriver.Pool({ host: local.DB_HOST, port: Number(local.DB_PORT), user: local.DB_USER,
      password: local.DB_PASSWORD, database: realDatabase, max: 10, connectionTimeoutMillis: 3000 });
    const existing = await real.query("SELECT to_regclass('public.usuarios') AS usuarios");
    if (existing.rows[0].usuarios) { await real.end(); throw new Error('Banco de testes deve estar vazio. Crie outro banco isolado.'); }
    pg = { exec: sql => real.query(sql), close: () => real.end() };
    db = real;
  } else {
    const memory = new PGlite();
    pg = memory;
    db = new MemoryDatabase(memory);
  }
  await pg.exec(fixture);
  const migration = await readFile(new URL('../src/database/migrations/2026102401_auth.sql', import.meta.url), 'utf8');
  await pg.exec(migration);
  // Reaplicação explícita também é validada.
  await pg.exec(migration);
  const imoveisMigration = await readFile(new URL('../src/database/migrations/2026102402_imoveis_indices.sql', import.meta.url), 'utf8');
  await pg.exec(imoveisMigration);
  await pg.exec(imoveisMigration);
  const historicoMigration = await readFile(new URL('../src/database/migrations/2026102601_historico_indices.sql', import.meta.url), 'utf8');
  await pg.exec(historicoMigration);
  await pg.exec(historicoMigration);
  const server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const fixtureHash = await hashPassword(testPassword);
  return {
    pg, db, base,
    client: () => new Client(base),
    async reset() { await pg.exec('TRUNCATE imoveis,sessoes,auth_login_limites,historico,usuarios RESTART IDENTITY'); },
    async user(papel: 'admin' | 'vendedor' = 'vendedor', email = `${papel}@example.test`, ativo = true) {
      return (await db.query<Usuario>(`INSERT INTO usuarios (nome,email,senha_hash,papel,ativo)
        VALUES ($1,$2,$3,$4,$5) RETURNING id,nome,email,papel,ativo,criado_em,troca_senha_obrigatoria`,
      ['Conta de Teste', email, fixtureHash, papel, ativo])).rows[0]!;
    },
    async close() {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await pg.close();
    },
  };
}
