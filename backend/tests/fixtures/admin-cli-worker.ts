// Executável somente de testes: não importa Pool nem conecta a PostgreSQL externo.
import '../environment.js';
import { PGlite } from '@electric-sql/pglite';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import argon2 from 'argon2';
import { MemoryDatabase, fixture } from '../support.js';
import { runAdminCreate, terminalAdminInput } from '../../src/cli/admin-command.js';
import { formatAdminError } from '../../src/cli/admin-errors.js';
import { hashPassword } from '../../src/shared/password.js';

const pg = new PGlite();
const database = new MemoryDatabase(pg);
let secret: string | undefined;
let databaseLoads = 0;
let existingId: string | undefined;
try {
  await pg.exec(fixture);
  await pg.exec(await readFile(new URL('../../src/database/migrations/2026102401_auth.sql', import.meta.url), 'utf8'));
  const scenario = process.env.ADMIN_CLI_SCENARIO;
  if (scenario === 'existing' || scenario === 'conflict') {
    const hash = await hashPassword(randomBytes(32).toString('base64url'));
    const result = await database.query<{ id: string }>(`INSERT INTO usuarios (nome,email,senha_hash,papel)
      VALUES ($1,$2,$3,$4) RETURNING id`, ['Conta Isolada', 'admin@example.test', hash, scenario === 'existing' ? 'admin' : 'vendedor']);
    existingId = result.rows[0]!.id;
  }
  await runAdminCreate(process.argv.slice(2), {
    ...terminalAdminInput,
    async stdinPassword() { secret = await terminalAdminInput.stdinPassword(); return secret; },
  }, async () => { databaseLoads++; return database; });
  console.info('Administrador inicial criado. Nenhuma credencial foi impressa.');
} catch (error) {
  for (const line of formatAdminError(error)) console.error(line);
  process.exitCode = 1;
} finally {
  const users = await database.query<{ id: string; papel: string; senha_hash: string }>('SELECT id,papel,senha_hash FROM usuarios');
  const history = await database.query<{ total: number }>('SELECT count(*)::int AS total FROM historico');
  const stored = users.rows[0];
  // Apenas metadados e resultados booleanos. Não serializar usuários/hashes.
  console.log(JSON.stringify({
    total: users.rows.length,
    admins: users.rows.filter(user => user.papel === 'admin').length,
    audit: history.rows[0]!.total,
    argon2id: stored?.senha_hash.startsWith('$argon2id$') ?? false,
    passwordVerified: !existingId && secret && stored ? await argon2.verify(stored.senha_hash, secret) : false,
    existingPreserved: existingId ? users.rows.some(user => user.id === existingId) : null,
    databaseLoads,
  }));
  await pg.close();
}
