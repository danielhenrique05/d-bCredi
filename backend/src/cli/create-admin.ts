import { runAdminCreate, terminalAdminInput } from './admin-command.js';
import { formatAdminError } from './admin-errors.js';

let closeDatabase: (() => Promise<void>) | undefined;

try {
  await runAdminCreate(process.argv.slice(2), terminalAdminInput, async () => {
    // Inclui falhas de ambiente no tratamento do CLI; o Pool continua único e lazy.
    const { pool } = await import('../database/pool.js');
    closeDatabase = () => pool.end();
    return pool;
  });
  console.info('Administrador inicial criado. Nenhuma credencial foi impressa.');
} catch (error) {
  for (const line of formatAdminError(error)) console.error(line);
  process.exitCode = 1;
} finally {
  try { await closeDatabase?.(); }
  catch {
    console.error('- banco [shutdown_failed]: Não foi possível encerrar a conexão administrativa.');
    process.exitCode = 1;
  }
}
