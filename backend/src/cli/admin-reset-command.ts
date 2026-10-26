import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { createUserSchema } from '../modules/usuarios/usuarios.schema.js';
import { assertAdminRecoveryScope, assertAdminRecoveryTarget, findRecoveryAdmin, recoverAdminPassword,
  type AdminRecoveryScope } from './recover-admin-password.js';
import type { Database } from '../database/transaction.js';
import { hiddenPassword } from '../shared/hidden-input.js';
import { AdminInputError } from './admin-errors.js';

export interface AdminResetInput {
  isTTY: boolean;
  email(): Promise<string>;
  password(prompt: string): Promise<string>;
  confirmation(): Promise<string>;
}

async function question(prompt: string): Promise<string> {
  const terminal = createInterface({ input: stdin, output: stdout });
  try { return await terminal.question(prompt); } finally { terminal.close(); }
}

export const terminalAdminResetInput: AdminResetInput = {
  isTTY: Boolean(stdin.isTTY && stdout.isTTY),
  email: () => question('E-mail do administrador: '),
  password: hiddenPassword,
  confirmation: () => question('A senha será redefinida, todas as sessões serão revogadas e uma nova troca será exigida no login.\nDigite REDEFINIR para confirmar ou Enter para cancelar: '),
};

export async function runAdminReset(args: string[], input: AdminResetInput, scope: AdminRecoveryScope,
  loadDatabase: () => Promise<Database>): Promise<void> {
  assertAdminRecoveryScope(scope);
  if (args.length) throw new AdminInputError('argumentos', 'recovery_arguments_not_allowed', 'Este comando não aceita argumentos.');
  if (!input.isTTY) throw new AdminInputError('entrada', 'recovery_interactive_only', 'Terminal interativo necessário.');
  const { email } = createUserSchema.pick({ email: true }).parse({ email: await input.email() });
  const db = await loadDatabase();
  await assertAdminRecoveryTarget(db);
  const admin = await findRecoveryAdmin(db, email);
  const senha = await input.password('Nova senha (entrada oculta): ');
  const confirmation = await input.password('Confirme a nova senha: ');
  if (senha !== confirmation) throw new AdminInputError('confirmacao_senha', 'password_mismatch', 'As senhas não correspondem.');
  createUserSchema.pick({ senha: true }).parse({ senha });
  if ((await input.confirmation()).trim() !== 'REDEFINIR') {
    throw new AdminInputError('confirmacao', 'confirmation_required', 'Operação não confirmada.');
  }
  await recoverAdminPassword(db, scope, { id: admin.id, email, senha }, true);
}
