import './environment.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { ZodError } from 'zod';
import { runAdminCreate, readStdinPassword, type AdminInput } from '../src/cli/admin-command.js';
import { formatAdminError } from '../src/cli/admin-errors.js';
import { validateEnv } from '../src/config/env-validation.js';

const args = ['--nome', 'Administrador Isolado', '--email', 'admin@example.test', '--password-stdin'];
const randomPassword = (): string => randomBytes(32).toString('base64url');
function invoke(script: string, argv: string[], password: string, environment: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', script, ...argv], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, DNB_TEST_DATABASE: '', ...environment },
    input: password, encoding: 'utf8', windowsHide: true, timeout: 20000,
  });
}
function input(password: string): AdminInput {
  return { isTTY: false, identity: async values => values, password: async () => password, stdinPassword: async () => password };
}
async function invalid(argv: string[], password = randomPassword()): Promise<string> {
  let loads = 0;
  try {
    await runAdminCreate(argv, input(password), async () => { loads++; throw new Error('Banco não deve ser carregado.'); });
    assert.fail('Entrada deveria ser recusada.');
  } catch (error) {
    assert.equal(loads, 0);
    const output = formatAdminError(error).join('\n');
    if (password) assert.equal(output.includes(password), false);
    return output;
  }
}

describe('CLI administrativo: validação, diagnóstico e isolamento', () => {
  it('cria primeiro administrador com stdin, senha aleatória de 8 caracteres e Argon2id no PostgreSQL em memória', () => {
    const secret = randomBytes(4).toString('hex');
    const result = invoke('tests/fixtures/admin-cli-worker.ts', args, `${secret}\r\n`);
    assert.equal(result.status, 0, 'O procedimento isolado deve concluir.');
    assert.equal(result.stderr, '');
    const summary = JSON.parse(result.stdout.trim().split('\n').at(-1)!);
    assert.deepEqual(summary, { total: 1, admins: 1, audit: 1, argon2id: true, passwordVerified: true, existingPreserved: null, databaseLoads: 1 });
    assert.equal((result.stdout + result.stderr).includes(secret), false);
  });

  it('administrador existente é preservado e não gera outra conta', () => {
    const secret = randomPassword();
    const result = invoke('tests/fixtures/admin-cli-worker.ts', args, secret, { ADMIN_CLI_SCENARIO: 'existing' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /administrador \[already_exists\]/);
    const summary = JSON.parse(result.stdout.trim().split('\n').at(-1)!);
    assert.equal(summary.total, 1); assert.equal(summary.admins, 1); assert.equal(summary.existingPreserved, true); assert.equal(summary.audit, 0);
    assert.equal((result.stdout + result.stderr).includes(secret), false);
  });

  it('e-mail conflitante não promove vendedor nem modifica o usuário existente', () => {
    const result = invoke('tests/fixtures/admin-cli-worker.ts', args, randomPassword(), { ADMIN_CLI_SCENARIO: 'conflict' });
    assert.equal(result.status, 1); assert.match(result.stderr, /email \[conflict\]/);
    const summary = JSON.parse(result.stdout.trim().split('\n').at(-1)!);
    assert.equal(summary.total, 1); assert.equal(summary.admins, 0); assert.equal(summary.existingPreserved, true); assert.equal(summary.audit, 0);
  });

  it('reproduz o ZodError de e-mail inválido e mostra campo/código antes de ler senha ou banco', async () => {
    const marker = randomBytes(12).toString('hex');
    const argv = ['--nome', 'Nome Válido', '--email', marker, '--password-stdin'];
    let passwordReads = 0;
    try {
      await runAdminCreate(argv, { ...input(randomPassword()), stdinPassword: async () => { passwordReads++; return randomPassword(); } },
        async () => { throw new Error('Não deve conectar.'); });
      assert.fail('E-mail inválido deveria falhar.');
    } catch (error) {
      assert.ok(error instanceof ZodError);
      assert.equal(error.issues[0]!.path[0], 'email'); assert.equal(error.issues[0]!.code, 'invalid_format');
      const output = formatAdminError(error).join('\n');
      assert.match(output, /email \[invalid_format\]: Informe um e-mail válido\./);
      assert.equal(output.includes(marker), false); assert.equal(passwordReads, 0);
    }
  });

  it('nome ausente, curto e com controle têm diagnóstico específico', async () => {
    assert.match(await invalid(['--email', 'admin@example.test', '--password-stdin']), /nome \[invalid_type\]/);
    assert.match(await invalid(['--nome', 'A', '--email', 'admin@example.test', '--password-stdin']), /nome \[too_small\]/);
    assert.match(await invalid(['--nome', 'Nome\u001b', '--email', 'admin@example.test', '--password-stdin']), /nome \[custom\]/);
  });

  it('senha curta, longa, vazia, somente espaços e NUL continuam proibidos', async () => {
    for (const [secret, code] of [
      [randomBytes(3).toString('hex'), 'too_small'], [randomBytes(4).toString('hex').slice(0, 7), 'too_small'],
      [randomPassword().repeat(4), 'too_big'],
      ['', 'too_small'], [' '.repeat(20), 'custom'], [randomPassword() + '\0', 'custom'],
    ]) {
      const output = await invalid(args, secret!);
      assert.ok(output.includes(`senha [${code}]`));
    }
  });

  it('CLI real mostra diagnóstico seguro de validação inclusive em produção', () => {
    const secret = randomPassword();
    const result = invoke('src/cli/create-admin.ts', ['--nome', 'Teste CLI', '--email', 'invalido', '--password-stdin'], secret, { NODE_ENV: 'production' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /email \[invalid_format\]/);
    assert.equal(result.stderr.includes('ZodError'), false);
    assert.equal((result.stdout + result.stderr).includes(secret), false);
  });

  it('opção desconhecida, flag sem valor e posicionais não ecoam argumentos', async () => {
    const secret = randomPassword();
    assert.match(await invalid(['--senha', secret], secret), /argumentos \[unknown_option\]/);
    assert.match(await invalid(['--nome']), /argumentos \[invalid_option_value\]/);
    assert.match(await invalid([secret], secret), /argumentos \[unexpected_positional\]/);
  });

  it('entrada não interativa sem --password-stdin e confirmações diferentes falham com segurança', async () => {
    assert.match(await invalid(args.slice(0, -1)), /senha \[interactive_terminal_required\]/);
    let reads = 0;
    await assert.rejects(() => runAdminCreate([], {
      ...input(randomPassword()), isTTY: true,
      identity: async () => ({ nome: 'Nome Válido', email: 'admin@example.test' }),
      password: async () => { reads++; return randomPassword(); },
    }, async () => { throw new Error('Não deve conectar.'); }), error => {
      assert.match(formatAdminError(error).join('\n'), /confirmacao_senha \[password_mismatch\]/);
      return true;
    });
    assert.equal(reads, 2);
  });

  it('parser de ambiente mantém obrigatoriedade de cada variável sem expor valores', () => {
    const source = { NODE_ENV: 'test', DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_USER: 'test_only', DB_PASSWORD: randomPassword(), DB_NAME: 'isolated_test' };
    for (const field of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
      const candidate: NodeJS.ProcessEnv = { ...source }; delete candidate[field];
      assert.throws(() => validateEnv(candidate), error => {
        const output = formatAdminError(error).join('\n');
        assert.ok(output.includes(`${field} [missing_variable]`));
        assert.equal(output.includes(source.DB_PASSWORD), false); return true;
      });
    }
    assert.equal(validateEnv({ ...source, DB_PASSWORD: '' }).database.password, '');
    assert.equal(validateEnv(source).port, 3000);
  });

  it('CLI real captura variável ausente antes de abrir conexão e não imprime stack ou senha', () => {
    const secret = randomPassword();
    const result = invoke('src/cli/create-admin.ts', args, secret, { DB_USER: '' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DB_USER \[missing_variable\]/);
    assert.equal(result.stderr.includes('at '), false);
    assert.equal((result.stdout + result.stderr).includes(secret), false);
  });

  it('porta inválida e NODE_ENV inválido não revelam o valor rejeitado', () => {
    const marker = randomPassword();
    for (const [field, code] of [['DB_PORT', 'invalid_port'], ['PORT', 'invalid_port'], ['NODE_ENV', 'invalid_environment']]) {
      assert.throws(() => validateEnv({ DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_USER: 'test_only', DB_PASSWORD: '', DB_NAME: 'isolated_test', [field!]: marker }), error => {
        const output = formatAdminError(error).join('\n');
        assert.ok(output.includes(`${field} [${code}]`)); assert.equal(output.includes(marker), false); return true;
      });
    }
  });

  it('stdin preserva Unicode, espaços da senha e remove só uma quebra final de transporte', async () => {
    const secret = ` Ç${randomPassword()} `;
    const bytes = Buffer.from(`${secret}\r\n`);
    const actual = await readStdinPassword(Readable.from([bytes.subarray(0, 2), bytes.subarray(2)]));
    assert.equal(actual === secret, true);
    await assert.rejects(() => readStdinPassword(Readable.from([randomPassword().repeat(100)])), error => {
      assert.match(formatAdminError(error).join('\n'), /senha \[input_too_large\]/); return true;
    });
  });

  it('mensagem, input e path não confiáveis do Zod ou banco nunca são serializados', () => {
    const marker = randomPassword();
    const error = new ZodError([{ code: 'custom', path: [marker], message: marker }]);
    for (const failure of [error, new Error(marker), { code: marker, message: marker }]) {
      assert.equal(formatAdminError(failure).join('\n').includes(marker), false);
    }
  });
});
