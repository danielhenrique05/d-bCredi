import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';
import { logDevelopmentError } from '../shared/logger.js';

try {
  const name = process.argv[2];
  if (!name || !/^\d{10}_[a-z0-9_]+\.sql$/.test(name) || process.argv.length !== 3) {
    throw new Error('Uso: npm run db:migrate -- 2026102401_auth.sql');
  }
  const sql = await readFile(new URL(`../../src/database/migrations/${name}`, import.meta.url), 'utf8');
  await pool.query(sql);
  console.info(`Migration aplicada explicitamente: ${name}.`);
} catch (error) {
  console.error('Não foi possível aplicar a migration. Confira o nome do arquivo, o ambiente e os pré-requisitos.');
  logDevelopmentError('Falha na migration.', error);
  process.exitCode = 1;
} finally { await pool.end(); }
