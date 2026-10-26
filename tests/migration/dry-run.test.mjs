import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeMigration, timestamp } from '../../tools/migration/analysis.mjs';
import { publicConfig, readPublicSource, localTargetConfig, readTarget, TARGET_QUERIES, checkPublicImages, InspectionError } from '../../tools/migration/io.mjs';
import { run, savePrivateReport } from '../../tools/migration/cli.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../../tools/migration/fixtures/${name}.synthetic.json`, import.meta.url), 'utf8'));
const sourceFixture = await load('source');
const targetFixture = await load('target');
const mappingsFixture = (await load('owners')).mappings;
function analyze(change = {}) {
  return analyzeMigration({ source: structuredClone(sourceFixture), target: structuredClone(targetFixture), mappings: structuredClone(mappingsFixture), ...change });
}
const sourceWith = fields => ({ ...structuredClone(sourceFixture), properties: [{ ...sourceFixture.properties[0], ...fields }] });
const has = (report, code) => report.summary.issuesByCode[code] > 0;
const response = (value, range = '0-0/1', status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Range': range },
});
const publicSettings = { origin: 'https://synthetic.supabase.co', apiKey: 'sb_publishable_synthetic_only' };

describe('Inventário e dry-run puros, sem gravação', () => {
  it('imóvel válido preserva UUID, texto monetário e microssegundos com mapa explicitamente confirmado', () => {
    const before = JSON.stringify(sourceFixture);
    const report = analyze();
    assert.equal(report.summary.eligibleForProvidedSnapshots, 1);
    assert.equal(report.records[0].proposed.id, sourceFixture.properties[0].id);
    assert.equal(report.records[0].proposed.user_id, mappingsFixture[0].postgres_user_id);
    assert.equal(report.records[0].proposed.preco, '123456.78');
    assert.equal(report.records[0].proposed.criado_em, '2026-10-26T12:34:56.123456+00:00');
    assert.equal(report.readOnly, true);
    assert.equal(report.migrationExecuted, false);
    assert.equal(report.summary.realMigrationAuthorized, false);
    assert.equal(JSON.stringify(sourceFixture), before);
  });

  it('não associa proprietário automaticamente a nenhum usuário local', () => {
    const report = analyze({ mappings: [] });
    assert.equal(report.summary.unmappedOwners, 1);
    assert.equal(report.summary.eligibleForProvidedSnapshots, 0);
    assert.equal(report.records[0].proposed, null);
  });

  it('proprietário nulo, UUID inválido ou mapeamento sem confirmação bloqueiam a proposta', () => {
    for (const user_id of [null, '', 'não-é-UUID']) assert.ok(has(analyze({ source: sourceWith({ user_id }) }), 'owner_unmapped'));
    for (const changes of [{ confirmed: false }, { confirmedBy: '' }, { confirmedAt: 'ontem' }]) {
      const report = analyze({ mappings: [{ ...mappingsFixture[0], ...changes }] });
      assert.ok(has(report, 'mapping_unconfirmed'));
      assert.equal(report.summary.eligibleForProvidedSnapshots, 0);
    }
  });

  it('detecta conflitos um-para-muitos e muitos-para-um sem escolher identidades', () => {
    for (const changes of [{ postgres_user_id: '30000000-0000-4000-8000-000000000002' }, { supabase_user_id: '20000000-0000-4000-8000-000000000002' }]) {
      const target = structuredClone(targetFixture);
      target.users.push({ ...target.users[0], id: '30000000-0000-4000-8000-000000000002' });
      const report = analyze({ target, mappings: [mappingsFixture[0], { ...mappingsFixture[0], ...changes }] });
      assert.ok(has(report, 'mapping_identity_conflict'));
      assert.equal(report.summary.eligibleForProvidedSnapshots, 0);
    }
  });

  it('mapeamento para conta inexistente bloqueia; conta inativa exige revisão sem ser alterada', () => {
    assert.ok(has(analyze({ target: { ...targetFixture, users: [] } }), 'mapping_target_not_found'));
    const target = structuredClone(targetFixture); target.users[0].ativo = false;
    assert.ok(has(analyze({ target }), 'mapped_owner_inactive'));
    assert.equal(target.users[0].ativo, false);
  });

  it('UUID repetido na origem e UUID existente no destino bloqueiam ambos sem upsert', () => {
    const source = structuredClone(sourceFixture); source.properties.push({ ...source.properties[0] });
    assert.ok(has(analyze({ source }), 'duplicate_source_uuid'));
    assert.equal(analyze({ source }).summary.eligibleForProvidedSnapshots, 0);
    assert.ok(has(analyze({ target: { ...targetFixture, properties: source.properties } }), 'target_uuid_conflict'));
  });

  it('detecta possíveis duplicações com IDs distintos, sem deduplicar anúncios', () => {
    const source = structuredClone(sourceFixture);
    source.properties.push({ ...source.properties[0], id: '10000000-0000-4000-8000-000000000002' });
    assert.ok(has(analyze({ source }), 'possible_source_duplicate'));
    const target = { ...targetFixture, properties: [source.properties[1]] };
    assert.ok(has(analyze({ target }), 'possible_target_duplicate'));
  });

  it('preserva dinheiro acima da precisão de centavos de Number sem arredondamento', () => {
    const report = analyze({ source: sourceWith({ preco: '999999999999999.99' }) });
    assert.equal(report.records[0].proposed.preco, '999999999999999.99');
    for (const preco of [123.45, '1e4', '-1.00', 'R$ 1.000,00', '1.001', '9999999999999999.99']) {
      assert.equal(analyze({ source: sourceWith({ preco }) }).summary.eligibleForProvidedSnapshots, 0);
    }
  });

  it('campo obrigatório ausente, área zero e tipo incompatível não são corrigidos silenciosamente', () => {
    const source = structuredClone(sourceFixture); delete source.properties[0].titulo;
    assert.equal(analyze({ source }).summary.eligibleForProvidedSnapshots, 0);
    assert.equal(analyze({ source: sourceWith({ area: '0.00' }) }).summary.eligibleForProvidedSnapshots, 0);
    assert.equal(analyze({ source: sourceWith({ tipo: 'Outro tipo' }) }).summary.eligibleForProvidedSnapshots, 0);
  });

  it('valida datas reais, offset explícito e limite de microssegundos', () => {
    assert.equal(timestamp('2024-02-29T23:59:59.123456-03:00'), true);
    for (const date of ['2026-02-30T12:00:00Z', '2025-02-29T12:00:00Z', '0000-01-01T00:00:00Z', '2026-10-26',
      '2026-10-26T24:00:00Z', '2026-10-26T12:00:00.1234567Z', '2026-10-26T12:00:00']) {
      assert.equal(timestamp(date), false);
      assert.ok(has(analyze({ source: sourceWith({ criado_em: date }) }), 'invalid_timestamp'));
    }
  });

  it('capa repetida na galeria é normal; imagens repetidas dentro da galeria são reportadas', () => {
    const valid = analyze();
    assert.equal(valid.images.uniqueReferences, 2);
    assert.equal(has(valid, 'duplicate_gallery_image'), false);
    const duplicate = analyze({ source: sourceWith({ imagens: [sourceFixture.properties[0].imagem_url, sourceFixture.properties[0].imagem_url] }) });
    assert.ok(has(duplicate, 'duplicate_gallery_image'));
    assert.equal(duplicate.records[0].source.imagens.length, 2);
  });

  it('URLs inválidas, HTTP, credenciais e URLs temporárias são bloqueadas e sanitizadas', () => {
    for (const imagem_url of ['javascript:never-expose', '/foto.jpg', 'http://images.example.test/a.jpg',
      'https://user:never-expose@images.example.test/a.jpg', 'https://images.example.test/a.jpg?token=never-expose']) {
      const report = analyze({ source: sourceWith({ imagem_url }) });
      assert.ok(has(report, 'image_url_not_permanent_https'));
      assert.equal(report.records[0].proposed, null);
      assert.doesNotMatch(JSON.stringify(report), /never-expose/);
    }
  });

  it('limite de 20 fotos e galeria em tipo legado incompatível exigem revisão', () => {
    assert.equal(analyze({ source: sourceWith({ imagens: Array.from({ length: 21 }, (_v, i) => `https://images.example.test/${i}.jpg`) }) }).summary.eligibleForProvidedSnapshots, 0);
    assert.equal(analyze({ source: sourceWith({ imagens: '["https://images.example.test/a.jpg"]' }) }).summary.eligibleForProvidedSnapshots, 0);
  });

  it('esquema real diferente, NOT NULL adicional e índice/trigger desconhecido bloqueiam', () => {
    for (const mutate of [
      target => { target.columns.find(column => column.name === 'imagens').type = 'jsonb'; },
      target => { target.columns.push({ name: 'novo_obrigatorio', type: 'text', nullable: false, hasDefault: false }); },
      target => { target.triggers.push({ name: 'trigger_a_revisar' }); },
      target => { target.constraints.push({ type: 'c', definition: 'CHECK (preco > 0)' }); },
      target => { target.indexes.push({ definition: 'CREATE UNIQUE INDEX outro ON imoveis (titulo)' }); },
    ]) {
      const target = structuredClone(targetFixture); mutate(target);
      assert.equal(analyze({ target }).summary.eligibleForProvidedSnapshots, 0);
    }
  });

  it('verifica precisão de NUMERIC estreito sem propor arredondamento', () => {
    const target = structuredClone(targetFixture);
    Object.assign(target.columns.find(column => column.name === 'preco'), { precision: 5, scale: 2 });
    assert.ok(has(analyze({ target }), 'target_numeric_precision'));
    Object.assign(target.columns.find(column => column.name === 'preco'), { precision: 5, scale: -2 });
    assert.ok(has(analyze({ target }), 'target_numeric_definition_requires_review'));
  });

  it('sem origem disponível não trata falha de acesso como inventário vazio válido', () => {
    const report = analyze({ source: { available: false, kind: 'unavailable', properties: [] } });
    assert.ok(has(report, 'source_unavailable'));
    assert.ok(report.summary.blockingIssues > 0);
    assert.equal(report.source.available, false);
  });

  it('RLS/paginação pública nunca prova acesso completo ou autoriza migração real', () => {
    const report = analyze({ source: { ...sourceFixture, kind: 'public-rest' } });
    assert.ok(has(report, 'source_full_access_unconfirmed'));
    assert.equal(report.summary.realMigrationAuthorized, false);
  });

  it('aponta referências compartilhadas e possíveis órfãos sem presumir exclusão segura', () => {
    const source = structuredClone(sourceFixture);
    source.properties.push({ ...source.properties[0], id: '10000000-0000-4000-8000-000000000002' });
    const report = analyze({ source, objects: ['imoveis/a.jpg', 'imoveis/b.jpg', 'imoveis/possivel-orfao.jpg'] });
    assert.equal(report.images.sharedReferences, 2);
    assert.deepEqual(report.images.orphanCandidates, ['imoveis/possivel-orfao.jpg']);
    assert.match(report.images.orphanAssessment, /inconclusive/);
    assert.equal(analyze().images.orphanCandidates, null);
  });

  it('campos externos desnecessários, credenciais e hashes não são copiados', () => {
    const report = analyze({ source: sourceWith({ senha_hash: 'never-expose', access_token: 'never-expose', dados_internos: { senha: 'never-expose' } }) });
    assert.doesNotMatch(JSON.stringify(report), /never-expose|senha_hash|access_token/);
  });

  it('metadados inválidos do snapshot não vazam valores no resumo e identidades conflitantes bloqueiam', () => {
    const source = { ...sourceWith({ user_id: 'never-expose' }), kind: 'never-expose', visibleTotal: { token: 'never-expose' } };
    const target = structuredClone(targetFixture);
    target.users.push({ ...target.users[0], papel: { token: 'never-expose' } });
    const report = analyze({ source, target });
    assert.ok(has(report, 'target_user_snapshot_invalid'));
    assert.ok(has(report, 'target_identity_uuid_conflict'));
    assert.doesNotMatch(JSON.stringify(report), /never-expose/);
    assert.equal(report.source.visibleTotal, null);
    assert.equal(report.records[0].proposed, null);
  });
});

describe('Adaptadores estritamente de leitura', () => {
  it('busca somente GET com campos explícitos e NUMERIC convertido em texto antes do JSON', async () => {
    const calls = [];
    const source = await readPublicSource(publicSettings, async (url, init) => {
      calls.push({ url: new URL(url), init });
      return response(sourceFixture.properties);
    });
    assert.equal(source.fullAccessConfirmed, false);
    assert.equal(source.properties[0].preco, '123456.78');
    assert.equal(calls[0].init.method, 'GET');
    assert.match(calls[0].url.searchParams.get('select'), /preco::text/);
    assert.match(calls[0].url.searchParams.get('select'), /area::text/);
    assert.equal(calls[0].init.credentials, 'omit');
  });

  it('paginação respeita páginas menores impostas pelo servidor', async () => {
    let count = 0;
    const source = await readPublicSource(publicSettings, async url => {
      assert.equal(new URL(url).searchParams.get('offset'), String(count));
      const row = { ...sourceFixture.properties[0], id: `10000000-0000-4000-8000-00000000000${count + 1}` };
      count += 1;
      return response([row], `${count - 1}-${count - 1}/2`);
    });
    assert.equal(source.properties.length, 2);
    assert.equal(count, 2);
  });

  it('contagem mudando e raiz inesperada abortam sem declarar catálogo completo', async () => {
    let count = 0;
    await assert.rejects(readPublicSource(publicSettings, async () => response([sourceFixture.properties[0]], count++ === 0 ? '0-0/2' : '1-1/3')), error => error.code === 'source_changed_during_inventory');
    await assert.rejects(readPublicSource(publicSettings, async () => response({ data: [] })), error => error.code === 'source_structure_invalid');
  });

  it('HTTP 403, erro de rede e JSON inválido são erros seguros de acesso', async () => {
    for (const fetchImpl of [async () => response({ message: 'never-expose' }, '*/0', 403), async () => { throw new Error('never-expose'); },
      async () => new Response('{never-expose', { headers: { 'Content-Type': 'application/json' } })]) {
      await assert.rejects(readPublicSource(publicSettings, fetchImpl), error => {
        assert.ok(error instanceof InspectionError);
        assert.doesNotMatch(error.message, /never-expose/);
        return true;
      });
    }
  });

  it('recusa chave privilegiada e não utiliza DATABASE_URL remoto implicitamente', () => {
    for (const key of ['sb_secret_never-expose', Buffer.from('x').toString('base64'), 'eyJ.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.x']) {
      assert.throws(() => publicConfig({ VITE_SUPABASE_URL: publicSettings.origin, VITE_SUPABASE_PUBLISHABLE_KEY: key }), error => error.code === 'public_source_configuration_invalid');
    }
    assert.equal(publicConfig({ VITE_SUPABASE_URL: publicSettings.origin, VITE_SUPABASE_PUBLISHABLE_KEY: publicSettings.apiKey }).apiKey, publicSettings.apiKey);
    assert.throws(() => localTargetConfig({ NODE_ENV: 'production', DATABASE_URL: 'never-expose' }), error => error.code === 'local_target_configuration_invalid');
  });

  it('destino só recebe transação READ ONLY, SELECTs fixos e ROLLBACK', async () => {
    const calls = [];
    let ended = false;
    const rows = [targetFixture.columns, targetFixture.constraints, targetFixture.indexes, targetFixture.triggers, targetFixture.users, []];
    const target = await readTarget({}, () => ({
      async connect() {}, async end() { ended = true; },
      async query(sql) {
        calls.push(sql);
        assert.match(sql, /^(BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY|SELECT |ROLLBACK)/);
        assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\b/i);
        return { rows: sql.includes('current_setting') ? [{ read_only: 'on' }] : sql.startsWith('SELECT') ? rows.shift() : [] };
      },
    }));
    assert.equal(target.properties.length, 0);
    assert.equal(calls.length, TARGET_QUERIES.length + 3);
    assert.equal(calls.at(-1), 'ROLLBACK');
    assert.equal(ended, true);
  });

  it('recusa conexão sem proteção read-only e sempre encerra o cliente', async () => {
    let ended = false; const calls = [];
    await assert.rejects(readTarget({}, () => ({
      async connect() {}, async end() { ended = true; },
      async query(sql) { calls.push(sql); return { rows: [{ read_only: 'off' }] }; },
    })), error => error.code === 'target_readonly_not_confirmed');
    assert.equal(ended, true);
    assert.equal(calls.at(-1), 'ROLLBACK');
  });

  it('HEAD só verifica imagens públicas da mesma origem sem chave/credencial e sem uploads', async () => {
    const calls = [];
    const rows = [{ ...sourceFixture.properties[0], imagens: [...sourceFixture.properties[0].imagens, 'https://other.example.test/a.jpg', 'https://synthetic.supabase.co/storage/v1/object/private/x/a.jpg'] }];
    const checks = await checkPublicImages(rows, publicSettings.origin, async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1000' } });
    });
    assert.equal(checks.length, 2);
    assert.ok(calls.every(call => call.init.method === 'HEAD' && call.init.credentials === 'omit' && !call.init.headers));
    await assert.rejects(checkPublicImages(rows, 'https://127.0.0.1'), error => error.code === 'public_image_origin_invalid');
  });
});

describe('CLI de simulação e proteção de relatórios', () => {
  it('por padrão usa apenas fixtures e não confirma mapeamento automaticamente', async () => {
    const { summary } = await run(['dry-run'], { fetchImpl() { assert.fail('Sem rede no modo fixture.'); } });
    assert.equal(summary.source.kind, 'synthetic');
    assert.equal(summary.unmappedOwners, 1);
    assert.equal(summary.privateReportSaved, false);
  });

  it('fixture com mapa sintético confirmado gera candidato sem importar', async () => {
    const { summary } = await run(['dry-run', '--mapping', 'tools/migration/fixtures/owners.synthetic.json']);
    assert.equal(summary.eligibleForProvidedSnapshots, 1);
    assert.equal(summary.realMigrationAuthorized, false);
  });

  it('não implementa flag apply/import nem aceita argumentos desconhecidos', async () => {
    for (const args of [['apply'], ['dry-run', '--apply'], ['inventory', '--source-env']]) {
      await assert.rejects(run(args), error => error instanceof InspectionError);
    }
  });

  it('relatório é explicitamente solicitado, sanitizado e não sobrescreve arquivo existente', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dnb-inventory-'));
    try {
      await assert.rejects(savePrivateReport('../outside.json', {}, directory), error => error.code === 'report_filename_invalid');
      await savePrivateReport('synthetic.json', analyze(), directory);
      assert.equal(JSON.parse(await readFile(join(directory, 'synthetic.json'), 'utf8')).migrationExecuted, false);
      await assert.rejects(savePrivateReport('synthetic.json', {}, directory), error => error.code === 'EEXIST');
    } finally {
      // Somente o arquivo temporário sintético criado por este teste, sem recursão.
      await unlink(join(directory, 'synthetic.json')).catch(() => {});
      await rmdir(directory);
    }
  });
});
