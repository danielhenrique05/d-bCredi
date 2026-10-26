import './environment.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestContext, origin, testPassword } from './support.js';
import { audit } from '../src/shared/audit.js';
import { authRepository } from '../src/modules/auth/auth.repository.js';
import { digestToken } from '../src/shared/session.js';
import { HistoricoService } from '../src/modules/historico/historico.service.js';
import { listHistoricoSchema } from '../src/modules/historico/historico.schema.js';

describe('Histórico: consulta administrativa, filtros e preservação de auditoria', { concurrency: false }, () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;
  before(async () => { context = await createTestContext(process.env.DNB_TEST_HISTORICO_DATABASE ?? ''); });
  beforeEach(async () => { await context.reset(); });
  after(async () => { await context?.close(); });

  async function actor(papel: 'admin' | 'vendedor' = 'admin') {
    const user = await context.user(papel);
    const client = context.client();
    assert.equal((await client.login(user.email)).status, 200);
    return { user, client };
  }

  async function seed(options: {
    acao?: 'CREATE' | 'UPDATE' | 'DELETE'; entidade?: string; userId?: string | null;
    entityId?: string; date?: string; descricao?: string;
  } = {}) {
    const { rows } = await context.db.query<{ id: string }>(`INSERT INTO historico
      (user_id,usuario_nome,usuario_email,acao,entidade,entidade_id,descricao,criado_em)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,
    [options.userId ?? null, 'Responsável Preservado', 'autor@example.test', options.acao ?? 'CREATE',
      options.entidade ?? 'imovel', options.entityId ?? randomUUID(), options.descricao ?? 'Descrição histórica preservada.',
      options.date ?? '2026-10-26T12:00:00Z']);
    return rows[0]!.id;
  }
  const path = (query: Record<string, string>) => `/api/historico?${new URLSearchParams(query)}`;
  const snapshot = async () => JSON.stringify((await context.db.query('SELECT * FROM historico ORDER BY id')).rows);

  it('sem sessão recebe 401 na lista e no detalhe sem informação pessoal', async () => {
    const id = await seed();
    for (const url of ['/api/historico', `/api/historico/${id}`]) {
      const response = await context.client().request(url);
      assert.equal(response.status, 401); assert.equal(response.text.includes('autor@example.test'), false);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  });

  it('vendedor recebe 403 mesmo enviando papel ou permissões de administrador', async () => {
    const { client } = await actor('vendedor'); const id = await seed();
    for (const url of ['/api/historico', '/api/historico?papel=admin&admin=true', `/api/historico/${id}`]) {
      const response = await client.request(url);
      assert.equal(response.status, 403); assert.equal(response.text.includes('autor@example.test'), false);
    }
  });

  it('admin autorizado recebe lista vazia com paginação compatível com o painel', async () => {
    const { client } = await actor();
    const response = await client.request('/api/historico');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { registros: [], limit: 50, offset: 0, temMais: false });
  });

  it('retorna os dez campos persistidos e detalhes pontuais, sem credenciais ou novos cookies', async () => {
    const { client } = await actor(); const id = await seed();
    const expected = ['id', 'user_id', 'usuario_nome', 'usuario_email', 'acao', 'entidade', 'entidade_id', 'descricao', 'criado_em'].sort();
    for (const url of ['/api/historico', `/api/historico/${id}`]) {
      const response = await client.request(url, { csrf: false });
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.getSetCookie().length, 0);
      const row = response.body.registro ?? response.body.registros![0]!;
      assert.deepEqual(Object.keys(row).sort(), expected);
      assert.equal(row.id, id); assert.equal(row.usuario_email, 'autor@example.test');
      assert.equal(row.criado_em, '2026-10-26T12:00:00.000Z');
      for (const secret of ['senha_hash', 'token_hash', testPassword, client.cookies.get('dnb_session')!]) assert.equal(response.text.includes(secret), false);
      assert.equal(Object.hasOwn(row, 'antes'), false); assert.equal(Object.hasOwn(row, 'depois'), false);
    }
  });

  it('ordena por data e ID numérico decrescentes, sem ordenar BIGINT como texto', async () => {
    const { client } = await actor(); const ids: string[] = [];
    for (let i = 0; i < 12; i++) ids.push(await seed());
    const older = await seed({ date: '2026-10-25T23:59:59Z' });
    const response = await client.request('/api/historico');
    assert.deepEqual(response.body.registros!.map(row => row.id), [...ids.reverse(), older]);
  });

  it('pagina com uma linha extra para temMais, inclusive página final e offset além do fim', async () => {
    const { client } = await actor();
    await seed(); const second = await seed(); const third = await seed();
    const firstPage = await client.request('/api/historico?limit=1');
    assert.deepEqual(firstPage.body.registros!.map(row => row.id), [third]); assert.equal(firstPage.body.temMais, true);
    const lastPage = await client.request('/api/historico?limit=2&offset=1');
    assert.equal(lastPage.body.registros!.length, 2); assert.equal(lastPage.body.registros![0]!.id, second);
    assert.equal(lastPage.body.temMais, false); assert.equal(lastPage.body.limit, 2); assert.equal(lastPage.body.offset, 1);
    assert.deepEqual((await client.request('/api/historico?offset=100')).body, { registros: [], limit: 50, offset: 100, temMais: false });
  });

  it('aplica limite padrão 50 e máximo 100 sem executar contagem total', async () => {
    const { client } = await actor();
    await context.db.query(`INSERT INTO historico (acao,entidade,entidade_id,descricao)
      SELECT 'UPDATE','usuario',i::text,'Fixture isolada' FROM generate_series(1,101) i`);
    const standard = await client.request('/api/historico');
    assert.equal(standard.body.registros!.length, 50); assert.equal(standard.body.temMais, true);
    const max = await client.request('/api/historico?limit=100');
    assert.equal(max.body.registros!.length, 100); assert.equal(max.body.temMais, true);
    assert.equal(Object.hasOwn(max.body, 'total'), false);
  });

  it('filtra as três ações permitidas', async () => {
    const { client } = await actor();
    for (const acao of ['CREATE', 'UPDATE', 'DELETE'] as const) await seed({ acao });
    for (const acao of ['CREATE', 'UPDATE', 'DELETE']) {
      const result = await client.request(path({ acao }));
      assert.equal(result.status, 200); assert.deepEqual(result.body.registros!.map(row => row.acao), [acao]);
    }
  });

  it('filtra entidades reais usuario e imovel, preservando tipos legados na listagem completa', async () => {
    const { client } = await actor();
    await seed({ entidade: 'usuario' }); await seed({ entidade: 'imovel' }); await seed({ entidade: 'legado' });
    for (const entidade of ['usuario', 'imovel']) {
      const result = await client.request(path({ entidade }));
      assert.deepEqual(result.body.registros!.map(row => row.entidade), [entidade]);
    }
    assert.equal((await client.request('/api/historico')).body.registros!.length, 3);
  });

  it('filtra usuario_id UUID mesmo que o responsável não exista mais em usuarios', async () => {
    const { client } = await actor(); const absentUser = randomUUID();
    const id = await seed({ userId: absentUser }); await seed();
    const response = await client.request(path({ usuario_id: absentUser }));
    assert.deepEqual(response.body.registros!.map(row => row.id), [id]);
    assert.equal(response.body.registros![0]!.user_id, absentUser);
  });

  it('entidade_id é texto exato, não exige UUID nem interpreta curingas SQL', async () => {
    const { client } = await actor();
    for (const entityId of ['legado:imovel/42', '%', '_', ' id com espaços ']) {
      const id = await seed({ entityId });
      assert.deepEqual((await client.request(path({ entidade_id: entityId }))).body.registros!.map(row => row.id), [id]);
    }
  });

  it('período usa início inclusivo, fim exclusivo e normaliza fuso explícito', async () => {
    const { client } = await actor();
    await seed({ date: '2026-10-26T02:59:59.999Z' });
    const start = await seed({ date: '2026-10-26T03:00:00Z' });
    const middle = await seed({ date: '2026-10-27T02:59:59.999Z' });
    await seed({ date: '2026-10-27T03:00:00Z' });
    const local = await client.request(path({ data_inicio: '2026-10-26T00:00:00-03:00', data_fim: '2026-10-27T00:00:00-03:00' }));
    assert.deepEqual(local.body.registros!.map(row => row.id), [middle, start]);
    const positive = await client.request(path({ data_inicio: '2026-10-26T05:00:00+02:00', data_fim: '2026-10-27T05:00:00+02:00' }));
    assert.deepEqual(positive.body, local.body);
  });

  it('aceita períodos abertos, segundos sem fração e intervalo vazio com limites iguais', async () => {
    const { client } = await actor();
    const old = await seed({ date: '2026-10-25T23:59:59Z' }); const latest = await seed({ date: '2026-10-26T00:00:00Z' });
    assert.deepEqual((await client.request(path({ data_inicio: '2026-10-26T00:00:00Z' }))).body.registros!.map(row => row.id), [latest]);
    assert.deepEqual((await client.request(path({ data_fim: '2026-10-26T00:00:00Z' }))).body.registros!.map(row => row.id), [old]);
    const empty = await client.request(path({ data_inicio: '2026-10-26T00:00:00Z', data_fim: '2026-10-26T00:00:00Z' }));
    assert.equal(empty.status, 200); assert.deepEqual(empty.body.registros, []);
  });

  it('combina todos os filtros antes de aplicar paginação e calcular temMais', async () => {
    const { client } = await actor(); const user = randomUUID(), entity = randomUUID();
    const options = { acao: 'UPDATE' as const, entidade: 'usuario', userId: user, entityId: entity };
    const first = await seed(options), second = await seed(options);
    await seed({ ...options, acao: 'CREATE' }); await seed({ ...options, userId: randomUUID() });
    await seed({ ...options, date: '2026-10-25T12:00:00Z' });
    const query = { limit: '1', acao: 'UPDATE', entidade: 'usuario', usuario_id: user, entidade_id: entity,
      data_inicio: '2026-10-26T00:00:00Z', data_fim: '2026-10-27T00:00:00Z' };
    const page = await client.request(path(query));
    assert.deepEqual(page.body.registros!.map(row => row.id), [second]); assert.equal(page.body.temMais, true);
    const last = await client.request(path({ ...query, offset: '1' }));
    assert.deepEqual(last.body.registros!.map(row => row.id), [first]); assert.equal(last.body.temMais, false);
  });

  it('recusa paginação, UUIDs, campos desconhecidos e valores de filtro inválidos', async () => {
    const { client } = await actor();
    for (const query of ['limit=0', 'limit=101', 'limit=', 'limit=1.5', 'limit=1e2', 'limit=1&limit=2',
      'offset=-1', 'offset=', 'offset=1000001', 'offset=2.5', 'acao=create', 'acao=READ', 'entidade=usuarios',
      'usuario_id=42', 'user_id=' + randomUUID(), 'entidade_id=', 'entidade_id=%20%20',
      'entidade_id=' + 'a'.repeat(257), 'entidade_id=%00', 'order=id', 'papel=admin']) {
      const result = await client.request(`/api/historico?${query}`);
      assert.equal(result.status, 400, query); assert.deepEqual(result.body, { status: 'error', message: 'Dados inválidos.' });
    }
  });

  it('recusa datas inexistentes, sem fuso, precisão além de milissegundos e período invertido', async () => {
    const { client } = await actor();
    for (const value of ['2026-10-26', '2026-10-26T00:00:00', '2026-02-30T12:00:00Z', '2026-13-01T00:00:00Z',
      '2026-10-26T24:00:00Z', '2026-10-26T00:00:00+99:00', '2026-10-26T00:00:00.0001Z', 'invalida']) {
      assert.equal((await client.request(path({ data_inicio: value }))).status, 400, value);
    }
    assert.equal((await client.request(path({ data_inicio: '2026-10-27T00:00:00Z', data_fim: '2026-10-26T00:00:00Z' }))).status, 400);
  });

  it('SQL injection é rejeitado em campos estruturados e tratado literalmente no identificador textual', async () => {
    const { client } = await actor(); const malicious = "x' OR 1=1; DROP TABLE historico; --";
    const id = await seed({ entityId: malicious }); await seed();
    for (const field of ['acao', 'entidade', 'usuario_id', 'data_inicio', 'limit']) {
      assert.equal((await client.request(path({ [field]: malicious }))).status, 400);
    }
    const literal = await client.request(path({ entidade_id: malicious }));
    assert.equal(literal.status, 200); assert.deepEqual(literal.body.registros!.map(row => row.id), [id]);
    assert.equal((await context.db.query('SELECT count(*)::int AS n FROM historico')).rows[0]!.n, 2);
  });

  it('IDs BIGINT acima do limite de number mantêm precisão na lista e no detalhe', async () => {
    const { client } = await actor();
    for (const id of ['9007199254740993', '9223372036854775807']) {
      await context.db.query(`INSERT INTO historico (id,acao,entidade,entidade_id,descricao)
        OVERRIDING SYSTEM VALUE VALUES ($1,'UPDATE','usuario','id-legado','Identificador preservado')`, [id]);
      const found = await client.request(`/api/historico/${id}`);
      assert.equal(found.status, 200); assert.equal(found.body.registro!.id, id);
    }
    assert.deepEqual((await client.request('/api/historico')).body.registros!.map(row => row.id), ['9223372036854775807', '9007199254740993']);
  });

  it('detalhe valida BIGINT positivo, recusa parâmetros desconhecidos e retorna 404 quando ausente', async () => {
    const { client } = await actor(); await seed();
    for (const id of ['0', '-1', '01', '1.5', '+1', '9223372036854775808', '1'.repeat(20), randomUUID(), '1%20OR%201=1']) {
      assert.equal((await client.request(`/api/historico/${id}`)).status, 400, id);
    }
    assert.equal((await client.request('/api/historico/1?papel=admin')).status, 400);
    assert.equal((await client.request('/api/historico/999')).status, 404);
  });

  for (const state of ['revogada', 'expirada', 'inativa', 'troca pendente']) it(`recusa conta/sessão ${state} em ambas as consultas`, async () => {
    const { user, client } = await actor(); const id = await seed();
    if (state === 'revogada') await context.db.query('UPDATE sessoes SET revogada_em=now()');
    if (state === 'expirada') await context.db.query("UPDATE sessoes SET criado_em=now()-interval '1 day',expira_em=now()-interval '1 second'");
    if (state === 'inativa') await context.db.query('UPDATE usuarios SET ativo=false WHERE id=$1', [user.id]);
    if (state === 'troca pendente') await context.db.query('UPDATE usuarios SET troca_senha_obrigatoria=true WHERE id=$1', [user.id]);
    for (const url of ['/api/historico', `/api/historico/${id}`]) {
      const response = await client.request(url);
      assert.equal(response.status, state === 'troca pendente' ? 403 : 401);
      assert.equal(response.text.includes('autor@example.test'), false);
    }
  });

  it('revalida autorização dentro da transação diante de contexto antigo', async () => {
    const { user, client } = await actor(); const id = await seed();
    const stale = (await authRepository.session(context.db, digestToken(client.cookies.get('dnb_session')!)))!;
    const service = new HistoricoService(context.db), query = listHistoricoSchema.parse({});
    await context.db.query("UPDATE usuarios SET papel='vendedor' WHERE id=$1", [user.id]);
    await assert.rejects(() => service.list(stale, query), { status: 403 });
    await context.db.query("UPDATE usuarios SET papel='admin',troca_senha_obrigatoria=true WHERE id=$1", [user.id]);
    await assert.rejects(() => service.get(stale, id), { status: 403 });
    await context.db.query('UPDATE usuarios SET troca_senha_obrigatoria=false,ativo=false WHERE id=$1', [user.id]);
    await assert.rejects(() => service.list(stale, query), { status: 401 });
    await context.db.query('UPDATE usuarios SET ativo=true WHERE id=$1', [user.id]);
    await authRepository.revoke(context.db, stale.sessionId);
    await assert.rejects(() => service.get(stale, id), { status: 401 });
  });

  it('apresenta eventos reais dos módulos 01/02 após exclusão do imóvel, sem reconstruir dados', async () => {
    const { user, client } = await actor();
    const createdUser = await client.request('/api/usuarios', { method: 'POST', body: { nome: 'Vendedor Histórico', email: 'historico@example.test', senha: testPassword } });
    assert.equal(createdUser.status, 201);
    const created = await client.request('/api/imoveis', { method: 'POST', body: { titulo: 'Imóvel Removido', tipo: 'Casa', preco: '100.00', cidade: 'Concórdia', bairro: 'Centro' } });
    const imovelId = created.body.imovel!.id;
    assert.equal((await client.request(`/api/imoveis/${imovelId}`, { method: 'PATCH', body: { destaque: true } })).status, 200);
    assert.equal((await client.request(`/api/imoveis/${imovelId}`, { method: 'DELETE', body: {} })).status, 204);
    assert.equal((await client.request(`/api/imoveis/${imovelId}`)).status, 404);
    const before = await snapshot();
    const history = await client.request('/api/historico');
    assert.equal(history.body.registros!.length, 4);
    assert.equal(history.body.registros!.filter(row => row.entidade === 'usuario').length, 1);
    const events = (await client.request(path({ entidade: 'imovel', entidade_id: imovelId }))).body.registros!;
    assert.deepEqual(events.map(row => row.acao), ['DELETE', 'UPDATE', 'CREATE']);
    assert.ok(events.every(row => row.user_id === user.id && row.usuario_email === user.email));
    assert.match(events[0]!.descricao, /Imóvel Removido/);
    assert.equal((await client.request(`/api/historico/${events[0]!.id}`)).status, 200);
    assert.equal((await snapshot()) === before, true);
  });

  it('preserva nome e e-mail históricos após alteração e exclusão do responsável', async () => {
    const { client } = await actor(); const author = await context.user('vendedor', 'antigo@example.test');
    await audit(context.db, author, 'UPDATE', author.id, 'Evento anterior à remoção.');
    const id = (await context.db.query<{ id: string }>('SELECT id::text FROM historico')).rows[0]!.id;
    await context.db.query('UPDATE usuarios SET nome=$2,email=$3 WHERE id=$1', [author.id, 'Nome Novo', 'novo@example.test']);
    const renamed = (await client.request(`/api/historico/${id}`)).body.registro!;
    assert.equal(renamed.usuario_nome, author.nome); assert.equal(renamed.usuario_email, author.email);
    await context.db.query('DELETE FROM usuarios WHERE id=$1', [author.id]);
    const deleted = (await client.request(`/api/historico/${id}`)).body.registro!;
    assert.equal(deleted.user_id, author.id); assert.equal(deleted.usuario_email, author.email);
    assert.equal((await client.request('/api/historico')).body.registros!.length, 1);
  });

  it('consultas não escrevem histórico nem avançam sequência; POST/PATCH/DELETE não existem', async () => {
    const { client } = await actor(); const id = await seed();
    const before = await snapshot();
    const sequence = JSON.stringify((await context.db.query('SELECT last_value::text,is_called FROM historico_id_seq')).rows);
    await context.db.query("CREATE FUNCTION historico_forbid_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'consulta não deve escrever'; END $$");
    await context.db.query('CREATE TRIGGER historico_forbid_write BEFORE INSERT OR UPDATE OR DELETE ON historico FOR EACH ROW EXECUTE FUNCTION historico_forbid_write()');
    try {
      for (let i = 0; i < 3; i++) {
        assert.equal((await client.request('/api/historico')).status, 200);
        assert.equal((await client.request(`/api/historico/${id}`)).status, 200);
      }
      for (const method of ['POST', 'PATCH', 'DELETE']) {
        assert.equal((await client.request('/api/historico', { method, body: {} })).status, 404);
        assert.equal((await client.request(`/api/historico/${id}`, { method, body: {} })).status, 404);
      }
      assert.equal((await snapshot()) === before, true);
      assert.equal(JSON.stringify((await context.db.query('SELECT last_value::text,is_called FROM historico_id_seq')).rows) === sequence, true);
    } finally {
      await context.db.query('DROP TRIGGER historico_forbid_write ON historico'); await context.db.query('DROP FUNCTION historico_forbid_write()');
    }
  });

  it('GET não exige CSRF, mantém CORS restrito e nega Origin não permitido', async () => {
    const { client } = await actor(); await seed();
    const allowed = await client.request('/api/historico', { csrf: false });
    assert.equal(allowed.status, 200); assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
    assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
    const denied = await client.request('/api/historico', { headers: { Origin: 'https://hostil.example' } });
    assert.equal(denied.status, 403); assert.equal(denied.text.includes('autor@example.test'), false);
    assert.equal((await client.request('/api/historico', { headers: { Origin: '' } })).status, 200);
  });

  it('migration aditiva e reaplicada contém índices para ordem, entidade e usuário', async () => {
    const indexes = (await context.db.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='historico'")).rows.map(row => row.indexname);
    for (const name of ['historico_pkey', 'historico_criado_em_id_idx', 'historico_entidade_data_id_idx', 'historico_usuario_data_id_idx']) assert.ok(indexes.includes(name));
    const fks = await context.db.query("SELECT conname FROM pg_constraint WHERE conrelid='historico'::regclass AND contype='f'");
    assert.equal(fks.rows.length, 0);
  });
});
