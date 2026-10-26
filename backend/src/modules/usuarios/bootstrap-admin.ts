import { transaction, type Database } from '../../database/transaction.js';
import { audit } from '../../shared/audit.js';
import { HttpError } from '../../shared/http-error.js';
import { hashPassword } from '../../shared/password.js';
import { createUserSchema } from './usuarios.schema.js';
import { usersRepository, publicUser } from './usuarios.repository.js';

export async function bootstrapAdmin(database: Database, input: unknown) {
  const data = createUserSchema.parse(input);
  const hash = await hashPassword(data.senha);
  return transaction(database, async client => {
    await client.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
    if (await usersRepository.adminCount(client, false) > 0) {
      throw new HttpError(409, 'Já existe administrador. Use o gerenciamento autenticado de usuários.');
    }
    if (await usersRepository.byEmail(client, data.email)) throw new HttpError(409, 'Já existe conta com esse e-mail.');
    const user = await usersRepository.create(client, { ...data, hash, papel: 'admin', forceChange: false });
    await audit(client, user, 'CREATE', user.id, 'Criou o administrador inicial por execução explícita do CLI.');
    return publicUser(user);
  });
}
