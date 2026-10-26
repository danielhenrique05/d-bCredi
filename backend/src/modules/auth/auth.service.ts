import type { Database } from '../../database/transaction.js';
import { transaction } from '../../database/transaction.js';
import { authConfig } from '../../config/auth.js';
import { audit } from '../../shared/audit.js';
import { authorizedTransaction } from '../../shared/authorized-transaction.js';
import { HttpError, unauthorized } from '../../shared/http-error.js';
import { hashPassword, verifyPassword } from '../../shared/password.js';
import { digestToken, newToken } from '../../shared/session.js';
import { usersRepository, publicUser } from '../usuarios/usuarios.repository.js';
import { authRepository, type AuthContext } from './auth.repository.js';
import type { LoginInput, PasswordInput } from './auth.schema.js';

export class AuthService {
  constructor(private readonly db: Database) {}

  async limitLogin(ip: string, email?: string): Promise<void> {
    const limited = await transaction(this.db, async client => {
      if (await authRepository.rateBucket(client, digestToken(`ip:${ip}`), authConfig.rateWindowSeconds, authConfig.rateIpLimit)) return true;
      return email ? authRepository.rateBucket(client, digestToken(`account:${email}`), authConfig.rateWindowSeconds, authConfig.rateAccountLimit) : false;
    });
    if (limited) throw new HttpError(429, 'Muitas tentativas. Aguarde antes de tentar novamente.');
  }

  async login(input: LoginInput): Promise<{ user: ReturnType<typeof publicUser>; token: string }> {
    const candidate = await usersRepository.byEmail(this.db, input.email);
    const valid = await verifyPassword(candidate?.senha_hash, input.senha);
    if (!valid || !candidate?.ativo) throw new HttpError(401, 'E-mail ou senha inválidos.');
    return transaction(this.db, async client => {
      await client.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
      const current = await usersRepository.credentialsById(client, candidate.id);
      if (!current?.ativo || current.senha_hash !== candidate.senha_hash || current.email.toLowerCase() !== input.email) {
        throw new HttpError(401, 'E-mail ou senha inválidos.');
      }
      const token = newToken();
      await authRepository.create(client, current.id, digestToken(token), authConfig.sessionSeconds);
      return { user: publicUser(current), token };
    });
  }

  async logout(context: AuthContext): Promise<void> {
    await authorizedTransaction(this.db, context, async client => { await authRepository.revoke(client, context.sessionId); });
  }

  async changePassword(context: AuthContext, input: PasswordInput): Promise<void> {
    const hash = await hashPassword(input.nova_senha);
    await authorizedTransaction(this.db, context, async (client, current) => {
      const user = await usersRepository.credentialsById(client, current.user.id);
      if (!user || !await verifyPassword(user.senha_hash, input.senha_atual)) {
        throw new HttpError(401, 'Senha atual inválida.');
      }
      if (input.senha_atual === input.nova_senha) throw new HttpError(400, 'Escolha uma senha diferente da atual.');
      await usersRepository.password(client, user.id, hash);
      await authRepository.revokeUser(client, user.id);
      await audit(client, current.user, 'UPDATE', user.id, 'Alterou a própria senha e revogou as sessões.');
    });
  }

  async profile(context: AuthContext, nome: string) {
    return authorizedTransaction(this.db, context, async (client, current) => {
      if (current.user.troca_senha_obrigatoria) throw new HttpError(403, 'Altere a senha antes de continuar.');
      const user = await usersRepository.update(client, current.user.id, { ...current.user, nome });
      await audit(client, current.user, 'UPDATE', user.id, 'Atualizou o próprio nome.');
      return publicUser(user);
    });
  }

  async me(context: AuthContext) {
    const current = await authRepository.current(this.db, context.sessionId);
    if (!current) throw unauthorized();
    return publicUser(current.user);
  }
}
