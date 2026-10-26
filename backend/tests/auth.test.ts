import './environment.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Client, createTestContext, nextPassword, origin, testPassword } from './support.js';
import { bootstrapAdmin } from '../src/modules/usuarios/bootstrap-admin.js';
import { digestToken } from '../src/shared/session.js';
import { authRepository } from '../src/modules/auth/auth.repository.js';
import { transaction } from '../src/database/transaction.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { UsersService } from '../src/modules/usuarios/usuarios.service.js';

describe('Autenticação e usuários com HTTP, Argon2id e PostgreSQL isolado', { concurrency: false }, () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;
  before(async () => { context = await createTestContext(); });
  beforeEach(async () => { await context.reset(); });
  after(async () => { await context?.close(); });

  async function admin() {
    const user = await context.user('admin');
    const client = context.client();
    assert.equal((await client.login(user.email)).status, 200);
    return { user, client };
  }
  async function seller() {
    const user = await context.user();
    const client = context.client();
    assert.equal((await client.login(user.email)).status, 200);
    return { user, client };
  }

  it('login correto normaliza e-mail, protege cookie e persiste somente hash de token', async () => {
    await context.user();
    const client = context.client();
    const response = await client.login(' VENDEDOR@EXAMPLE.TEST ');
    assert.equal(response.status, 200);
    assert.equal(response.body.usuario!.email, 'vendedor@example.test');
    assert.match(response.headers.getSetCookie().find(value => value.startsWith('dnb_session='))!, /HttpOnly/);
    assert.match(response.headers.getSetCookie().find(value => value.startsWith('dnb_session='))!, /SameSite=Lax/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const token = client.cookies.get('dnb_session')!;
    const session = (await context.db.query('SELECT token_hash,expira_em,criado_em FROM sessoes')).rows[0]!;
    assert.equal(session.token_hash, digestToken(token));
    assert.notEqual(session.token_hash, token);
    assert.equal(response.text.includes(token), false);
    assert.equal(response.text.includes('senha_hash'), false);
    assert.equal((await client.request('/api/auth/me')).status, 200);
  });

  it('senha incorreta, conta inexistente e conta inativa têm resposta genérica idêntica', async () => {
    await context.user();
    await context.user('vendedor', 'inativa@example.test', false);
    const responses = [
      await context.client().login('vendedor@example.test', 'senha incorreta'),
      await context.client().login('ausente@example.test'),
      await context.client().login('inativa@example.test'),
    ];
    for (const response of responses) {
      assert.equal(response.status, 401);
      assert.deepEqual(response.body, { status: 'error', message: 'E-mail ou senha inválidos.' });
    }
    assert.equal((await context.db.query('SELECT * FROM sessoes')).rows.length, 0);
  });

  it('login de conta antiga com e-mail gravado em maiúsculas ignora caixa sem reescrever a identidade', async () => {
    const user = await context.user('admin', 'ADMIN-ANTIGO@EXAMPLE.TEST');
    const response = await context.client().login(' admin-antigo@example.test ');
    assert.equal(response.status, 200);
    assert.equal(response.body.usuario!.id, user.id);
    assert.equal((await context.db.query('SELECT email FROM usuarios WHERE id=$1', [user.id])).rows[0]!.email, user.email);
  });

  it('sessão que expira depois do BEGIN é recusada na revalidação transacional', async () => {
    const { client } = await seller();
    const tokenHash = digestToken(client.cookies.get('dnb_session')!);
    await transaction(context.db, async db => {
      await db.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
      await db.query("UPDATE sessoes SET criado_em=now()-interval '1 minute',expira_em=clock_timestamp()+interval '300 milliseconds'");
      const current = (await authRepository.session(db, tokenHash))!;
      assert.ok(current);
      // Representa o tempo transcorrido após BEGIN, inclusive espera por locks.
      await new Promise(resolve => setTimeout(resolve, 350));
      assert.equal(await authRepository.current(db, current.sessionId), undefined);
      assert.equal(await authRepository.session(db, tokenHash), undefined);
    });
  });

  it('rotas privadas recusam ausência de autenticação e cookies malformados', async () => {
    assert.equal((await context.client().request('/api/auth/me')).status, 401);
    assert.equal((await context.client().request('/api/usuarios')).status, 401);
    const client = context.client(); client.cookies.set('dnb_session', 'invalido');
    assert.equal((await client.request('/api/auth/me')).status, 401);
  });

  it('vendedor não lista, lê, cadastra ou promove outros usuários', async () => {
    const { user, client } = await seller();
    assert.equal((await client.request('/api/usuarios')).status, 403);
    assert.equal((await client.request(`/api/usuarios/${user.id}`)).status, 403);
    assert.equal((await client.request('/api/usuarios', { method: 'POST', body: { nome: 'Tentativa', email: 'outra@example.test', senha: testPassword } })).status, 403);
    assert.equal((await client.request(`/api/usuarios/${user.id}`, { method: 'PATCH', body: { papel: 'admin' } })).status, 403);
  });

  it('administrador cadastra vendedor com e-mail normalizado, Argon2id e histórico atômico', async () => {
    const { user, client } = await admin();
    const response = await client.request('/api/usuarios', { method: 'POST', body: { nome: 'Novo Vendedor', email: ' NOVO@EXAMPLE.TEST ', senha: testPassword } });
    assert.equal(response.status, 201);
    assert.equal(response.body.usuario!.papel, 'vendedor');
    assert.equal(response.body.usuario!.email, 'novo@example.test');
    assert.equal(response.body.usuario!.troca_senha_obrigatoria, true);
    const stored = (await context.db.query('SELECT senha_hash FROM usuarios WHERE id=$1', [response.body.usuario!.id])).rows[0]!;
    const encoded = stored.senha_hash as string;
    assert.equal(encoded.startsWith('$argon2id$v=19$'), true);
    assert.deepEqual(encoded.split('$')[3]!.split(',').sort(), ['m=19456', 'p=1', 't=2']);
    const history = (await context.db.query('SELECT * FROM historico')).rows[0]!;
    assert.equal(history.user_id, user.id); assert.equal(history.acao, 'CREATE');
    assert.equal(JSON.stringify(history).includes(testPassword), false);
    assert.equal(response.text.includes('senha_hash'), false);
  });

  it('campos adicionais não permitem criar admin ou atualizar privilégio pelo perfil', async () => {
    const { client } = await admin();
    assert.equal((await client.request('/api/usuarios', { method: 'POST', body: { nome: 'Tentativa', email: 'tentativa@example.test', senha: testPassword, papel: 'admin' } })).status, 400);
    const own = await seller();
    assert.equal((await own.client.request('/api/auth/me', { method: 'PATCH', body: { nome: 'Nome Alterado', papel: 'admin' } })).status, 400);
    assert.equal((await context.db.query('SELECT papel FROM usuarios WHERE id=$1', [own.user.id])).rows[0]!.papel, 'vendedor');
  });

  it('e-mail duplicado por caixa em cadastro ou atualização retorna 409', async () => {
    const { client } = await admin();
    const target = await context.user();
    assert.equal((await client.request('/api/usuarios', { method: 'POST', body: { nome: 'Duplicado', email: 'VENDEDOR@EXAMPLE.TEST', senha: testPassword } })).status, 409);
    assert.equal((await client.request(`/api/usuarios/${target.id}`, { method: 'PATCH', body: { email: 'ADMIN@EXAMPLE.TEST' } })).status, 409);
    assert.equal((await context.db.query('SELECT * FROM historico')).rows.length, 0);
  });

  it('troca de senha exige senha atual, revoga todas as sessões e aceita nova credencial', async () => {
    const { user, client } = await seller();
    const other = context.client(); await other.login(user.email);
    assert.equal((await client.request('/api/auth/change-password', { method: 'POST', body: { senha_atual: 'incorreta', nova_senha: nextPassword } })).status, 401);
    assert.equal((await client.request('/api/auth/change-password', { method: 'POST', body: { senha_atual: testPassword, nova_senha: nextPassword } })).status, 200);
    assert.equal((await other.request('/api/auth/me')).status, 401);
    assert.equal((await context.client().login(user.email, testPassword)).status, 401);
    assert.equal((await context.client().login(user.email, nextPassword)).status, 200);
  });

  it('logout revoga sessão no banco e impede replay do cookie', async () => {
    const { client } = await seller();
    const replay = context.client(); replay.cookies.set('dnb_session', client.cookies.get('dnb_session')!);
    assert.equal((await client.request('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
    assert.equal(client.cookies.has('dnb_session'), false);
    assert.equal((await replay.request('/api/auth/me')).status, 401);
    assert.notEqual((await context.db.query('SELECT revogada_em FROM sessoes')).rows[0]!.revogada_em, null);
  });

  it('sessão expirada é recusada', async () => {
    const { client } = await seller();
    await context.db.query("UPDATE sessoes SET criado_em=now()-interval '1 day',expira_em=now()-interval '1 second'");
    assert.equal((await client.request('/api/auth/me')).status, 401);
  });

  it('desativação bloqueia sessões e reativação não restaura sessões revogadas', async () => {
    const administrator = await admin(); const own = await seller();
    const url = `/api/usuarios/${own.user.id}/status`;
    assert.equal((await administrator.client.request(url, { method: 'PATCH', body: { ativo: false, senha_admin: testPassword } })).status, 200);
    assert.equal((await own.client.request('/api/auth/me')).status, 401);
    assert.equal((await context.client().login(own.user.email)).status, 401);
    assert.equal((await administrator.client.request(url, { method: 'PATCH', body: { ativo: true, senha_admin: testPassword } })).status, 200);
    assert.equal((await own.client.request('/api/auth/me')).status, 401);
  });

  it('validação recusa UUID, e-mail, senha curta, paginação e campos desconhecidos', async () => {
    const { client } = await admin();
    for (const body of [
      { nome: 'A', email: 'invalido', senha: 'curta' },
      { nome: 'Nome Válido', email: 'valido@example.test', senha: 'curta' },
      { nome: 'Nome Válido', email: 'valido@example.test', senha: testPassword, ativo: true },
    ]) assert.equal((await client.request('/api/usuarios', { method: 'POST', body })).status, 400);
    assert.equal((await client.request('/api/usuarios/invalido')).status, 400);
    assert.equal((await client.request('/api/usuarios?limit=1000')).status, 400);
  });

  it('CSRF é obrigatório inclusive no login, logout e atualizações', async () => {
    const anonymous = context.client();
    assert.equal((await anonymous.request('/api/auth/login', { method: 'POST', body: { email: 'vendedor@example.test', senha: testPassword } })).status, 403);
    const { client } = await seller();
    assert.equal((await client.request('/api/auth/logout', { method: 'POST', body: {}, csrf: false })).status, 403);
    assert.equal((await client.request('/api/auth/me', { method: 'PATCH', body: { nome: 'Novo Nome' }, headers: { 'X-CSRF-Token': 'x'.repeat(43) } })).status, 403);
    assert.equal((await client.request('/api/auth/me')).status, 200);
  });

  it('CSRF é vinculado à sessão e o pré-login não serve após autenticar', async () => {
    const user = await context.user(); const client = context.client();
    await client.request('/api/auth/csrf'); const preLogin = client.csrf!;
    const login = await client.request('/api/auth/login', { method: 'POST', body: { email: user.email, senha: testPassword } });
    assert.equal(login.status, 200); assert.notEqual(client.csrf, preLogin);
    assert.equal((await client.request('/api/auth/logout', { method: 'POST', body: {}, headers: { 'X-CSRF-Token': preLogin } })).status, 403);
    const another = context.client(); await another.login(user.email);
    assert.equal((await client.request('/api/auth/logout', { method: 'POST', body: {}, headers: { 'X-CSRF-Token': another.csrf! } })).status, 403);
  });

  it('Origin ausente ou não permitido é recusado e CORS não usa wildcard', async () => {
    const { client } = await seller();
    assert.equal((await client.request('/api/auth/logout', { method: 'POST', body: {}, headers: { Origin: 'https://hostil.example' } })).status, 403);
    assert.equal((await client.request('/api/auth/logout', { method: 'POST', body: {}, headers: { Origin: '' } })).status, 403);
    const preflight = await client.request('/api/usuarios', { method: 'OPTIONS' });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  });

  it('último administrador ativo não pode ser desativado ou rebaixado', async () => {
    const { user, client } = await admin();
    assert.equal((await client.request(`/api/usuarios/${user.id}/status`, { method: 'PATCH', body: { ativo: false, senha_admin: testPassword } })).status, 409);
    assert.equal((await client.request(`/api/usuarios/${user.id}`, { method: 'PATCH', body: { papel: 'vendedor', senha_admin: testPassword } })).status, 409);
    assert.equal((await context.db.query("SELECT count(*)::int AS total FROM usuarios WHERE papel='admin' AND ativo")).rows[0]!.total, 1);
  });

  it('promoção exige reautenticação e revoga a sessão com o papel antigo', async () => {
    const administrator = await admin(); const own = await seller();
    const url = `/api/usuarios/${own.user.id}`;
    assert.equal((await administrator.client.request(url, { method: 'PATCH', body: { papel: 'admin' } })).status, 403);
    assert.equal((await administrator.client.request(url, { method: 'PATCH', body: { papel: 'admin', senha_admin: 'incorreta' } })).status, 403);
    assert.equal((await administrator.client.request(url, { method: 'PATCH', body: { papel: 'admin', senha_admin: testPassword } })).status, 200);
    assert.equal((await own.client.request('/api/auth/me')).status, 401);
    const logged = await context.client().login(own.user.email);
    assert.equal(logged.body.usuario!.papel, 'admin');
  });

  it('requisições concorrentes não eliminam todos os administradores ativos', async () => {
    const first = await admin(); const secondUser = await context.user('admin', 'segundo@example.test');
    const secondClient = context.client(); await secondClient.login(secondUser.email);
    const responses = await Promise.all([
      first.client.request(`/api/usuarios/${first.user.id}/status`, { method: 'PATCH', body: { ativo: false, senha_admin: testPassword } }),
      secondClient.request(`/api/usuarios/${secondUser.id}/status`, { method: 'PATCH', body: { ativo: false, senha_admin: testPassword } }),
    ]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    assert.equal((await context.db.query("SELECT count(*)::int AS total FROM usuarios WHERE papel='admin' AND ativo")).rows[0]!.total, 1);
  });

  it('falha de auditoria reverte cadastro e não expõe detalhes SQL', async () => {
    const { client } = await admin();
    await context.db.query("CREATE FUNCTION test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'detalhe_interno_teste'; END $$");
    await context.db.query('CREATE TRIGGER test_audit_failure BEFORE INSERT ON historico FOR EACH ROW EXECUTE FUNCTION test_audit_failure()');
    try {
      const response = await client.request('/api/usuarios', { method: 'POST', body: { nome: 'Rollback Teste', email: 'rollback@example.test', senha: testPassword } });
      assert.equal(response.status, 500); assert.equal(response.text.includes('detalhe_interno_teste'), false);
      assert.equal((await context.db.query("SELECT * FROM usuarios WHERE email='rollback@example.test'")).rows.length, 0);
    } finally {
      await context.db.query('DROP TRIGGER test_audit_failure ON historico');
      await context.db.query('DROP FUNCTION test_audit_failure()');
    }
  });

  it('limite por conta persiste entre clientes e não é contornado por X-Forwarded-For', async () => {
    for (let i = 0; i < 10; i++) {
      const client = context.client(); await client.request('/api/auth/csrf');
      assert.equal((await client.request('/api/auth/login', { method: 'POST', body: { email: 'ausente@example.test', senha: testPassword }, headers: { 'X-Forwarded-For': `192.0.2.${i}` } })).status, 401);
    }
    const response = await context.client().login('ausente@example.test');
    assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '900');
    const rates = await context.db.query('SELECT chave_hash FROM auth_login_limites');
    assert.equal(rates.rows.length, 2);
    assert.equal(JSON.stringify(rates.rows).includes('ausente@example.test'), false);
  });

  it('limite por IP inclui corpos inválidos e janela vencida permite nova tentativa', async () => {
    const client = context.client(); await client.request('/api/auth/csrf');
    for (let i = 0; i < 50; i++) assert.equal((await client.request('/api/auth/login', { method: 'POST', body: {} })).status, 400);
    assert.equal((await client.request('/api/auth/login', { method: 'POST', body: {} })).status, 429);
    await context.db.query("UPDATE auth_login_limites SET janela_inicio=now()-interval '1 hour'");
    assert.equal((await client.request('/api/auth/login', { method: 'POST', body: {} })).status, 400);
  });

  it('redefinição administrativa exige senha do admin e troca obrigatória na conta afetada', async () => {
    const administrator = await admin(); const own = await seller();
    const url = `/api/usuarios/${own.user.id}/reset-password`;
    assert.equal((await administrator.client.request(url, { method: 'POST', body: { nova_senha: nextPassword, senha_admin: 'incorreta' } })).status, 403);
    assert.equal((await administrator.client.request(url, { method: 'POST', body: { nova_senha: nextPassword, senha_admin: testPassword } })).status, 200);
    assert.equal((await own.client.request('/api/auth/me')).status, 401);
    assert.equal((await own.client.login(own.user.email, nextPassword)).status, 200);
    assert.equal((await own.client.request('/api/auth/me', { method: 'PATCH', body: { nome: 'Bloqueado Até Trocar' } })).status, 403);
    assert.equal((await own.client.request('/api/auth/change-password', { method: 'POST', body: { senha_atual: nextPassword, nova_senha: testPassword } })).status, 200);
    assert.equal((await own.client.login(own.user.email)).body.usuario!.troca_senha_obrigatoria, false);
  });

  it('admin pode revogar sessões de uma conta, vendedor não pode', async () => {
    const administrator = await admin(); const own = await seller();
    const url = `/api/usuarios/${own.user.id}/revoke-sessions`;
    assert.equal((await own.client.request(url, { method: 'POST', body: { senha_admin: testPassword } })).status, 403);
    assert.equal((await administrator.client.request(url, { method: 'POST', body: { senha_admin: testPassword } })).status, 200);
    assert.equal((await own.client.request('/api/auth/me')).status, 401);
  });

  it('perfil pessoal permite apenas nome e não revela informações de outras contas', async () => {
    const { user, client } = await seller();
    const response = await client.request('/api/auth/me', { method: 'PATCH', body: { nome: 'Nome Atualizado' } });
    assert.equal(response.status, 200); assert.equal(response.body.usuario!.nome, 'Nome Atualizado');
    assert.equal(response.body.usuario!.id, user.id);
    assert.equal((await client.request('/api/auth/me', { method: 'PATCH', body: { email: 'novo@example.test' } })).status, 400);
  });

  it('bootstrap cria um único administrador, valida dados e nunca cadastra implicitamente', async () => {
    assert.equal((await context.db.query('SELECT * FROM usuarios')).rows.length, 0);
    await assert.rejects(() => bootstrapAdmin(context.db, { nome: 'Inicial', email: 'inicio@example.test', senha: 'curta' }));
    const user = await bootstrapAdmin(context.db, { nome: 'Administrador Inicial', email: ' INICIO@EXAMPLE.TEST ', senha: testPassword });
    assert.equal(user.papel, 'admin'); assert.equal(user.troca_senha_obrigatoria, false);
    assert.equal('senha_hash' in user, false);
    await assert.rejects(() => bootstrapAdmin(context.db, { nome: 'Outro Admin', email: 'outro@example.test', senha: testPassword }));
    assert.equal((await context.db.query('SELECT * FROM usuarios')).rows.length, 1);
  });

  it('bootstrap não promove conta conflitante e registra criação na mesma transação', async () => {
    await context.user('vendedor', 'conflito@example.test');
    await assert.rejects(() => bootstrapAdmin(context.db, { nome: 'Conflito', email: 'CONFLITO@example.test', senha: testPassword }));
    const user = await bootstrapAdmin(context.db, { nome: 'Inicial Válido', email: 'valido@example.test', senha: testPassword });
    const history = (await context.db.query('SELECT * FROM historico')).rows;
    assert.equal(history.length, 1); assert.equal(history[0]!.user_id, user.id);
    assert.equal(JSON.stringify(history).includes(testPassword), false);
  });

  it('listagem paginada e recurso ausente usam respostas esperadas sem hashes', async () => {
    const { client } = await admin(); await context.user();
    const response = await client.request('/api/usuarios?limit=1&offset=1');
    assert.equal(response.status, 200); assert.equal(response.body.usuarios!.length, 1);
    assert.equal(response.text.includes('senha_hash'), false);
    assert.equal((await client.request('/api/usuarios/00000000-0000-4000-8000-000000000000')).status, 404);
  });

  it('fluxo HTTP completo conecta cadastro, troca obrigatória, gestão, reset, revogação e logout', async () => {
    const administrator = await admin();
    assert.equal((await administrator.client.request('/api/auth/me')).body.usuario!.id, administrator.user.id);
    assert.equal((await administrator.client.request('/api/usuarios')).status, 200);
    const temporary = randomBytes(4).toString('hex');
    const definitive = randomBytes(24).toString('base64url');
    const reset = randomBytes(24).toString('base64url');
    const final = randomBytes(24).toString('base64url');
    const created = await administrator.client.request('/api/usuarios', { method: 'POST', body: {
      nome: 'Vendedor do Fluxo', email: 'fluxo@example.test', senha: temporary,
    } });
    assert.equal(created.status, 201);
    const id = created.body.usuario!.id;
    assert.equal((await administrator.client.request(`/api/usuarios/${id}`)).body.usuario!.troca_senha_obrigatoria, true);
    const own = context.client();
    assert.equal((await own.login('fluxo@example.test', temporary)).body.usuario!.troca_senha_obrigatoria, true);
    assert.equal((await own.request('/api/auth/me', { method: 'PATCH', body: { nome: 'Ainda Bloqueado' } })).status, 403);
    assert.equal((await own.request('/api/auth/change-password', { method: 'POST', body: { senha_atual: temporary, nova_senha: definitive } })).status, 200);
    assert.equal((await own.request('/api/auth/me')).status, 401);
    assert.equal((await own.login('fluxo@example.test', definitive)).body.usuario!.troca_senha_obrigatoria, false);
    assert.equal((await own.request('/api/auth/me')).body.usuario!.id, id);
    assert.equal((await own.request('/api/auth/me', { method: 'PATCH', body: { nome: 'Nome Pessoal' } })).body.usuario!.nome, 'Nome Pessoal');
    for (const [method, path, body] of [
      ['GET', '/api/usuarios', undefined], ['GET', `/api/usuarios/${administrator.user.id}`, undefined],
      ['POST', '/api/usuarios', { nome: 'Proibido', email: 'proibido@example.test', senha: temporary }],
      ['PATCH', `/api/usuarios/${id}`, { papel: 'admin', senha_admin: definitive }],
      ['PATCH', `/api/usuarios/${id}/status`, { ativo: false, senha_admin: definitive }],
      ['POST', `/api/usuarios/${id}/reset-password`, { nova_senha: reset, senha_admin: definitive }],
      ['POST', `/api/usuarios/${id}/revoke-sessions`, { senha_admin: definitive }],
    ] as const) assert.equal((await own.request(path, { method, body })).status, 403);

    const updated = await administrator.client.request(`/api/usuarios/${id}`, { method: 'PATCH', body: { nome: 'Nome Administrativo', email: 'ALTERADO@EXAMPLE.TEST' } });
    assert.equal(updated.status, 200); assert.equal(updated.body.usuario!.email, 'alterado@example.test');
    assert.equal((await own.request('/api/auth/me')).status, 401);
    assert.equal((await own.login('alterado@example.test', definitive)).status, 200);
    assert.equal((await administrator.client.request(`/api/usuarios/${id}`, { method: 'PATCH', body: { papel: 'admin', senha_admin: testPassword } })).status, 200);
    assert.equal((await own.request('/api/usuarios')).status, 401);
    assert.equal((await own.login('alterado@example.test', definitive)).body.usuario!.papel, 'admin');
    assert.equal((await own.request('/api/usuarios')).status, 200);
    assert.equal((await administrator.client.request(`/api/usuarios/${id}`, { method: 'PATCH', body: { papel: 'vendedor', senha_admin: testPassword } })).status, 200);
    assert.equal((await own.request('/api/auth/me')).status, 401);
    assert.equal((await own.login('alterado@example.test', definitive)).body.usuario!.papel, 'vendedor');
    assert.equal((await administrator.client.request(`/api/usuarios/${id}/status`, { method: 'PATCH', body: { ativo: false, senha_admin: testPassword } })).status, 200);
    assert.equal((await own.request('/api/auth/me')).status, 401);
    assert.equal((await own.login('alterado@example.test', definitive)).status, 401);
    assert.equal((await administrator.client.request(`/api/usuarios/${id}/status`, { method: 'PATCH', body: { ativo: true, senha_admin: testPassword } })).status, 200);
    assert.equal((await own.request('/api/auth/me')).status, 401);
    assert.equal((await own.login('alterado@example.test', definitive)).status, 200);
    assert.equal((await administrator.client.request(`/api/usuarios/${id}/reset-password`, { method: 'POST', body: { nova_senha: reset, senha_admin: testPassword } })).status, 200);
    assert.equal((await own.request('/api/auth/me')).status, 401);
    assert.equal((await own.login('alterado@example.test', reset)).body.usuario!.troca_senha_obrigatoria, true);
    assert.equal((await own.request('/api/auth/change-password', { method: 'POST', body: { senha_atual: reset, nova_senha: final } })).status, 200);
    assert.equal((await own.login('alterado@example.test', final)).body.usuario!.troca_senha_obrigatoria, false);
    assert.equal((await administrator.client.request(`/api/usuarios/${id}/revoke-sessions`, { method: 'POST', body: { senha_admin: testPassword } })).status, 200);
    assert.equal((await own.request('/api/auth/me')).status, 401);
    assert.equal((await own.login('alterado@example.test', final)).status, 200);
    for (const client of [own, administrator.client]) {
      const replay = context.client();
      replay.cookies.set('dnb_session', client.cookies.get('dnb_session')!);
      assert.equal((await client.request('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
      assert.equal((await replay.request('/api/auth/me')).status, 401);
    }
    const history = (await context.db.query('SELECT * FROM historico WHERE entidade_id=$1 ORDER BY id', [id])).rows;
    assert.equal(history.length, 11);
    assert.equal(history[0]!.acao, 'CREATE');
    assert.ok(history.slice(1).every(row => row.acao === 'UPDATE'));
    assert.ok(history.every(row => row.user_id === administrator.user.id || row.user_id === id));
    for (const secret of [temporary, definitive, reset, final, testPassword]) assert.equal(JSON.stringify(history).includes(secret), false);
  });

  it('contexto antigo não autoriza mutações depois de revogação, rebaixamento ou desativação', async () => {
    const administrator = await admin();
    const tokenHash = digestToken(administrator.client.cookies.get('dnb_session')!);
    const stale = (await authRepository.session(context.db, tokenHash))!;
    const users = new UsersService(context.db), auth = new AuthService(context.db);
    await context.db.query("UPDATE usuarios SET papel='vendedor' WHERE id=$1", [administrator.user.id]);
    await assert.rejects(() => users.list(stale, 20, 0), { status: 403 });
    await context.db.query('UPDATE usuarios SET ativo=false WHERE id=$1', [administrator.user.id]);
    await assert.rejects(() => auth.profile(stale, 'Não Deve Atualizar'), { status: 401 });
    await context.db.query("UPDATE usuarios SET ativo=true,papel='admin' WHERE id=$1", [administrator.user.id]);
    await authRepository.revoke(context.db, stale.sessionId);
    await assert.rejects(() => auth.profile(stale, 'Não Deve Atualizar'), { status: 401 });
    assert.equal((await context.db.query('SELECT nome FROM usuarios WHERE id=$1', [administrator.user.id])).rows[0]!.nome, administrator.user.nome);
    assert.equal((await context.db.query('SELECT * FROM historico')).rows.length, 0);
  });

  it('falha de auditoria no reset HTTP reverte senha, troca obrigatória e revogações', async () => {
    const administrator = await admin(), own = await seller();
    await context.db.query("CREATE FUNCTION reset_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'detalhe_privado'; END $$");
    await context.db.query('CREATE TRIGGER reset_audit_failure BEFORE INSERT ON historico FOR EACH ROW EXECUTE FUNCTION reset_audit_failure()');
    try {
      const response = await administrator.client.request(`/api/usuarios/${own.user.id}/reset-password`, { method: 'POST', body: { nova_senha: nextPassword, senha_admin: testPassword } });
      assert.equal(response.status, 500); assert.equal(response.text.includes('detalhe_privado'), false);
      assert.equal((await own.client.request('/api/auth/me')).status, 200);
      assert.equal((await context.client().login(own.user.email)).body.usuario!.troca_senha_obrigatoria, false);
      assert.equal((await context.client().login(own.user.email, nextPassword)).status, 401);
      assert.equal((await context.db.query('SELECT * FROM historico')).rows.length, 0);
    } finally {
      await context.db.query('DROP TRIGGER reset_audit_failure ON historico');
      await context.db.query('DROP FUNCTION reset_audit_failure()');
    }
  });

  it('todas as mutações administrativas exigem CSRF antes de alterar dados', async () => {
    const administrator = await admin(), own = await seller();
    for (const [method, path, body] of [
      ['POST', '/api/usuarios', { nome: 'Sem CSRF', email: 'semcsrf@example.test', senha: testPassword }],
      ['PATCH', `/api/usuarios/${own.user.id}`, { nome: 'Sem CSRF', papel: 'admin', senha_admin: testPassword }],
      ['PATCH', `/api/usuarios/${own.user.id}/status`, { ativo: false, senha_admin: testPassword }],
      ['POST', `/api/usuarios/${own.user.id}/reset-password`, { nova_senha: nextPassword, senha_admin: testPassword }],
      ['POST', `/api/usuarios/${own.user.id}/revoke-sessions`, { senha_admin: testPassword }],
    ] as const) assert.equal((await administrator.client.request(path, { method, body, csrf: false })).status, 403);
    assert.equal((await own.client.request('/api/auth/change-password', { method: 'POST', body: { senha_atual: testPassword, nova_senha: nextPassword }, csrf: false })).status, 403);
    assert.equal((await own.client.request('/api/auth/me')).status, 200);
    assert.equal((await context.db.query('SELECT * FROM historico')).rows.length, 0);
  });
});
