import type { Database, Queryable } from '../../database/transaction.js';
import { authorizedTransaction } from '../../shared/authorized-transaction.js';
import { audit } from '../../shared/audit.js';
import { forbidden, HttpError } from '../../shared/http-error.js';
import { hashPassword, verifyPassword } from '../../shared/password.js';
import { authRepository, type AuthContext } from '../auth/auth.repository.js';
import { publicUser, usersRepository, type Usuario } from './usuarios.repository.js';
import type { CreateUserInput, UpdateUserInput } from './usuarios.schema.js';

async function adminPassword(db: Queryable, actor: Usuario, password: string | undefined): Promise<void> {
  if (!password) throw forbidden();
  const credentials = await usersRepository.credentialsById(db, actor.id);
  if (!await verifyPassword(credentials?.senha_hash, password)) throw forbidden();
}

async function preserveAdmin(db: Queryable, before: Usuario, after: Usuario): Promise<void> {
  if (before.ativo && before.papel === 'admin' && (!after.ativo || after.papel !== 'admin')
    && await usersRepository.adminCount(db) <= 1) {
    throw new HttpError(409, 'É necessário manter ao menos um administrador ativo.');
  }
}

export class UsersService {
  constructor(private readonly db: Database) {}

  private run<T>(context: AuthContext, work: (db: Queryable, actor: Usuario) => Promise<T>): Promise<T> {
    return authorizedTransaction(this.db, context, async (client, current) => {
      if (current.user.troca_senha_obrigatoria) throw forbidden();
      return work(client, current.user);
    }, true);
  }

  list(context: AuthContext, limit: number, offset: number) {
    return this.run(context, db => usersRepository.list(db, limit, offset));
  }

  get(context: AuthContext, id: string) {
    return this.run(context, async db => {
      const user = await usersRepository.byId(db, id);
      if (!user) throw new HttpError(404, 'Usuário não encontrado.');
      return publicUser(user);
    });
  }

  async create(context: AuthContext, input: CreateUserInput) {
    const hash = await hashPassword(input.senha);
    return this.run(context, async (db, actor) => {
      const user = await usersRepository.create(db, { ...input, hash, papel: 'vendedor', forceChange: true });
      await audit(db, actor, 'CREATE', user.id, 'Cadastrou uma conta de vendedor.');
      return publicUser(user);
    });
  }

  update(context: AuthContext, id: string, input: UpdateUserInput) {
    return this.run(context, async (db, actor) => {
      const before = await usersRepository.byId(db, id);
      if (!before) throw new HttpError(404, 'Usuário não encontrado.');
      if (input.papel !== undefined && input.papel !== before.papel) await adminPassword(db, actor, input.senha_admin);
      const after = { ...before, nome: input.nome ?? before.nome, email: input.email ?? before.email, papel: input.papel ?? before.papel };
      await preserveAdmin(db, before, after);
      const user = await usersRepository.update(db, id, after);
      if (before.papel !== after.papel || before.email !== after.email) await authRepository.revokeUser(db, id);
      await audit(db, actor, 'UPDATE', id, 'Atualizou os dados ou permissões da conta.');
      return publicUser(user);
    });
  }

  status(context: AuthContext, id: string, ativo: boolean, password: string) {
    return this.run(context, async (db, actor) => {
      await adminPassword(db, actor, password);
      const before = await usersRepository.byId(db, id);
      if (!before) throw new HttpError(404, 'Usuário não encontrado.');
      const after = { ...before, ativo };
      await preserveAdmin(db, before, after);
      const user = await usersRepository.update(db, id, after);
      if (!ativo) await authRepository.revokeUser(db, id);
      await audit(db, actor, 'UPDATE', id, ativo ? 'Ativou a conta.' : 'Desativou a conta e revogou as sessões.');
      return publicUser(user);
    });
  }

  async resetPassword(context: AuthContext, id: string, password: string, newPassword: string): Promise<void> {
    const hash = await hashPassword(newPassword);
    await this.run(context, async (db, actor) => {
      await adminPassword(db, actor, password);
      if (actor.id === id) throw new HttpError(409, 'Use a alteração da própria senha.');
      const target = await usersRepository.byId(db, id);
      if (!target) throw new HttpError(404, 'Usuário não encontrado.');
      await usersRepository.password(db, id, hash, true);
      await authRepository.revokeUser(db, id);
      await audit(db, actor, 'UPDATE', id, 'Redefiniu a credencial, exigiu troca de senha e revogou as sessões.');
    });
  }

  async revokeSessions(context: AuthContext, id: string, password: string): Promise<void> {
    await this.run(context, async (db, actor) => {
      await adminPassword(db, actor, password);
      if (!await usersRepository.byId(db, id)) throw new HttpError(404, 'Usuário não encontrado.');
      await authRepository.revokeUser(db, id);
      await audit(db, actor, 'UPDATE', id, 'Revogou todas as sessões da conta.');
    });
  }
}
