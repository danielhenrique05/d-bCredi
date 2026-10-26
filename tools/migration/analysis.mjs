import { createHash } from 'node:crypto';
import { createImovelSchema } from '../../backend/src/modules/imoveis/imoveis.schema.ts';

export const fields = ['id', 'user_id', 'titulo', 'tipo', 'preco', 'cidade', 'bairro', 'quartos', 'banheiros', 'vagas', 'area', 'descricao', 'imagem_url', 'imagens', 'destaque', 'criado_em'];
const inputFields = fields.filter(field => !['id', 'user_id', 'criado_em'].includes(field));
export const uuid = value => typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const key = value => typeof value === 'string' ? value.toLowerCase() : '';
const issue = (code, field = '', severity = 'error') => ({ code, field, severity });

// Valida calendário e offset sem truncar microssegundos em Date/ISO de JS.
export function timestamp(value) {
  const parts = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && hour <= 23 && minute <= 59 && second <= 59
    && (parts[7] === 'Z' || (Number(parts[9]) <= 14 && Number(parts[10]) <= 59 && (Number(parts[9]) !== 14 || Number(parts[10]) === 0)));
}

export function publicImage(value) {
  if (typeof value !== 'string' || /[\s\\\p{Cc}\p{Cf}]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash ? url : null;
  } catch { return null; }
}

function safeImage(value) {
  if (value === null || value === undefined) return value;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '[invalid-url]';
    return `${url.origin}${url.pathname}${url.search || url.hash ? '?[redacted]' : ''}`;
  } catch { return '[invalid-url]'; }
}

function inventoryRow(row) {
  const projected = {};
  for (const field of fields) {
    if (!(field in row)) continue;
    const value = row[field];
    projected[field] = ['id', 'user_id'].includes(field) ? (value === null ? null : uuid(value) ? value : '[invalid-uuid]') : field === 'imagens'
      ? (Array.isArray(value) ? value.map(safeImage) : value === null ? null : '[invalid-gallery]')
      : field === 'imagem_url' ? safeImage(value)
        : value !== null && typeof value === 'object' ? '[invalid-type]' : value;
  }
  return projected;
}

function parseBusiness(row) {
  return createImovelSchema.safeParse(Object.fromEntries(inputFields.filter(field => field in row).map(field => [field, row[field]])));
}

function fingerprint(data) {
  return createHash('sha256').update(JSON.stringify(['titulo', 'tipo', 'cidade', 'bairro', 'preco', 'area', 'quartos']
    .map(field => typeof data[field] === 'string' ? data[field].trim().toLowerCase() : data[field] ?? null))).digest('hex');
}

function inspectSchema(target) {
  if (!target?.available || !Array.isArray(target.columns)) return [issue('target_schema_unavailable')];
  const expected = {
    id: ['uuid'], user_id: ['uuid'], titulo: ['text', 'varchar'], tipo: ['text', 'varchar'], preco: ['numeric'],
    cidade: ['text', 'varchar'], bairro: ['text', 'varchar'], quartos: ['int4'], banheiros: ['int4'], vagas: ['int4'],
    area: ['numeric'], descricao: ['text', 'varchar'], imagem_url: ['text', 'varchar'], imagens: ['_text'], destaque: ['bool'], criado_em: ['timestamptz'],
  };
  const issues = [];
  for (const [name, types] of Object.entries(expected)) {
    const column = target.columns.find(item => item.name === name);
    if (!column || !types.includes(column.type)) issues.push(issue('target_column_incompatible', name));
  }
  for (const column of target.columns) {
    if (!(column.name in expected) && !column.nullable && !column.hasDefault) issues.push(issue('target_extra_required_column', column.name));
    if (column.type === 'numeric' && column.precision !== null && column.precision !== undefined
      && (!Number.isInteger(column.precision) || !Number.isInteger(column.scale) || column.scale < 0 || column.scale > column.precision)) issues.push(issue('target_numeric_definition_requires_review', column.name));
  }
  if (!target.constraints?.some(item => item.type === 'f' && /FOREIGN KEY \(user_id\) REFERENCES (?:public\.)?usuarios\(id\)/i.test(item.definition))) {
    issues.push(issue('target_owner_fk_unconfirmed', 'user_id'));
  }
  if (!target.constraints?.some(item => item.type === 'p' && /PRIMARY KEY \(id\)/i.test(item.definition))) issues.push(issue('target_primary_key_unconfirmed', 'id'));
  if (target.constraints?.some(item => item.type === 'c')) issues.push(issue('target_check_requires_review'));
  if (target.indexes?.some(item => /CREATE UNIQUE INDEX/i.test(item.definition) && !/\("?id"?\)(?:\s|$)/i.test(item.definition))) issues.push(issue('target_unique_index_requires_review'));
  if (target.triggers?.length) issues.push(issue('target_trigger_requires_review'));
  return issues;
}

function inspectMapping(mappings, users) {
  const issues = [];
  const bySource = new Map();
  const byTarget = new Map();
  for (const entry of mappings) {
    if (!uuid(entry.supabase_user_id) || !uuid(entry.postgres_user_id)) { issues.push(issue('mapping_invalid_uuid')); continue; }
    const from = key(entry.supabase_user_id), to = key(entry.postgres_user_id);
    if (bySource.has(from) || byTarget.has(to)) issues.push(issue('mapping_identity_conflict'));
    if (entry.confirmed !== true || typeof entry.confirmedBy !== 'string' || !entry.confirmedBy.trim() || !timestamp(entry.confirmedAt)) {
      issues.push(issue('mapping_unconfirmed'));
      continue;
    }
    if (!users.some(user => key(user.id) === to)) { issues.push(issue('mapping_target_not_found')); continue; }
    bySource.set(from, to); byTarget.set(to, from);
  }
  return { bySource, issues };
}

export function analyzeMigration({ source, target, mappings = [], objects = null, imageChecks = [] }) {
  const sourceRows = Array.isArray(source?.properties) ? source.properties : [];
  const targetRows = Array.isArray(target?.properties) ? target.properties : [];
  const users = Array.isArray(target?.users) ? target.users : [];
  const globalIssues = inspectSchema(target);
  if (!source?.available) globalIssues.push(issue('source_unavailable'));
  if (!Array.isArray(source?.properties)) globalIssues.push(issue('source_structure_invalid'));
  if (!Array.isArray(target?.users) || !Array.isArray(target?.properties)) globalIssues.push(issue('target_snapshot_invalid'));
  if (users.some(user => !user || !uuid(user.id) || typeof user.ativo !== 'boolean' || !['admin', 'vendedor'].includes(user.papel))) globalIssues.push(issue('target_user_snapshot_invalid'));
  if (new Set(users.map(user => key(user?.id))).size !== users.length) globalIssues.push(issue('target_identity_uuid_conflict'));
  if (!source?.paginationComplete) globalIssues.push(issue('source_pagination_incomplete'));
  if (source?.kind !== 'synthetic' && source?.fullAccessConfirmed !== true) globalIssues.push(issue('source_full_access_unconfirmed', '', 'warning'));
  const mapping = inspectMapping(mappings, users);
  globalIssues.push(...mapping.issues);
  const counts = new Map();
  for (const row of sourceRows) if (uuid(row?.id)) counts.set(key(row.id), (counts.get(key(row.id)) ?? 0) + 1);
  const targetIds = new Set(targetRows.filter(row => uuid(row.id)).map(row => key(row.id)));
  const targetFingerprints = new Set(targetRows.filter(row => row && typeof row === 'object' && !Array.isArray(row)).map(parseBusiness).filter(result => result.success).map(result => fingerprint(result.data)));
  const shared = new Map();
  const records = sourceRows.map((raw, index) => {
    const row = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
    const issues = [];
    if (!uuid(row.id)) issues.push(issue('invalid_uuid', 'id'));
    if ((counts.get(key(row.id)) ?? 0) > 1) issues.push(issue('duplicate_source_uuid', 'id'));
    if (targetIds.has(key(row.id))) issues.push(issue('target_uuid_conflict', 'id'));
    const owner = uuid(row.user_id) ? mapping.bySource.get(key(row.user_id)) : undefined;
    if (!owner) issues.push(issue('owner_unmapped', 'user_id'));
    if (owner && users.find(user => key(user.id) === owner)?.ativo !== true) issues.push(issue('mapped_owner_inactive', 'user_id', 'warning'));
    if (!timestamp(row.criado_em)) issues.push(issue('invalid_timestamp', 'criado_em'));
    for (const field of ['preco', 'area']) {
      if ((field === 'preco' || row[field] !== null && row[field] !== undefined) && typeof row[field] !== 'string') issues.push(issue('decimal_requires_string', field));
    }
    const result = parseBusiness(row);
    if (!result.success) {
      for (const invalid of result.error.issues) issues.push(issue(`schema_${invalid.code}`, invalid.path.join('.')));
    }
    const gallery = Array.isArray(row.imagens) ? row.imagens : [];
    if (new Set(gallery).size !== gallery.length) issues.push(issue('duplicate_gallery_image', 'imagens', 'warning'));
    const references = [...new Set([row.imagem_url, ...gallery].filter(value => value !== null && value !== undefined))];
    for (const ref of references) {
      if (!publicImage(ref)) issues.push(issue('image_url_not_permanent_https', 'imagens'));
      else {
        if (!shared.has(ref)) shared.set(ref, new Set());
        shared.get(ref).add(index);
        const checked = imageChecks.find(item => item.url === ref);
        if (checked && (checked.status !== 200 || !['image/jpeg', 'image/png', 'image/webp'].includes(checked.contentType))) issues.push(issue('image_reference_unverified', 'imagens', 'warning'));
      }
    }
    if (result.success) {
      for (const column of target?.columns ?? []) {
        const value = result.data[column.name];
        if (value === null && column.nullable === false) issues.push(issue('target_not_null', column.name));
        if (value === undefined && !column.nullable && !column.hasDefault && !['id', 'user_id', 'criado_em'].includes(column.name)) issues.push(issue('target_required_value_missing', column.name));
        if (typeof value === 'string' && column.maxLength && [...value].length > column.maxLength) issues.push(issue('target_text_length', column.name));
        if (column.type === 'numeric' && typeof value === 'string' && column.precision !== null && column.precision !== undefined) {
          const [integer, fraction = ''] = value.split('.');
          if (integer.length > column.precision - column.scale || (column.scale < fraction.length && /[1-9]/.test(fraction.slice(column.scale)))) issues.push(issue('target_numeric_precision', column.name));
        }
      }
    }
    const signature = result.success ? fingerprint(result.data) : null;
    if (signature && targetFingerprints.has(signature)) issues.push(issue('possible_target_duplicate', '', 'warning'));
    return {
      index, source: inventoryRow(row), uniqueImageCount: references.length, issues, fingerprint: signature,
      proposed: result.success ? { ...result.data, id: row.id, user_id: owner ?? null, criado_em: row.criado_em } : null,
    };
  });
  const signatures = new Map();
  for (const record of records) if (record.fingerprint) signatures.set(record.fingerprint, (signatures.get(record.fingerprint) ?? 0) + 1);
  for (const record of records) {
    if (record.fingerprint && signatures.get(record.fingerprint) > 1) record.issues.push(issue('possible_source_duplicate', '', 'warning'));
    record.eligibleForProvidedSnapshots = !globalIssues.some(item => item.severity === 'error') && !record.issues.some(item => item.severity === 'error');
    // Não persiste propostas inválidas, em especial URLs temporárias com tokens.
    if (!record.eligibleForProvidedSnapshots) record.proposed = null;
  }
  const objectKeys = new Set();
  for (const ref of [...shared.keys(), ...targetRows.flatMap(row => [row.imagem_url, ...(Array.isArray(row.imagens) ? row.imagens : [])])]) {
    const url = publicImage(ref);
    const prefix = '/storage/v1/object/public/fotos-imoveis/';
    if (url?.pathname.startsWith(prefix)) {
      try { objectKeys.add(decodeURIComponent(url.pathname.slice(prefix.length))); } catch { /* Referência fica para revisão; nenhuma exclusão é feita. */ }
    }
  }
  const orphanCandidates = Array.isArray(objects) ? objects.filter(value => typeof value === 'string' && !objectKeys.has(value)) : null;
  const allIssues = [...globalIssues, ...records.flatMap(record => record.issues)];
  const byCode = {};
  for (const item of allIssues) byCode[item.code] = (byCode[item.code] ?? 0) + 1;
  return {
    version: 1, readOnly: true, migrationExecuted: false,
    source: { kind: ['synthetic', 'public-rest', 'snapshot', 'unavailable'].includes(source?.kind) ? source.kind : 'unknown', available: source?.available === true, fullAccessConfirmed: source?.fullAccessConfirmed === true, paginationComplete: source?.paginationComplete === true, visibleTotal: Number.isSafeInteger(source?.visibleTotal) && source.visibleTotal >= 0 ? source.visibleTotal : null },
    target: { available: target?.available === true, columns: (target?.columns ?? []).map(column => Object.fromEntries(['name', 'type', 'nullable', 'hasDefault', 'precision', 'scale', 'maxLength'].map(field => [field, column[field]]))), users: users.map(user => ({ id: uuid(user?.id) ? user.id : '[invalid-uuid]', ativo: user?.ativo === true, papel: ['admin', 'vendedor'].includes(user?.papel) ? user.papel : '[invalid-role]' })), propertyCount: targetRows.length },
    globalIssues, records,
    images: { uniqueReferences: shared.size, sharedReferences: [...shared.values()].filter(indices => indices.size > 1).length,
      checks: imageChecks.map(item => ({ url: safeImage(item.url), status: item.status, contentType: item.contentType, bytes: item.bytes })), orphanCandidates,
      orphanAssessment: 'inconclusive_without_complete_property_and_object_inventories' },
    summary: { sourceRecords: records.length, targetRecords: targetRows.length, owners: new Set(sourceRows.map(row => key(row?.user_id)).filter(Boolean)).size,
      unmappedOwners: new Set(records.filter(record => record.issues.some(item => item.code === 'owner_unmapped')).map(record => key(record.source.user_id))).size,
      eligibleForProvidedSnapshots: records.filter(record => record.eligibleForProvidedSnapshots).length,
      blockingIssues: allIssues.filter(item => item.severity === 'error').length, warnings: allIssues.filter(item => item.severity === 'warning').length,
      issuesByCode: byCode, realMigrationAuthorized: false },
  };
}
