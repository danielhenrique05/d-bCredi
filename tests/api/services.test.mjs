import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createBackendServices } from '../../src/services/api/index.ts';
import { ApiError } from '../../src/lib/api/errors.ts';

const tokenBefore = 'a'.repeat(43);
const tokenAfter = 'b'.repeat(43);
const renewed = 'c'.repeat(43);
const id = '00000000-0000-4000-8000-000000000001';
const user = {
  id, nome: 'Pessoa de teste', email: 'pessoa@example.test', papel: 'admin', ativo: true,
  criado_em: '2026-10-26T12:00:00.000Z', troca_senha_obrigatoria: false,
};
const seller = { ...user, id: '00000000-0000-4000-8000-000000000002', papel: 'vendedor', troca_senha_obrigatoria: true };
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});
const csrf = (token = tokenBefore) => json({ csrfToken: token });
const loginResponse = (usuario = user) => json({ usuario, csrfToken: tokenAfter });
const password = () => randomBytes(18).toString('base64url');
const credentials = () => ({ email: user.email, senha: password() });
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function setup(...responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ path: new URL(url).pathname, query: new URL(url).searchParams, options });
    assert.ok(responses.length, 'Não há acesso à rede real: toda resposta deve ser simulada.');
    const next = responses.shift();
    return typeof next === 'function' ? next(url, options) : next;
  };
  return { ...createBackendServices({ baseUrl: 'http://127.0.0.1:3000', production: false, fetchImpl }), calls };
}
const fails = (kind, status) => error => {
  assert.ok(error instanceof ApiError);
  assert.equal(error.kind, kind);
  assert.equal(error.status, status);
  assert.doesNotMatch(error.message + JSON.stringify(error), /never-expose|senha_hash|token_hash/);
  return true;
};
const body = call => JSON.parse(call.options.body);

describe('Serviço de autenticação isolado do Supabase', () => {
  it('importar módulos e criar serviços não faz HTTP nem exige configuração na importação', async () => {
    await import('../../src/services/api/auth.ts');
    await import('../../src/services/api/usuarios.ts');
    const { auth, calls } = setup();
    assert.deepEqual(auth.getState(), { status: 'unknown', usuario: null });
    assert.equal(calls.length, 0);
  });

  it('login usa os campos reais, adota perfil confirmado e compartilha o CSRF novo com usuários', async () => {
    const { auth, usuarios, calls } = setup(csrf(), loginResponse(), json({ usuario: seller }, 201));
    const login = credentials();
    assert.deepEqual(await auth.login({ ...login, papel: 'admin', user_id: id }), user);
    assert.deepEqual(auth.getState(), { status: 'authenticated', usuario: user });
    await usuarios.create({ nome: seller.nome, email: seller.email, senha: password() });
    assert.deepEqual(calls.map(call => [call.path, call.options.method]), [
      ['/api/auth/csrf', 'GET'], ['/api/auth/login', 'POST'], ['/api/usuarios', 'POST'],
    ]);
    assert.deepEqual(Object.keys(body(calls[1])).sort(), ['email', 'senha']);
    assert.equal(calls[1].options.headers['X-CSRF-Token'], tokenBefore);
    assert.equal(calls[2].options.headers['X-CSRF-Token'], tokenAfter);
    assert.ok(calls.every(call => call.options.credentials === 'include'));
    assert.doesNotMatch(JSON.stringify(auth.getState()), new RegExp(login.senha));
    assert.doesNotMatch(JSON.stringify(auth.getState()), /"(?:csrfToken|senha|token_hash)":/);
  });

  it('login inválido propaga 401, sem anunciar autenticação ou repetir a operação', async () => {
    const { auth, calls } = setup(csrf(), json({ message: 'never-expose' }, 401));
    await assert.rejects(auth.login(credentials()), fails('http', 401));
    assert.deepEqual(auth.getState(), { status: 'unknown', usuario: null });
    assert.equal(calls.filter(call => call.path === '/api/auth/login').length, 1);
  });

  it('me restaura o perfil pela API sem obter CSRF ou enviar senha', async () => {
    const { auth, calls } = setup(json({ usuario: user }));
    assert.deepEqual(await auth.me(), user);
    assert.equal(auth.getState().status, 'authenticated');
    assert.equal(calls[0].path, '/api/auth/me');
    assert.equal(calls[0].options.body, undefined);
    assert.equal(calls[0].options.headers['X-CSRF-Token'], undefined);
  });

  it('401 de perfil confirma sessão expirada e limpa perfil e CSRF em memória', async () => {
    const { auth, calls } = setup(csrf(), loginResponse(), json({}, 401), csrf(renewed), loginResponse());
    await auth.login(credentials());
    await assert.rejects(auth.me(), fails('http', 401));
    assert.deepEqual(auth.getState(), { status: 'anonymous', usuario: null });
    await auth.login(credentials());
    assert.equal(calls[3].path, '/api/auth/csrf');
    assert.equal(calls[4].options.headers['X-CSRF-Token'], renewed);
  });

  it('atualiza somente o próprio nome e usa o envelope { usuario }', async () => {
    const updated = { ...user, nome: 'Nome atualizado' };
    const { auth, calls } = setup(json({ usuario: user }), csrf(), json({ usuario: updated }));
    await auth.me();
    assert.deepEqual(await auth.updateProfile({ nome: updated.nome, papel: 'admin', email: 'ignored@example.test' }), updated);
    assert.equal(calls[2].path, '/api/auth/me');
    assert.equal(calls[2].options.method, 'PATCH');
    assert.deepEqual(body(calls[2]), { nome: updated.nome });
    assert.deepEqual(auth.getState().usuario, updated);
  });

  it('logout não limpa o perfil antes de confirmação e depois força nova obtenção CSRF', async () => {
    const waiting = deferred();
    const { auth, calls } = setup(json({ usuario: user }), csrf(), waiting.promise, csrf(renewed), loginResponse());
    await auth.me();
    const pending = auth.logout();
    assert.equal(auth.getState().status, 'authenticated');
    waiting.resolve(json({ message: 'Sessão encerrada.', senha_hash: 'never-expose' }));
    assert.deepEqual(await pending, { message: 'Sessão encerrada.' });
    assert.deepEqual(auth.getState(), { status: 'anonymous', usuario: null });
    assert.equal(calls[2].path, '/api/auth/logout');
    assert.deepEqual(body(calls[2]), {});
    await auth.login(credentials());
    assert.equal(calls[3].path, '/api/auth/csrf');
  });

  it('logout sem confirmação ou com falha de rede rejeita e mantém o último perfil confirmado', async () => {
    const { auth, calls } = setup(json({ usuario: user }), csrf(), () => { throw new TypeError('never-expose'); });
    await auth.me();
    await assert.rejects(auth.logout(), fails('network'));
    assert.equal(auth.getState().status, 'authenticated');
    assert.equal(calls.filter(call => call.path === '/api/auth/logout').length, 1);
  });

  it('logout com 401 limpa identidade expirada mas continua rejeitando, sem sucesso fictício', async () => {
    const { auth } = setup(json({ usuario: user }), csrf(), json({}, 401));
    await auth.me();
    await assert.rejects(auth.logout(), fails('http', 401));
    assert.deepEqual(auth.getState(), { status: 'anonymous', usuario: null });
  });

  it('alteração de senha confirmada remove a identidade e exige novo login', async () => {
    const { auth, calls } = setup(json({ usuario: user }), csrf(), json({ message: 'Senha alterada. Entre novamente.' }));
    await auth.me();
    const input = { senha_atual: password(), nova_senha: password() };
    assert.deepEqual(await auth.changePassword(input), { message: 'Senha alterada. Entre novamente.' });
    assert.deepEqual(auth.getState(), { status: 'anonymous', usuario: null });
    assert.equal(calls[2].path, '/api/auth/change-password');
    assert.deepEqual(Object.keys(body(calls[2])).sort(), ['nova_senha', 'senha_atual']);
  });

  it('senha atual incorreta não limpa a identidade nem redireciona para login', async () => {
    const { auth, calls } = setup(json({ usuario: user }), csrf(), json({}, 401));
    await auth.me();
    await assert.rejects(auth.changePassword({ senha_atual: password(), nova_senha: password() }), fails('http', 401));
    assert.equal(auth.getState().status, 'authenticated');
    assert.equal(calls.some(call => call.path === '/api/auth/login'), false);
  });

  it('troca obrigatória é identificada tanto no login quanto na restauração do perfil', async () => {
    const { auth } = setup(csrf(), loginResponse(seller), json({ usuario: seller }));
    await auth.login(credentials());
    assert.equal(auth.getState().status, 'password_change_required');
    assert.equal(auth.getState().usuario.troca_senha_obrigatoria, true);
    await auth.me();
    assert.equal(auth.getState().status, 'password_change_required');
  });

  it('fluxo de troca obrigatória só retorna autenticado após senha alterada e novo login', async () => {
    const definitive = { ...seller, troca_senha_obrigatoria: false };
    const { auth, calls } = setup(csrf(), loginResponse(seller), json({}, 403), json({ message: 'Entre novamente.' }), csrf(renewed), loginResponse(definitive));
    await auth.login(credentials());
    await assert.rejects(auth.updateProfile({ nome: 'Outro nome' }), fails('http', 403));
    assert.equal(auth.getState().status, 'password_change_required');
    await auth.changePassword({ senha_atual: password(), nova_senha: password() });
    assert.equal(auth.getState().status, 'anonymous');
    await auth.login(credentials());
    assert.equal(auth.getState().status, 'authenticated');
    assert.equal(calls.filter(call => call.path === '/api/auth/change-password').length, 1);
  });

  it('renovação CSRF explícita usa o gerenciador compartilhado, sem chamadas duplicadas', async () => {
    const waiting = deferred();
    const { auth, calls } = setup(waiting.promise, loginResponse());
    const first = auth.refreshCsrf();
    const second = auth.refreshCsrf();
    waiting.resolve(csrf());
    assert.deepEqual(await Promise.all([first, second]), [{ csrfToken: tokenBefore }, { csrfToken: tokenBefore }]);
    await auth.login(credentials());
    assert.equal(calls.filter(call => call.path === '/api/auth/csrf').length, 1);
  });

  it('não guarda nem retorna campos privados, e snapshots não alteram o cache interno', async () => {
    const { auth } = setup(json({ usuario: { ...user, senha_hash: 'never-expose', sessoes: ['never-expose'] }, token_hash: 'never-expose' }));
    const result = await auth.me();
    assert.deepEqual(result, user);
    result.papel = 'vendedor';
    const state = auth.getState();
    state.usuario.nome = 'Alteração externa';
    assert.deepEqual(auth.getState().usuario, user);
    assert.doesNotMatch(JSON.stringify(auth.getState()), /never-expose|senha_hash|token_hash/);
  });

  it('resposta de perfil antiga não restaura identidade depois de logout', async () => {
    const waiting = deferred();
    const { auth } = setup(json({ usuario: user }), waiting.promise, csrf(), json({ message: 'OK' }));
    await auth.me();
    const stale = auth.me();
    const rejected = assert.rejects(stale, fails('cancelled'));
    await auth.logout();
    waiting.resolve(json({ usuario: user }));
    await rejected;
    assert.equal(auth.getState().status, 'anonymous');
  });

  it('recusa mutações simultâneas de sessão, sem enfileirar ou repetir operações', async () => {
    const waiting = deferred();
    const { auth, calls } = setup(csrf(), waiting.promise);
    const first = auth.login(credentials());
    await assert.rejects(auth.logout(), fails('invalid_request'));
    waiting.resolve(loginResponse());
    await first;
    assert.equal(calls.some(call => call.path === '/api/auth/logout'), false);
    assert.equal(calls.filter(call => call.path === '/api/auth/login').length, 1);
  });

  it('401 atrasado de uma sessão antiga não apaga um login confirmado mais recente', async () => {
    const waiting = deferred();
    const { auth } = setup(waiting.promise, csrf(), loginResponse());
    const old = auth.me();
    const rejected = assert.rejects(old, fails('http', 401));
    await auth.login(credentials());
    waiting.resolve(json({}, 401));
    await rejected;
    assert.deepEqual(auth.getState().usuario, user);
  });

  it('cancelamento mantém o perfil confirmado e não realiza mutações adicionais', async () => {
    const { auth, calls } = setup(json({ usuario: user }));
    await auth.me();
    const controller = new AbortController(); controller.abort();
    await assert.rejects(auth.logout(controller.signal), fails('cancelled'));
    assert.equal(auth.getState().status, 'authenticated');
    assert.equal(calls.length, 1);
  });
});

describe('Serviço administrativo de usuários com contratos reais', () => {
  it('lista usuários paginados e preserva limit/offset do envelope', async () => {
    const { usuarios, calls } = setup(json({ usuarios: [user, seller], limit: 10, offset: 20 }));
    assert.deepEqual(await usuarios.list({ limit: 10, offset: 20 }), { usuarios: [user, seller], limit: 10, offset: 20 });
    assert.equal(calls[0].path, '/api/usuarios');
    assert.equal(calls[0].query.get('limit'), '10');
    assert.equal(calls[0].query.get('offset'), '20');
    assert.equal(calls[0].options.headers['X-CSRF-Token'], undefined);
  });

  it('paginação omitida deixa os padrões para a API e lista vazia é válida', async () => {
    const { usuarios, calls } = setup(json({ usuarios: [], limit: 20, offset: 0 }));
    assert.deepEqual(await usuarios.list(), { usuarios: [], limit: 20, offset: 0 });
    assert.equal(calls[0].query.size, 0);
  });

  it('consulta um UUID sem expor campos privados no usuário retornado', async () => {
    const { usuarios, calls } = setup(json({ usuario: { ...user, senha_hash: 'never-expose' } }));
    assert.deepEqual(await usuarios.get(id), user);
    assert.equal(calls[0].path, `/api/usuarios/${id}`);
  });

  it('cadastro solicita somente nome/email/senha e conserva vendedor com troca obrigatória', async () => {
    const { usuarios, calls } = setup(csrf(), json({ usuario: seller }, 201));
    const result = await usuarios.create({ nome: seller.nome, email: seller.email, senha: password(), papel: 'admin', ativo: false, troca_senha_obrigatoria: false });
    assert.deepEqual(result, seller);
    assert.equal(calls[1].path, '/api/usuarios');
    assert.equal(calls[1].options.method, 'POST');
    assert.deepEqual(Object.keys(body(calls[1])).sort(), ['email', 'nome', 'senha']);
  });

  it('atualiza dados e permissões com a confirmação administrativa prevista', async () => {
    const { usuarios, calls } = setup(csrf(), json({ usuario: { ...seller, papel: 'admin' } }));
    await usuarios.update(seller.id, { nome: 'Novo nome', email: 'novo@example.test', papel: 'admin', senha_admin: password(), ativo: false });
    assert.equal(calls[1].path, `/api/usuarios/${seller.id}`);
    assert.equal(calls[1].options.method, 'PATCH');
    assert.deepEqual(Object.keys(body(calls[1])).sort(), ['email', 'nome', 'papel', 'senha_admin']);
  });

  it('edição comum envia apenas campos presentes, sem inventar senha ou papel', async () => {
    const { usuarios, calls } = setup(csrf(), json({ usuario: user }));
    await usuarios.update(id, { nome: 'Outro nome' });
    assert.deepEqual(body(calls[1]), { nome: 'Outro nome' });
  });

  it('ativação/desativação usa endpoint próprio com senha administrativa', async () => {
    const { usuarios, calls } = setup(csrf(), json({ usuario: { ...seller, ativo: false } }), json({ usuario: seller }));
    const confirmation = password();
    assert.equal((await usuarios.setStatus(seller.id, { ativo: false, senha_admin: confirmation })).ativo, false);
    assert.equal((await usuarios.setStatus(seller.id, { ativo: true, senha_admin: confirmation })).ativo, true);
    assert.equal(calls[1].path, `/api/usuarios/${seller.id}/status`);
    assert.deepEqual(Object.keys(body(calls[1])).sort(), ['ativo', 'senha_admin']);
    assert.equal(calls[2].options.method, 'PATCH');
  });

  it('reset administrativo envia nova senha e confirmação e não guarda a credencial', async () => {
    const { auth, usuarios, calls } = setup(csrf(), json({ message: 'Credencial redefinida.' }));
    const input = { nova_senha: password(), senha_admin: password() };
    assert.deepEqual(await usuarios.resetPassword(seller.id, input), { message: 'Credencial redefinida.' });
    assert.equal(calls[1].path, `/api/usuarios/${seller.id}/reset-password`);
    assert.equal(calls[1].options.method, 'POST');
    assert.deepEqual(Object.keys(body(calls[1])).sort(), ['nova_senha', 'senha_admin']);
    assert.deepEqual(auth.getState(), { status: 'unknown', usuario: null });
  });

  it('revoga sessões pelo endpoint existente, sem adicionar exclusão de conta', async () => {
    const { usuarios, calls } = setup(csrf(), json({ message: 'Sessões revogadas.' }));
    assert.deepEqual(await usuarios.revokeSessions(id, { senha_admin: password() }), { message: 'Sessões revogadas.' });
    assert.equal(calls[1].path, `/api/usuarios/${id}/revoke-sessions`);
    assert.deepEqual(Object.keys(body(calls[1])), ['senha_admin']);
    assert.equal('delete' in usuarios, false);
  });

  it('403 administrativo é preservado; decisão de permissão continua sendo do backend', async () => {
    const { usuarios, calls } = setup(csrf(), json({}, 403));
    await assert.rejects(usuarios.update(seller.id, { papel: 'admin' }), fails('http', 403));
    assert.equal(calls.filter(call => call.options.method === 'PATCH').length, 1);
  });

  it('409 do último administrador não é convertido em sucesso ou repetido', async () => {
    const { usuarios, calls } = setup(csrf(), json({ message: 'never-expose' }, 409));
    await assert.rejects(usuarios.setStatus(id, { ativo: false, senha_admin: password() }), fails('http', 409));
    assert.equal(calls.filter(call => call.options.method === 'PATCH').length, 1);
  });

  it('409 de rebaixamento e e-mail duplicado é propagado sem enfraquecer o contrato', async () => {
    const { usuarios, calls } = setup(csrf(), json({}, 409), json({}, 409));
    await assert.rejects(usuarios.update(id, { papel: 'vendedor', senha_admin: password() }), fails('http', 409));
    await assert.rejects(usuarios.create({ nome: seller.nome, email: user.email, senha: password() }), fails('http', 409));
    assert.equal(calls.length, 3);
  });

  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    it(`HTTP ${status} preserva ApiError no serviço administrativo sem retry`, async () => {
      const { usuarios, calls } = setup(json({ message: 'never-expose' }, status, { 'Retry-After': '900' }));
      await assert.rejects(usuarios.list(), fails('http', status));
      assert.equal(calls.length, 1);
    });
  }

  it('429 de login mantém o estado anterior e informa o limite quando disponível', async () => {
    const { auth, calls } = setup(csrf(), json({}, 429, { 'Retry-After': '900' }));
    await assert.rejects(auth.login(credentials()), error => {
      assert.equal(error.retryAfterSeconds, 900);
      return fails('http', 429)(error);
    });
    assert.equal(auth.getState().status, 'unknown');
    assert.equal(calls.length, 2);
  });

  it('erro de rede durante reset não repete a mutação ou anuncia sucesso', async () => {
    const { usuarios, calls } = setup(csrf(), () => { throw new TypeError('never-expose'); });
    await assert.rejects(usuarios.resetPassword(id, { nova_senha: password(), senha_admin: password() }), fails('network'));
    assert.equal(calls.length, 2);
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
  });

  it('lista e mensagens são projetadas sem hashes, tokens ou campos adicionais', async () => {
    const { usuarios } = setup(json({ usuarios: [{ ...user, senha_hash: 'never-expose' }], limit: 20, offset: 0, token_hash: 'never-expose' }),
      csrf(), json({ message: 'OK', senha_hash: 'never-expose' }));
    assert.deepEqual(await usuarios.list(), { usuarios: [user], limit: 20, offset: 0 });
    assert.deepEqual(await usuarios.revokeSessions(id, { senha_admin: password() }), { message: 'OK' });
  });

  it('recusa resposta fora dos envelopes ou com tipos incompatíveis', async () => {
    for (const payload of [user, { usuario: null }, { usuario: { ...user, papel: ['admin'] } },
      { usuario: { ...user, ativo: 'true' } }, { usuario: { ...user, criado_em: 'ontem' } },
      { usuario: { ...user, troca_senha_obrigatoria: undefined } }]) {
      const { usuarios } = setup(json(payload));
      await assert.rejects(usuarios.get(id), fails('invalid_response'));
    }
    for (const payload of [{ usuarios: user, limit: 20, offset: 0 }, { usuarios: [user], limit: '20', offset: 0 }, { usuarios: [], limit: 20, offset: -1 }]) {
      const { usuarios } = setup(json(payload));
      await assert.rejects(usuarios.list(), fails('invalid_response'));
    }
  });

  it('mensagem de logout inválida não limpa estado nem anuncia confirmação', async () => {
    const { auth } = setup(json({ usuario: user }), csrf(), json({}));
    await auth.me();
    await assert.rejects(auth.logout(), fails('invalid_response'));
    assert.equal(auth.getState().status, 'authenticated');
  });

  it('recusa identificadores inválidos antes de fazer chamadas ou mudar o caminho', async () => {
    const { usuarios, calls } = setup();
    for (const invalid of ['', '..', '../auth/logout', 'never-expose', 'id/../id']) {
      await assert.rejects(usuarios.get(invalid), fails('invalid_request'));
      await assert.rejects(usuarios.revokeSessions(invalid, { senha_admin: password() }), fails('invalid_request'));
    }
    assert.equal(calls.length, 0);
  });

  it('serviços não dependem de localStorage/sessionStorage nem gravam dados neles', async () => {
    const names = ['localStorage', 'sessionStorage'];
    const original = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    let reads = 0;
    try {
      for (const name of names) Object.defineProperty(globalThis, name, {
        configurable: true, get() { reads += 1; throw new Error('Storage não deve ser usado.'); },
      });
      const { auth } = setup(csrf(), loginResponse(), json({ message: 'OK' }));
      await auth.login(credentials());
      await auth.logout();
      assert.equal(reads, 0);
    } finally {
      names.forEach((name, index) => {
        if (original[index]) Object.defineProperty(globalThis, name, original[index]);
        else Reflect.deleteProperty(globalThis, name);
      });
    }
  });
});
