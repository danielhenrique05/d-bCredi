import './environment.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import type { QueryResultRow } from 'pg';
import type { Database, Queryable } from '../src/database/transaction.js';
import { runAdminReset, type AdminResetInput } from '../src/cli/admin-reset-command.js';
import { assertAdminRecoveryScope, recoverAdminPassword, RECOVERY_TARGET_SQL, type AdminRecoveryScope } from '../src/cli/recover-admin-password.js';
import { formatAdminError } from '../src/cli/admin-errors.js';
import { hashPassword, verifyPassword } from '../src/shared/password.js';
import { digestToken } from '../src/shared/session.js';
import { usersRepository, type Usuario } from '../src/modules/usuarios/usuarios.repository.js';
import { authRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { UsersService } from '../src/modules/usuarios/usuarios.service.js';
import { MemoryDatabase, fixture } from './support.js';

const scope: AdminRecoveryScope = { nodeEnv: 'development', host: '127.0.0.1', database: 'db_credi_dev' };
const secret = (): string => randomBytes(32).toString('base64url');

describe('Recuperação administrativa restrita ao CLI local', { concurrency: false }, () => {
  let pg: PGlite;
  let memory: MemoryDatabase;
  let db: Database;
  let admin: Usuario, other: Usuario, seller: Usuario;
  let originalHash: string, originalPassword: string, newPassword: string;
  let tokens: string[];
  let metadata: { banco: string; endereco: string | null };
  let writes: number, passwordReads: number, confirmationReads: number, databaseLoads: number;

  before(async () => {
    pg = new PGlite();
    await pg.exec(fixture);
    await pg.exec(await readFile(new URL('../src/database/migrations/2026102401_auth.sql', import.meta.url), 'utf8'));
    memory = new MemoryDatabase(pg);
    originalPassword = secret();
    originalHash = await hashPassword(originalPassword);
  });
  after(async () => { await pg.close(); });

  beforeEach(async () => {
    // Cada teste usa contas novas na instância em memória; não limpa registros.
    const suffix = randomBytes(8).toString('hex');
    admin = await usersRepository.create(memory, { nome: 'Administrador Alvo', email: `admin-${suffix}@example.test`, hash: originalHash, papel: 'admin', forceChange: false });
    other = await usersRepository.create(memory, { nome: 'Outro Administrador', email: `outro-${suffix}@example.test`, hash: originalHash, papel: 'admin', forceChange: false });
    seller = await usersRepository.create(memory, { nome: 'Vendedor', email: `vendedor-${suffix}@example.test`, hash: originalHash, papel: 'vendedor', forceChange: false });
    newPassword = randomBytes(4).toString('hex');
    tokens = [secret(), secret(), secret()];
    await authRepository.create(memory, admin.id, digestToken(tokens[0]!), 28800);
    await authRepository.create(memory, admin.id, digestToken(tokens[1]!), 28800);
    await authRepository.create(memory, other.id, digestToken(tokens[2]!), 28800);
    writes = 0; passwordReads = 0; confirmationReads = 0; databaseLoads = 0;
    metadata = { banco: 'db_credi_dev', endereco: '127.0.0.1' };

    // PGlite não tem conexão TCP. Somente os metadados de rede/destino são
    // simulados; repositórios, SQL, locks, transações, hash e auditoria são reais.
    function wrapped(delegate: Queryable): Queryable {
      return { async query<R extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) {
        if (sql === RECOVERY_TARGET_SQL) return { rows: [{ ...metadata }] as unknown as R[], rowCount: 1 };
        if (/^\s*(UPDATE|INSERT|DELETE|ALTER|DROP|TRUNCATE)\s/i.test(sql)) writes++;
        return delegate.query<R>(sql, values);
      } };
    }
    db = { ...wrapped(memory), async connect() {
      const client = await memory.connect();
      return { ...wrapped(client), release: () => client.release() };
    } };
  });

  function input(overrides: Partial<AdminResetInput> = {}): AdminResetInput {
    return {
      isTTY: true, email: async () => admin.email,
      password: async () => { passwordReads++; return newPassword; },
      confirmation: async () => { confirmationReads++; return 'REDEFINIR'; }, ...overrides,
    };
  }
  async function run(io = input(), chosenScope = scope, args: string[] = []) {
    await runAdminReset(args, io, chosenScope, async () => { databaseLoads++; return db; });
  }
  async function expectFailure(work: () => Promise<unknown>, code: string) {
    await assert.rejects(work, error => {
      const output = formatAdminError(error, 'Senha administrativa não redefinida.').join('\n');
      assert.ok(output.includes(`[${code}]`));
      for (const value of [originalPassword, newPassword, originalHash, ...tokens]) assert.equal(output.includes(value), false);
      return true;
    });
  }
  async function assertUnchanged(user = admin) {
    const current = await usersRepository.credentialsById(memory, user.id);
    assert.equal(current!.senha_hash === originalHash, true);
    assert.equal(current!.troca_senha_obrigatoria, false);
    assert.equal((await memory.query<{ total: number }>('SELECT count(*)::int AS total FROM historico WHERE entidade_id=$1', [user.id])).rows[0]!.total, 0);
  }

  it('atualiza somente a senha/indicador do admin, preserva identidade e revoga apenas suas sessões', async () => {
    const otherBefore = await usersRepository.credentialsById(memory, other.id);
    const sellerBefore = await usersRepository.credentialsById(memory, seller.id);
    await run();
    const after = await usersRepository.credentialsById(memory, admin.id);
    assert.equal(await verifyPassword(after!.senha_hash, newPassword), true);
    assert.equal(after!.senha_hash.startsWith('$argon2id$'), true);
    assert.equal(after!.troca_senha_obrigatoria, true);
    for (const key of ['id', 'nome', 'email', 'papel', 'ativo'] as const) assert.equal(after![key], admin[key]);
    assert.equal(new Date(after!.criado_em).getTime(), new Date(admin.criado_em).getTime());
    assert.equal(JSON.stringify(await usersRepository.credentialsById(memory, other.id)) === JSON.stringify(otherBefore), true);
    assert.equal(JSON.stringify(await usersRepository.credentialsById(memory, seller.id)) === JSON.stringify(sellerBefore), true);
    assert.equal(await authRepository.session(memory, digestToken(tokens[0]!)), undefined);
    assert.equal(await authRepository.session(memory, digestToken(tokens[1]!)), undefined);
    assert.equal((await authRepository.session(memory, digestToken(tokens[2]!)))!.user.id, other.id);
    assert.equal(confirmationReads, 1);
  });

  it('grava UPDATE com o UUID do administrador e sem segredos no histórico', async () => {
    await run();
    const rows = (await memory.query('SELECT * FROM historico WHERE entidade_id=$1', [admin.id])).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0]!.acao, 'UPDATE'); assert.equal(rows[0]!.user_id, admin.id);
    assert.match(rows[0]!.descricao as string, /CLI local de desenvolvimento/);
    const serialized = JSON.stringify(rows);
    for (const value of [originalPassword, newPassword, originalHash, ...tokens]) assert.equal(serialized.includes(value), false);
  });

  it('recusa produção, teste, NODE_ENV ausente, outro banco e host remoto antes de interação/conexão', async () => {
    for (const [candidate, code] of [
      [{ ...scope, nodeEnv: 'production' }, 'development_only'], [{ ...scope, nodeEnv: 'test' }, 'development_only'],
      [{ ...scope, nodeEnv: undefined }, 'development_only'], [{ ...scope, database: 'db_credi_prod' }, 'local_database_only'],
      [{ ...scope, host: 'db.example.test' }, 'local_host_only'], [{ ...scope, host: 'localhost.example.test' }, 'local_host_only'],
    ] as const) await expectFailure(() => run(input(), candidate), code);
    assert.equal(databaseLoads, 0); assert.equal(passwordReads, 0); assert.equal(writes, 0);
  });

  it('aceita apenas hosts locais explícitos na configuração', () => {
    for (const host of ['127.0.0.1', 'localhost', '::1']) assert.doesNotThrow(() => assertAdminRecoveryScope({ ...scope, host }));
  });

  it('confere banco e endereço reais antes de solicitar senha', async () => {
    for (const target of [
      { banco: 'outro_banco', endereco: '127.0.0.1' },
      { banco: 'db_credi_dev', endereco: '192.0.2.10' },
      { banco: 'db_credi_dev', endereco: null },
    ]) {
      metadata = target;
      await expectFailure(() => run(), 'invalid_recovery_target');
    }
    assert.equal(passwordReads, 0); assert.equal(writes, 0);
  });

  it('aceita conexão local IPv6 validada', async () => {
    metadata.endereco = '::1';
    await run();
    assert.equal((await usersRepository.byId(memory, admin.id))!.troca_senha_obrigatoria, true);
  });

  it('exige terminal interativo e recusa flags de automação', async () => {
    await expectFailure(() => run(input({ isTTY: false })), 'recovery_interactive_only');
    await expectFailure(() => run(input(), scope, ['--yes']), 'recovery_arguments_not_allowed');
    await expectFailure(() => run(input(), scope, ['--password-stdin']), 'recovery_arguments_not_allowed');
    assert.equal(databaseLoads, 0); assert.equal(writes, 0);
  });

  it('recusa conta inexistente, e-mail inválido e vendedor sem solicitar senha', async () => {
    await expectFailure(() => run(input({ email: async () => `ausente-${randomBytes(8).toString('hex')}@example.test` })), 'admin_not_found');
    await expectFailure(() => run(input({ email: async () => 'invalido' })), 'invalid_format');
    await expectFailure(() => run(input({ email: async () => seller.email })), 'admin_required');
    assert.equal(passwordReads, 0); assert.equal(writes, 0); await assertUnchanged(); await assertUnchanged(seller);
  });

  it('normaliza e-mail informado sem reescrever o e-mail cadastrado', async () => {
    await run(input({ email: async () => ` ${admin.email.toUpperCase()} ` }));
    assert.equal((await usersRepository.byId(memory, admin.id))!.email, admin.email);
  });

  it('senha com menos de oito caracteres e confirmação diferente não alteram dados', async () => {
    const short = randomBytes(4).toString('hex').slice(0, 7);
    await expectFailure(() => run(input({ password: async () => short })), 'too_small');
    let count = 0;
    await expectFailure(() => run(input({ password: async () => ++count === 1 ? newPassword : secret() })), 'password_mismatch');
    assert.equal(confirmationReads, 0); assert.equal(writes, 0); await assertUnchanged();
  });

  it('Enter, sim ou confirmação incorreta cancelam sem alterar dados', async () => {
    for (const answer of ['', 'sim', 'redefinir']) {
      await expectFailure(() => run(input({ confirmation: async () => answer })), 'confirmation_required');
    }
    assert.equal(writes, 0); await assertUnchanged();
    assert.notEqual(await authRepository.session(memory, digestToken(tokens[0]!)), undefined);
  });

  it('núcleo transacional também recusa ausência de confirmação', async () => {
    await expectFailure(() => recoverAdminPassword(db, scope, { id: admin.id, email: admin.email, senha: newPassword }, false), 'confirmation_required');
    assert.equal(writes, 0); await assertUnchanged();
  });

  it('revalida o destino dentro da transação antes de escrever', async () => {
    await expectFailure(() => run(input({ confirmation: async () => {
      metadata.banco = 'outro_banco'; return 'REDEFINIR';
    } })), 'invalid_recovery_target');
    assert.equal(writes, 0); await assertUnchanged();
  });

  it('não redefine conta cujo papel mudou depois da seleção', async () => {
    await expectFailure(() => run(input({ confirmation: async () => {
      await memory.query("UPDATE usuarios SET papel='vendedor' WHERE id=$1", [admin.id]); return 'REDEFINIR';
    } })), 'recovery_account_changed');
    assert.equal(writes, 0); await assertUnchanged();
  });

  it('falha no histórico reverte a senha, o indicador e as revogações', async () => {
    const suffix = randomBytes(8).toString('hex');
    await memory.query(`CREATE FUNCTION recovery_fail_${suffix}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'falha de auditoria isolada'; END $$`);
    await memory.query(`CREATE TRIGGER recovery_fail_${suffix} BEFORE INSERT ON historico FOR EACH ROW
      WHEN (NEW.entidade_id = '${admin.id}') EXECUTE FUNCTION recovery_fail_${suffix}()`);
    await assert.rejects(() => run());
    await assertUnchanged();
    assert.notEqual(await authRepository.session(memory, digestToken(tokens[0]!)), undefined);
    assert.notEqual(await authRepository.session(memory, digestToken(tokens[1]!)), undefined);
  });

  it('mantém conta desativada desativada', async () => {
    await memory.query('UPDATE usuarios SET ativo=false WHERE id=$1', [admin.id]);
    await run();
    assert.equal((await usersRepository.byId(memory, admin.id))!.ativo, false);
  });

  it('fluxo existente permite login com nova senha e exige outra troca antes do gerenciamento', async () => {
    await run();
    const service = new AuthService(db);
    await assert.rejects(() => service.login({ email: admin.email, senha: originalPassword }));
    const login = await service.login({ email: admin.email, senha: newPassword });
    assert.equal(login.user.troca_senha_obrigatoria, true);
    const context = (await authRepository.session(db, digestToken(login.token)))!;
    await assert.rejects(() => new UsersService(db).list(context, 20, 0), { status: 403 });
    await assert.rejects(() => service.profile(context, 'Ainda Bloqueado'), { status: 403 });
    const definitive = secret();
    await service.changePassword(context, { senha_atual: newPassword, nova_senha: definitive });
    assert.equal((await usersRepository.byId(memory, admin.id))!.troca_senha_obrigatoria, false);
    assert.equal(await authRepository.session(db, digestToken(login.token)), undefined);
    const final = await service.login({ email: admin.email, senha: definitive });
    assert.equal(final.user.troca_senha_obrigatoria, false);
    const authorized = (await authRepository.session(db, digestToken(final.token)))!;
    assert.ok((await new UsersService(db).list(authorized, 20, 0)).length > 0);
  });

  it('executável recusa produção e entrada não interativa sem abrir o banco', () => {
    for (const [environment, code] of [
      [{ NODE_ENV: 'production' }, 'development_only'],
      [{ NODE_ENV: 'development' }, 'recovery_interactive_only'],
      [{ NODE_ENV: 'development', DB_NAME: 'outro_banco' }, 'local_database_only'],
      [{ NODE_ENV: 'development', DB_HOST: 'db.example.test' }, 'local_host_only'],
    ] as const) {
      const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/reset-admin-password.ts'], {
        cwd: new URL('..', import.meta.url), windowsHide: true, encoding: 'utf8', timeout: 10000,
        env: { ...process.env, DB_NAME: 'db_credi_dev', DB_HOST: '127.0.0.1', DB_PORT: '1', ...environment },
      });
      assert.equal(result.status, 1); assert.ok(result.stderr.includes(`[${code}]`));
      assert.equal(result.stdout.includes('redefinida'), false);
    }
  });
});
