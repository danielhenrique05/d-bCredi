import { createRequire } from 'node:module';
import { fields, publicImage } from './analysis.mjs';

export class InspectionError extends Error {
  constructor(code) { super('Inspeção não concluída. Detalhes externos e credenciais omitidos.'); this.code = code; }
}

export function publicConfig(env) {
  const origin = env.VITE_SUPABASE_URL;
  const apiKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.protocol !== 'https:' || !/(?:^|\.)supabase\.(co|com)$/.test(url.hostname) || url.username || url.password) throw new Error();
    let anonymous = typeof apiKey === 'string' && apiKey.startsWith('sb_publishable_');
    if (typeof apiKey === 'string' && apiKey.startsWith('eyJ')) {
      anonymous = JSON.parse(Buffer.from(apiKey.split('.')[1], 'base64url').toString('utf8')).role === 'anon';
    }
    if (!anonymous) throw new Error();
    return { origin, apiKey };
  } catch { throw new InspectionError('public_source_configuration_invalid'); }
}

async function jsonResponse(fetchImpl, url, init) {
  const controller = new AbortController();
  let reader;
  let response;
  let timer;
  const discard = () => { void (reader ? reader.cancel() : response?.body?.cancel())?.catch(() => {}); };
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => { controller.abort(); discard(); reject(new InspectionError('source_timeout')); }, 5000);
  });
  const read = async () => {
    response = await fetchImpl(url, { ...init, signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store' });
    if (controller.signal.aborted) { discard(); throw new InspectionError('source_timeout'); }
    if (![200, 206].includes(response.status) || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || !response.body) {
      throw new InspectionError('source_access_failed');
    }
    reader = response.body.getReader();
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4 * 1024 * 1024) throw new InspectionError('source_response_limit');
        chunks.push(value);
      }
    } finally { reader.releaseLock(); reader = undefined; }
    return { payload: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))), range: response.headers.get('content-range') };
  };
  try { return await Promise.race([read(), timeout]); }
  catch (error) { throw error instanceof InspectionError ? error : new InspectionError('source_access_failed'); }
  finally { clearTimeout(timer); controller.abort(); discard(); }
}

export async function readPublicSource(config, fetchImpl = globalThis.fetch) {
  const properties = [];
  let visibleTotal = null;
  // Cast feito no PostgreSQL/PostgREST antes de JSON: não converte dinheiro para Number.
  const select = fields.map(field => ['preco', 'area'].includes(field) ? `${field}::text` : field).join(',');
  for (let page = 0; page < 100; page += 1) {
    const url = new URL('/rest/v1/imoveis', config.origin);
    url.search = new URLSearchParams({ select, order: 'id.asc', limit: '200', offset: String(properties.length) }).toString();
    const { payload, range } = await jsonResponse(fetchImpl, url.href, {
      method: 'GET', headers: { apikey: config.apiKey, Prefer: 'count=exact' },
    });
    if (!Array.isArray(payload)) throw new InspectionError('source_structure_invalid');
    const count = range?.match(/\/(\d+)$/);
    if (count) {
      const receivedTotal = Number(count[1]);
      if (!Number.isSafeInteger(receivedTotal) || (visibleTotal !== null && receivedTotal !== visibleTotal)) throw new InspectionError('source_changed_during_inventory');
      visibleTotal = receivedTotal;
    }
    properties.push(...payload);
    if (properties.length > 10000) throw new InspectionError('source_record_limit');
    if (payload.length === 0 || visibleTotal !== null && properties.length >= visibleTotal) {
      if (visibleTotal !== null && properties.length !== visibleTotal) throw new InspectionError('source_pagination_incomplete');
      return { kind: 'public-rest', available: true, fullAccessConfirmed: false, paginationComplete: true, visibleTotal, properties };
    }
  }
  throw new InspectionError('source_page_limit');
}

export function localTargetConfig(env) {
  if (!['development', 'test'].includes(env.NODE_ENV) || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)
    || !/^(db_credi_dev|db_credi_test_[\w]+)$/.test(env.DB_NAME ?? '') || !/^\d+$/.test(env.DB_PORT ?? '')
    || Number(env.DB_PORT) < 1 || Number(env.DB_PORT) > 65535 || !env.DB_USER || env.DB_PASSWORD === undefined) throw new InspectionError('local_target_configuration_invalid');
  return { host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
    connectionTimeoutMillis: 5000, query_timeout: 5000, application_name: 'dnb_migration_readonly',
    options: '-c default_transaction_read_only=on -c statement_timeout=5000' };
}

// SQL fixo: nenhum identificador ou comando SQL vem de arquivo de origem/mapeamento.
export const TARGET_QUERIES = [
  `SELECT column_name AS name,udt_name AS type,is_nullable='YES' AS nullable,column_default IS NOT NULL AS "hasDefault",
   numeric_precision AS precision,numeric_scale AS scale,character_maximum_length AS "maxLength"
   FROM information_schema.columns WHERE table_schema='public' AND table_name='imoveis' ORDER BY ordinal_position`,
  `SELECT contype AS type,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=to_regclass('public.imoveis')`,
  `SELECT indexdef AS definition FROM pg_indexes WHERE schemaname='public' AND tablename='imoveis'`,
  `SELECT tgname AS name FROM pg_trigger WHERE tgrelid=to_regclass('public.imoveis') AND NOT tgisinternal`,
  `SELECT id::text,ativo,papel FROM public.usuarios ORDER BY id LIMIT 10001`,
  `SELECT id::text,user_id::text,titulo,tipo,preco::text,cidade,bairro,quartos,banheiros,vagas,area::text,descricao,imagem_url,imagens,destaque,criado_em::text FROM public.imoveis ORDER BY id LIMIT 10001`,
];

export async function readTarget(config, makeClient) {
  if (!makeClient) {
    const { Client } = createRequire(new URL('../../backend/package.json', import.meta.url))('pg');
    makeClient = settings => new Client(settings);
  }
  const client = makeClient(config);
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const protection = await client.query("SELECT current_setting('transaction_read_only') AS read_only");
    if (protection.rows[0]?.read_only !== 'on') throw new InspectionError('target_readonly_not_confirmed');
    const snapshots = [];
    for (const sql of TARGET_QUERIES) snapshots.push((await client.query(sql)).rows);
    const [columns, constraints, indexes, triggers, users, properties] = snapshots;
    if (users.length > 10000 || properties.length > 10000) throw new InspectionError('target_snapshot_limit');
    return { kind: 'local-postgres', available: true, columns, constraints, indexes, triggers, users, properties };
  } catch (error) { throw error instanceof InspectionError ? error : new InspectionError('target_inspection_failed'); }
  finally {
    try { await client.query('ROLLBACK'); } catch { /* Encerramento da conexão também aborta a transação. */ }
    await client.end();
  }
}

export async function checkPublicImages(properties, origin, fetchImpl = globalThis.fetch) {
  try {
    const trusted = new URL(origin);
    if (trusted.origin !== origin || trusted.protocol !== 'https:' || !/(?:^|\.)supabase\.(co|com)$/.test(trusted.hostname)) throw new Error();
  } catch { throw new InspectionError('public_image_origin_invalid'); }
  const references = [...new Set(properties.flatMap(row => [row?.imagem_url, ...(Array.isArray(row?.imagens) ? row.imagens : [])]).filter(value => typeof value === 'string'))];
  const checks = [];
  for (const reference of references) {
    const url = publicImage(reference);
    // Nunca faz HEAD de destinos arbitrários presentes nos dados (SSRF).
    if (!url || url.origin !== origin || !url.pathname.startsWith('/storage/v1/object/public/fotos-imoveis/')) continue;
    try {
      const response = await fetchImpl(url.href, { method: 'HEAD', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
      checks.push({ url: reference, status: response.status, contentType: response.headers.get('content-type')?.split(';')[0] ?? null,
        bytes: /^\d+$/.test(response.headers.get('content-length') ?? '') ? Number(response.headers.get('content-length')) : null });
      void response.body?.cancel().catch(() => {});
    } catch { checks.push({ url: reference, status: 'unavailable', contentType: null, bytes: null }); }
  }
  return checks;
}
