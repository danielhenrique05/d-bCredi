import { z } from 'zod';
import { transaction, type Database, type Queryable } from '../database/transaction.js';
import { AdminInputError } from './admin-errors.js';
import { emailSchema, idSchema, passwordSchema } from '../shared/validation.js';
import { hashPassword } from '../shared/password.js';
import { audit } from '../shared/audit.js';
import { authRepository } from '../modules/auth/auth.repository.js';
import { usersRepository, publicUser } from '../modules/usuarios/usuarios.repository.js';

export interface AdminRecoveryScope {
  readonly nodeEnv: string | undefined;
  readonly host: string;
  readonly database: string;
}

export const RECOVERY_TARGET_SQL = 'SELECT current_database() AS banco, host(inet_server_addr()) AS endereco';

export function assertAdminRecoveryScope(scope: AdminRecoveryScope): void {
  if (scope.nodeEnv !== 'development') throw new AdminInputError('NODE_ENV', 'development_only', 'Recuperação exclusiva de desenvolvimento.');
  if (scope.database !== 'db_credi_dev') throw new AdminInputError('DB_NAME', 'local_database_only', 'Banco não permitido.');
  if (!['127.0.0.1', 'localhost', '::1'].includes(scope.host)) {
    throw new AdminInputError('DB_HOST', 'local_host_only', 'Host não permitido.');
  }
}

export async function assertAdminRecoveryTarget(db: Queryable): Promise<void> {
  const target = (await db.query<{ banco: string; endereco: string | null }>(RECOVERY_TARGET_SQL)).rows[0];
  if (target?.banco !== 'db_credi_dev'
    || !target.endereco || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(target.endereco)) {
    throw new AdminInputError('banco', 'invalid_recovery_target', 'Conexão não permitida.');
  }
}

export async function findRecoveryAdmin(db: Queryable, email: string) {
  const user = await usersRepository.byEmail(db, email);
  if (!user) throw new AdminInputError('email', 'admin_not_found', 'Conta não encontrada.');
  if (user.papel !== 'admin') throw new AdminInputError('administrador', 'admin_required', 'Conta não é administrativa.');
  return publicUser(user);
}

const recoverySchema = z.object({ id: idSchema, email: emailSchema, senha: passwordSchema }).strict();

// Exclusivo do CLI local. Não é chamado por routes/controllers HTTP.
export async function recoverAdminPassword(db: Database, scope: AdminRecoveryScope,
  input: { id: string; email: string; senha: string }, confirmed: boolean): Promise<void> {
  assertAdminRecoveryScope(scope);
  if (confirmed !== true) throw new AdminInputError('confirmacao', 'confirmation_required', 'Confirmação necessária.');
  const data = recoverySchema.parse(input);
  const hash = await hashPassword(data.senha);
  await transaction(db, async client => {
    // Revalida o destino na conexão exata que fará as escritas.
    assertAdminRecoveryScope(scope);
    await assertAdminRecoveryTarget(client);
    await client.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
    const current = await usersRepository.byId(client, data.id);
    if (!current || current.papel !== 'admin' || current.email.toLowerCase() !== data.email) {
      throw new AdminInputError('administrador', 'recovery_account_changed', 'Conta alterada durante o procedimento.');
    }
    await usersRepository.password(client, current.id, hash, true);
    await authRepository.revokeUser(client, current.id);
    await audit(client, current, 'UPDATE', current.id,
      'Recuperou a credencial administrativa por CLI local de desenvolvimento, revogou sessões e exigiu troca de senha.');
  });
}
