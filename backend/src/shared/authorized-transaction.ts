import { transaction, type Database, type DatabaseClient } from '../database/transaction.js';
import { authRepository, type AuthContext } from '../modules/auth/auth.repository.js';
import { forbidden, unauthorized } from './http-error.js';

export function authorizedTransaction<T>(db: Database, context: AuthContext,
  work: (client: DatabaseClient, current: AuthContext) => Promise<T>, admin = false): Promise<T> {
  return transaction(db, async client => {
    // Volume administrativo pequeno: serializa mutações e a regra do último admin.
    // Também impede autorizações antigas após revogação, alteração de papel ou desativação.
    await client.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
    const current = await authRepository.current(client, context.sessionId);
    if (!current) throw unauthorized();
    if (admin && current.user.papel !== 'admin') throw forbidden();
    return work(client, current);
  });
}
