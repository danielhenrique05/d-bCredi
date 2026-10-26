import pg from 'pg';
import { env } from '../config/env.js';
import { logDevelopmentError } from '../shared/logger.js';

export const pool = new pg.Pool({
  ...env.database,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  query_timeout: 3000,
  statement_timeout: 3000,
});

// Erros em conexões ociosas também precisam de um listener.
pool.on('error', (error: Error) => {
  logDevelopmentError('Erro em uma conexão ociosa do PostgreSQL.', error);
});
