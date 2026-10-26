import { runAdminReset, terminalAdminResetInput } from './admin-reset-command.js';
import { formatAdminError } from './admin-errors.js';
import { assertAdminRecoveryScope } from './recover-admin-password.js';

let closeDatabase: (() => Promise<void>) | undefined;
try {
  const { env } = await import('../config/env.js');
  const scope = { nodeEnv: process.env.NODE_ENV, host: env.database.host, database: env.database.database };
  assertAdminRecoveryScope(scope);
  await runAdminReset(process.argv.slice(2), terminalAdminResetInput, scope, async () => {
    const { pool } = await import('../database/pool.js');
    closeDatabase = () => pool.end();
    return pool;
  });
  console.info('Senha administrativa redefinida. Sessões anteriores revogadas. Altere a senha após entrar novamente.');
} catch (error) {
  for (const line of formatAdminError(error, 'Senha administrativa não redefinida.')) console.error(line);
  process.exitCode = 1;
} finally {
  try { await closeDatabase?.(); }
  catch {
    console.error('- banco [shutdown_failed]: Não foi possível encerrar a conexão administrativa.');
    process.exitCode = 1;
  }
}
