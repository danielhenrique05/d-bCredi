import './environment.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestContext, origin } from './support.js';
import { imoveisRepository } from '../src/modules/imoveis/imoveis.repository.js';
import { ImoveisService } from '../src/modules/imoveis/imoveis.service.js';
import { updateImovelSchema } from '../src/modules/imoveis/imoveis.schema.js';
import { authRepository } from '../src/modules/auth/auth.repository.js';
import { digestToken } from '../src/shared/session.js';

const input = { titulo: 'Casa no Centro', tipo: 'Casa', preco: '350000.90', cidade: 'Concórdia', bairro: 'Centro' };

describe('Imóveis: HTTP, autorização, PostgreSQL e auditoria isolados', { concurrency: false }, () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;
  before(async () => { context = await createTestContext(process.env.DNB_TEST_IMOVEIS_DATABASE ?? ''); });
  beforeEach(async () => { await context.reset(); });
  after(async () => { await context?.close(); });

  async function actor(role: 'admin' | 'vendedor' = 'vendedor', email = `${role}@example.test`) {
    const user = await context.user(role, email);
    const client = context.client();
    assert.equal((await client.login(user.email)).status, 200);
    return { user, client };
  }
  async function seed(owner: string | null = null, patch: Record<string, unknown> = {}) {
    const id = (await context.db.query<{ id: string }>(`INSERT INTO imoveis (titulo,tipo,preco,cidade,bairro,user_id)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [input.titulo, input.tipo, input.preco, input.cidade, input.bairro, owner])).rows[0]!.id;
    if (Object.keys(patch).length) await imoveisRepository.update(context.db, id, updateImovelSchema.parse(patch));
    return (await imoveisRepository.byId(context.db, id))!;
  }
  const countHistory = async () => (await context.db.query<{ n: number }>("SELECT count(*)::int AS n FROM historico WHERE entidade='imovel'")).rows[0]!.n;

  it('listagem pública vazia e preenchida não exige sessão nem expõe proprietário ou credenciais', async () => {
    assert.deepEqual((await context.client().request('/api/imoveis')).body.imoveis, []);
    const user = await context.user(); await seed(user.id);
    const response = await context.client().request('/api/imoveis', { headers: { Origin: '' } });
    assert.equal(response.status, 200); assert.equal(response.body.imoveis!.length, 1);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    for (const field of ['user_id', 'senha_hash', 'usuario_email', 'token_hash', user.email]) assert.equal(response.text.includes(field), false);
    assert.equal(response.body.limit, 20); assert.equal(response.body.offset, 0);
  });

  it('detalhe público, UUID inválido e imóvel ausente retornam 200, 400 e 404', async () => {
    const row = await seed();
    const found = await context.client().request(`/api/imoveis/${row.id}`);
    assert.equal(found.status, 200); assert.equal(found.body.imovel!.titulo, input.titulo);
    assert.equal(Object.hasOwn(found.body.imovel!, 'user_id'), false);
    assert.equal((await context.client().request('/api/imoveis/invalido')).status, 400);
    assert.equal((await context.client().request(`/api/imoveis/${randomUUID()}`)).status, 404);
  });

  it('ordenação coloca destaque primeiro e usa data e UUID como desempate estável na paginação', async () => {
    const first = await seed(), second = await seed(), highlighted = await seed(null, { destaque: true });
    await context.db.query("UPDATE imoveis SET criado_em='2026-01-01T00:00:00Z'");
    const expected = [highlighted.id, ...[first.id, second.id].sort().reverse()];
    const all = await context.client().request('/api/imoveis');
    assert.deepEqual(all.body.imoveis!.map(row => row.id), expected);
    for (let offset = 0; offset < 3; offset++) {
      const page = await context.client().request(`/api/imoveis?limit=1&offset=${offset}`);
      assert.deepEqual(page.body.imoveis!.map(row => row.id), [expected[offset]]);
      assert.equal(page.body.limit, 1); assert.equal(page.body.offset, offset);
    }
  });

  it('filtros de tipo, cidade, bairro, preço, quartos e destaque combinam valores parametrizados', async () => {
    const match = await seed(null, { tipo: 'Apartamento', preco: '200000.01', bairro: 'Imperial', quartos: 2, destaque: true });
    await seed(null, { tipo: 'Apartamento', preco: '200000.02', bairro: 'Imperial', quartos: 3 });
    await seed(null, { tipo: 'Terreno', cidade: 'Outra Cidade', destaque: null });
    const query = new URLSearchParams({ tipo: 'Apartamento', cidade: 'concórdia', bairro: 'IMPERIAL', preco_min: '200000', preco_max: '200000.01', quartos: '2', destaque: 'true' });
    const result = await context.client().request(`/api/imoveis?${query}`);
    assert.equal(result.status, 200); assert.deepEqual(result.body.imoveis!.map(row => row.id), [match.id]);
    assert.equal((await context.client().request('/api/imoveis?destaque=false')).body.imoveis!.length, 2);
    for (const cidade of ["' OR true --", '%', '_']) {
      const safe = await context.client().request(`/api/imoveis?${new URLSearchParams({ cidade })}`);
      assert.equal(safe.status, 200); assert.equal(safe.body.imoveis!.length, 0);
    }
  });

  it('recusa limites, filtros malformados, faixas invertidas e ordenação arbitrária', async () => {
    for (const query of ['limit=0', 'limit=101', 'offset=-1', 'offset=1.5', 'limit=1&limit=2', 'tipo=Outro',
      'preco_min=-1', 'preco_min=1.001', 'preco_min=20&preco_max=10', 'quartos=2.5', 'quartos=2147483648',
      'destaque=1', 'destaque=FALSE', 'cidade=', 'order=preco;DROP TABLE imoveis']) {
      assert.equal((await context.client().request(`/api/imoveis?${query}`)).status, 400, query);
    }
  });

  for (const role of ['admin', 'vendedor'] as const) it(`${role} cadastra com UUID gerado no banco e propriedade exclusiva da sessão`, async () => {
    const { user, client } = await actor(role);
    const response = await client.request('/api/imoveis', { method: 'POST', body: input });
    assert.equal(response.status, 201); assert.ok(response.body.imovel!.id);
    const stored = (await imoveisRepository.byId(context.db, response.body.imovel!.id))!;
    assert.equal(stored.user_id, user.id); assert.equal(stored.preco, input.preco);
    assert.equal(stored.destaque, false); assert.equal(stored.quartos, null);
    assert.equal(await countHistory(), 1);
  });

  it('cadastro sem sessão ou após desativação é recusado sem persistência', async () => {
    assert.equal((await context.client().request('/api/imoveis', { method: 'POST', body: input })).status, 401);
    const own = await actor();
    await context.db.query('UPDATE usuarios SET ativo=false WHERE id=$1', [own.user.id]);
    assert.equal((await own.client.request('/api/imoveis', { method: 'POST', body: input })).status, 401);
    assert.equal((await context.db.query('SELECT * FROM imoveis')).rows.length, 0);
    assert.equal(await countHistory(), 0);
  });

  it('troca obrigatória bloqueia gestão e escrita mesmo com sessão previamente criada', async () => {
    const own = await actor('admin');
    await context.db.query('UPDATE usuarios SET troca_senha_obrigatoria=true WHERE id=$1', [own.user.id]);
    assert.equal((await own.client.request('/api/imoveis/gestao')).status, 403);
    assert.equal((await own.client.request('/api/imoveis', { method: 'POST', body: input })).status, 403);
    assert.equal((await own.client.request('/api/imoveis')).status, 200);
  });

  it('valida campos obrigatórios, números, limites de texto e tipo sem inserir registros', async () => {
    const { client } = await actor();
    const invalid = [
      { titulo: '' }, { titulo: 'a'.repeat(201) }, { titulo: 'Controle\0' }, { tipo: 'Mansão' },
      { cidade: null }, { bairro: ' ' }, { preco: -1 }, { preco: null }, { preco: 'NaN' },
      { preco: '1e3' }, { preco: '0.001' }, { preco: '1000000000000000' }, { preco: 10.99 },
      { preco: 9007199254740992 }, { quartos: -1 }, { quartos: 1.5 }, { quartos: '2' },
      { banheiros: 2147483648 }, { vagas: true }, { area: '0' }, { area: '-1' }, { descricao: 'a'.repeat(10001) },
      { destaque: 'true' }, { campo_desconhecido: true },
    ];
    for (const patch of invalid) assert.equal((await client.request('/api/imoveis', { method: 'POST', body: { ...input, ...patch } })).status, 400);
    assert.equal((await client.request('/api/imoveis', { method: 'POST', body: {} })).status, 400);
    assert.equal((await context.db.query('SELECT * FROM imoveis')).rows.length, 0);
    assert.equal(await countHistory(), 0);
  });

  it('recusa id, user_id, criado_em e papel enviados pelo cliente inclusive para admin', async () => {
    const { client } = await actor('admin'); const row = await seed();
    for (const field of ['id', 'user_id', 'criado_em', 'papel']) {
      const extra = { [field]: randomUUID() };
      assert.equal((await client.request('/api/imoveis', { method: 'POST', body: { ...input, ...extra } })).status, 400);
      assert.equal((await client.request(`/api/imoveis/${row.id}`, { method: 'PATCH', body: extra })).status, 400);
    }
    assert.equal((await imoveisRepository.byId(context.db, row.id))!.user_id, null);
  });

  it('preserva NUMERIC exato, aceita inteiro seguro e não arredonda frações ou valores antigos', async () => {
    const { client } = await actor();
    const response = await client.request('/api/imoveis', { method: 'POST', body: { ...input, preco: '999999999999999.99', area: '123456789012345.67' } });
    assert.equal(response.status, 201); assert.equal(response.body.imovel!.preco, '999999999999999.99');
    assert.equal(response.body.imovel!.area, '123456789012345.67');
    const integer = await client.request('/api/imoveis', { method: 'POST', body: { ...input, preco: 500, area: 100 } });
    assert.equal(integer.status, 201); assert.equal(integer.body.imovel!.preco, '500.00');
    await context.db.query('UPDATE imoveis SET preco=$2,area=$3 WHERE id=$1', [response.body.imovel!.id, '123.1234567890123456789', '1.123456789']);
    const old = await client.request(`/api/imoveis/${response.body.imovel!.id}`, { method: 'PATCH', body: { titulo: 'Título Atualizado' } });
    assert.equal(old.body.imovel!.preco, '123.1234567890123456789'); assert.equal(old.body.imovel!.area, '1.123456789');
  });

  it('campos opcionais e nulos, capa independente e galeria TEXT[] são preservados', async () => {
    const { client } = await actor();
    const gallery = ['https://images.example.test/1.jpg', 'http://images.example.test/2.jpg'];
    const response = await client.request('/api/imoveis', { method: 'POST', body: {
      ...input, area: null, quartos: null, banheiros: 0, vagas: 1, descricao: 'Texto\ncom linhas.',
      imagem_url: gallery[1], imagens: gallery, destaque: null,
    } });
    assert.equal(response.status, 201); assert.deepEqual(response.body.imovel!.imagens, gallery);
    assert.equal(response.body.imovel!.imagem_url, gallery[1]); assert.equal(response.body.imovel!.area, null);
    const cleared = await client.request(`/api/imoveis/${response.body.imovel!.id}`, { method: 'PATCH', body: { imagens: [], imagem_url: null, descricao: '', area: null } });
    assert.equal(cleared.status, 200); assert.deepEqual(cleared.body.imovel!.imagens, []);
    assert.equal(cleared.body.imovel!.imagem_url, null); assert.equal(cleared.body.imovel!.descricao, '');
  });

  it('URLs de imagens limitam protocolos, credenciais, tamanho e quantidade', async () => {
    const { client } = await actor();
    for (const patch of [
      { imagem_url: 'javascript:alert(1)' }, { imagem_url: 'data:image/png;base64,abc' },
      { imagem_url: 'ftp://example.test/1.jpg' }, { imagem_url: 'https://user:pass@example.test/a.jpg' },
      { imagem_url: `https://example.test/${'a'.repeat(2048)}` }, { imagens: ['invalida'] },
      { imagens: Array(21).fill('https://example.test/image.jpg') }, { imagens: '["https://example.test/a.jpg"]' },
    ]) assert.equal((await client.request('/api/imoveis', { method: 'POST', body: { ...input, ...patch } })).status, 400);
    assert.equal(await countHistory(), 0);
  });

  it('vendedor atualiza parcialmente apenas seu imóvel sem sobrescrever campos omitidos', async () => {
    const own = await actor(); const row = await seed(own.user.id);
    const response = await own.client.request(`/api/imoveis/${row.id}`, { method: 'PATCH', body: { titulo: 'Novo Título', destaque: true } });
    assert.equal(response.status, 200); assert.equal(response.body.imovel!.titulo, 'Novo Título');
    assert.equal(response.body.imovel!.preco, row.preco); assert.equal(response.body.imovel!.destaque, true);
    const stored = (await imoveisRepository.byId(context.db, row.id))!;
    assert.equal(stored.user_id, own.user.id); assert.equal(new Date(stored.criado_em).getTime(), new Date(row.criado_em).getTime());
  });

  it('tentativa sobre imóvel alheio usa o mesmo 404 de recurso inexistente', async () => {
    const own = await actor(); const other = await context.user('vendedor', 'outro@example.test');
    const row = await seed(other.id);
    for (const method of ['PATCH', 'DELETE']) {
      const body = method === 'PATCH' ? { titulo: 'Proibido' } : {};
      const denied = await own.client.request(`/api/imoveis/${row.id}`, { method, body });
      const missing = await own.client.request(`/api/imoveis/${randomUUID()}`, { method, body });
      assert.equal(denied.status, 404); assert.deepEqual(denied.body, missing.body);
    }
    assert.equal(await countHistory(), 0); assert.equal((await imoveisRepository.byId(context.db, row.id))!.titulo, row.titulo);
  });

  it('admin edita e exclui imóvel alheio; órfãos permanecem sem dono e exclusivos da gestão admin', async () => {
    const admin = await actor('admin'), seller = await actor();
    const row = await seed(seller.user.id), orphan = await seed();
    for (const target of [row, orphan]) {
      assert.equal((await admin.client.request(`/api/imoveis/${target.id}`, { method: 'PATCH', body: { titulo: 'Editado pelo Admin' } })).status, 200);
      assert.equal((await imoveisRepository.byId(context.db, target.id))!.user_id, target.user_id);
    }
    for (const method of ['PATCH', 'DELETE']) assert.equal((await seller.client.request(`/api/imoveis/${orphan.id}`, { method, body: method === 'PATCH' ? { titulo: 'Proibido' } : {} })).status, 404);
    assert.equal((await admin.client.request(`/api/imoveis/${orphan.id}`, { method: 'DELETE', body: {} })).status, 204);
    assert.equal((await admin.client.request(`/api/imoveis/${row.id}`, { method: 'DELETE', body: {} })).status, 204);
  });

  it('vendedor exclui imóvel próprio e recebe 204 sem corpo; exclusão não altera sua conta', async () => {
    const own = await actor(); const row = await seed(own.user.id);
    const deleted = await own.client.request(`/api/imoveis/${row.id}`, { method: 'DELETE', body: {} });
    assert.equal(deleted.status, 204); assert.equal(deleted.text, '');
    assert.equal((await context.client().request(`/api/imoveis/${row.id}`)).status, 404);
    assert.equal((await own.client.request('/api/auth/me')).status, 200);
  });

  it('PATCH sem mudança real não escreve nem gera histórico, e corpo vazio é inválido', async () => {
    const own = await actor(); const row = await seed(own.user.id);
    assert.equal((await own.client.request(`/api/imoveis/${row.id}`, { method: 'PATCH', body: { preco: '350000.9', titulo: row.titulo, quartos: null } })).status, 200);
    assert.equal(await countHistory(), 0);
    assert.equal((await own.client.request(`/api/imoveis/${row.id}`, { method: 'PATCH', body: {} })).status, 400);
  });

  it('gestão exige sessão e retorna todos para admin, somente próprios para vendedor', async () => {
    const admin = await actor('admin'), own = await actor();
    const first = await seed(own.user.id); await seed(admin.user.id); await seed();
    assert.equal((await context.client().request('/api/imoveis/gestao')).status, 401);
    const seller = await own.client.request('/api/imoveis/gestao');
    assert.deepEqual(seller.body.imoveis!.map(row => row.id), [first.id]);
    assert.equal(seller.body.imoveis![0]!.user_id, own.user.id);
    assert.equal((await admin.client.request('/api/imoveis/gestao?limit=1&offset=1')).body.imoveis!.length, 1);
    assert.equal((await admin.client.request('/api/imoveis/gestao')).body.imoveis!.length, 3);
  });

  it('sessões expiradas e revogadas impedem todas as escritas e a consulta de gestão', async () => {
    const own = await actor(); const row = await seed(own.user.id);
    await context.db.query("UPDATE sessoes SET criado_em=now()-interval '1 day',expira_em=now()-interval '1 second'");
    for (const [method, path, body] of [
      ['POST', '/api/imoveis', input], ['PATCH', `/api/imoveis/${row.id}`, { titulo: 'Proibido' }],
      ['DELETE', `/api/imoveis/${row.id}`, {}], ['GET', '/api/imoveis/gestao', undefined],
    ] as const) assert.equal((await own.client.request(path, { method, body })).status, 401);
    await own.client.login(own.user.email);
    await context.db.query('UPDATE sessoes SET revogada_em=now()');
    assert.equal((await own.client.request(`/api/imoveis/${row.id}`, { method: 'DELETE', body: {} })).status, 401);
    assert.equal(await countHistory(), 0);
  });

  it('CSRF e Origin protegem POST, PATCH e DELETE; preflight permite DELETE com credenciais', async () => {
    const own = await actor(); const row = await seed(own.user.id);
    for (const [method, path, body] of [
      ['POST', '/api/imoveis', input], ['PATCH', `/api/imoveis/${row.id}`, { titulo: 'Proibido' }], ['DELETE', `/api/imoveis/${row.id}`, {}],
    ] as const) {
      assert.equal((await own.client.request(path, { method, body, csrf: false })).status, 403);
      assert.equal((await own.client.request(path, { method, body, headers: { Origin: 'https://hostil.example' } })).status, 403);
      assert.equal((await own.client.request(path, { method, body, headers: { Origin: '' } })).status, 403);
    }
    const options = await own.client.request('/api/imoveis', { method: 'OPTIONS' });
    assert.equal(options.status, 204); assert.match(options.headers.get('access-control-allow-methods')!, /DELETE/);
    assert.equal(options.headers.get('access-control-allow-origin'), origin);
    assert.equal(options.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(await countHistory(), 0);
  });

  it('CREATE/UPDATE/DELETE registram autor, entidade e UUID, sem copiar descrições ou URLs', async () => {
    const own = await actor();
    const privateText = 'Texto livre que não deve ir ao histórico';
    const photo = 'https://example.test/foto.jpg?assinatura=marcador';
    const created = await own.client.request('/api/imoveis', { method: 'POST', body: { ...input, descricao: privateText, imagem_url: photo } });
    const id = created.body.imovel!.id;
    await own.client.request(`/api/imoveis/${id}`, { method: 'PATCH', body: { titulo: 'Título Auditável' } });
    await own.client.request(`/api/imoveis/${id}`, { method: 'DELETE', body: {} });
    const history = (await context.db.query('SELECT * FROM historico ORDER BY id')).rows;
    assert.deepEqual(history.map(row => row.acao), ['CREATE', 'UPDATE', 'DELETE']);
    assert.ok(history.every(row => row.entidade === 'imovel' && row.entidade_id === id && row.user_id === own.user.id && row.usuario_email === own.user.email));
    assert.match(history[2]!.descricao as string, /Título Auditável/);
    for (const value of [privateText, photo, own.client.cookies.get('dnb_session')!]) assert.equal(JSON.stringify(history).includes(value), false);
  });

  it('falha no histórico reverte criação, edição e exclusão sem expor detalhes SQL', async () => {
    const own = await actor(); const row = await seed(own.user.id);
    await context.db.query("CREATE FUNCTION imoveis_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'interno_imoveis'; END $$");
    await context.db.query("CREATE TRIGGER imoveis_fail_audit BEFORE INSERT ON historico FOR EACH ROW WHEN (NEW.entidade='imovel') EXECUTE FUNCTION imoveis_fail_audit()");
    try {
      for (const [method, path, body] of [
        ['POST', '/api/imoveis', input], ['PATCH', `/api/imoveis/${row.id}`, { preco: '1.99' }], ['DELETE', `/api/imoveis/${row.id}`, {}],
      ] as const) {
        const response = await own.client.request(path, { method, body });
        assert.equal(response.status, 500); assert.equal(response.text.includes('interno_imoveis'), false);
        assert.equal((await imoveisRepository.byId(context.db, row.id))!.preco, input.preco);
        assert.equal((await context.db.query('SELECT * FROM imoveis')).rows.length, 1);
      }
      assert.equal(await countHistory(), 0);
    } finally {
      await context.db.query('DROP TRIGGER imoveis_fail_audit ON historico'); await context.db.query('DROP FUNCTION imoveis_fail_audit()');
    }
  });

  it('FK preserva proprietário e conflito com dependente impede exclusão sem perder auditoria', async () => {
    const admin = await actor('admin'); const owner = await context.user(); const row = await seed(owner.id);
    await assert.rejects(() => context.db.query('DELETE FROM usuarios WHERE id=$1', [owner.id]), error => {
      assert.ok(typeof error === 'object' && error !== null && 'code' in error && ['23503', '23001'].includes(String(error.code)));
      return true;
    });
    await context.db.query('CREATE TABLE imoveis_dependencia_teste (imovel_id uuid REFERENCES imoveis(id) ON DELETE RESTRICT)');
    await context.db.query('INSERT INTO imoveis_dependencia_teste VALUES ($1)', [row.id]);
    try {
      const response = await admin.client.request(`/api/imoveis/${row.id}`, { method: 'DELETE', body: {} });
      assert.equal(response.status, 409); assert.equal(response.text.includes('imoveis_dependencia_teste'), false);
      assert.ok(await imoveisRepository.byId(context.db, row.id)); assert.equal(await countHistory(), 0);
    } finally { await context.db.query('DROP TABLE imoveis_dependencia_teste'); }
  });

  it('revalida sessão, papel e proprietário dentro da transação, sem confiar no contexto antigo', async () => {
    const admin = await actor('admin'), own = await actor(); const row = await seed(own.user.id);
    const stale = (await authRepository.session(context.db, digestToken(admin.client.cookies.get('dnb_session')!)))!;
    const service = new ImoveisService(context.db);
    await context.db.query("UPDATE usuarios SET papel='vendedor' WHERE id=$1", [admin.user.id]);
    await assert.rejects(() => service.update(stale, row.id, { titulo: 'Proibido' }), { status: 404 });
    await authRepository.revoke(context.db, stale.sessionId);
    await assert.rejects(() => service.delete(stale, row.id), { status: 401 });
    const ownerContext = (await authRepository.session(context.db, digestToken(own.client.cookies.get('dnb_session')!)))!;
    await context.db.query('UPDATE imoveis SET user_id=$2 WHERE id=$1', [row.id, admin.user.id]);
    await assert.rejects(() => service.delete(ownerContext, row.id), { status: 404 });
    assert.equal(await countHistory(), 0);
  });

  it('PATCHes concorrentes preservam campos distintos e registram as duas operações', async () => {
    const own = await actor(); const row = await seed(own.user.id);
    const responses = await Promise.all([
      own.client.request(`/api/imoveis/${row.id}`, { method: 'PATCH', body: { titulo: 'Título Concorrente' } }),
      own.client.request(`/api/imoveis/${row.id}`, { method: 'PATCH', body: { preco: '123456.78' } }),
    ]);
    assert.deepEqual(responses.map(response => response.status), [200, 200]);
    const stored = (await imoveisRepository.byId(context.db, row.id))!;
    assert.equal(stored.titulo, 'Título Concorrente'); assert.equal(stored.preco, '123456.78'); assert.equal(await countHistory(), 2);
  });

  it('disputa entre edição e exclusão não ressuscita imóvel nem duplica auditoria DELETE', async () => {
    const own = await actor(); const row = await seed(own.user.id);
    const [patch, deleted] = await Promise.all([
      own.client.request(`/api/imoveis/${row.id}`, { method: 'PATCH', body: { titulo: 'Concorrente' } }),
      own.client.request(`/api/imoveis/${row.id}`, { method: 'DELETE', body: {} }),
    ]);
    assert.ok([200, 404].includes(patch.status)); assert.equal(deleted.status, 204);
    assert.equal(await imoveisRepository.byId(context.db, row.id), undefined);
    assert.equal((await context.db.query("SELECT * FROM historico WHERE entidade='imovel' AND acao='DELETE'")).rows.length, 1);
  });

  it('migration de índices reaplicada preserva PK, FK e índices de catálogo/proprietário', async () => {
    const indexes = (await context.db.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='imoveis'")).rows.map(row => row.indexname);
    for (const name of ['imoveis_pkey', 'imoveis_catalogo_idx', 'imoveis_proprietario_catalogo_idx']) assert.ok(indexes.includes(name));
    const fks = (await context.db.query<{ definition: string }>("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='imoveis'::regclass AND contype='f'")).rows;
    assert.match(fks[0]!.definition, /REFERENCES usuarios\(id\) ON DELETE RESTRICT/);
  });
});
