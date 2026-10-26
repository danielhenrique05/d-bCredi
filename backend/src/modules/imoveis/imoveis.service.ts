import type { Database, DatabaseClient } from '../../database/transaction.js';
import { audit } from '../../shared/audit.js';
import { authorizedTransaction } from '../../shared/authorized-transaction.js';
import { forbidden, HttpError } from '../../shared/http-error.js';
import type { AuthContext } from '../auth/auth.repository.js';
import type { Usuario } from '../usuarios/usuarios.repository.js';
import { imoveisRepository, publicImovel } from './imoveis.repository.js';
import type { CreateImovelInput, ListImoveisInput, UpdateImovelInput } from './imoveis.schema.js';

const notFound = () => new HttpError(404, 'Imóvel não encontrado.');

export class ImoveisService {
  constructor(private readonly db: Database) {}

  private run<T>(context: AuthContext, work: (db: DatabaseClient, actor: Usuario) => Promise<T>) {
    return authorizedTransaction(this.db, context, (db, current) => {
      if (current.user.troca_senha_obrigatoria || !['admin', 'vendedor'].includes(current.user.papel)) throw forbidden();
      return work(db, current.user);
    });
  }

  list(input: ListImoveisInput) { return imoveisRepository.list(this.db, input); }

  async get(id: string) {
    const row = await imoveisRepository.byId(this.db, id);
    if (!row) throw notFound();
    return publicImovel(row);
  }

  managed(context: AuthContext, input: ListImoveisInput) {
    return this.run(context, (db, actor) => imoveisRepository.list(db, input, true, actor.papel === 'admin' ? undefined : actor.id));
  }

  create(context: AuthContext, input: CreateImovelInput) {
    return this.run(context, async (db, actor) => {
      const row = await imoveisRepository.create(db, input, actor.id);
      await audit(db, actor, 'CREATE', row.id, `Criou o imóvel "${row.titulo.slice(0, 160)}".`, 'imovel');
      return publicImovel(row);
    });
  }

  update(context: AuthContext, id: string, input: UpdateImovelInput) {
    return this.run(context, async (db, actor) => {
      const before = await imoveisRepository.byId(db, id, true);
      if (!before || (actor.papel !== 'admin' && before.user_id !== actor.id)) throw notFound();
      const row = await imoveisRepository.update(db, id, input);
      if (!row) return publicImovel(before);
      await audit(db, actor, 'UPDATE', id, `Editou o imóvel "${row.titulo.slice(0, 160)}".`, 'imovel');
      return publicImovel(row);
    });
  }

  delete(context: AuthContext, id: string) {
    return this.run(context, async (db, actor) => {
      const row = await imoveisRepository.byId(db, id, true);
      if (!row || (actor.papel !== 'admin' && row.user_id !== actor.id)) throw notFound();
      await imoveisRepository.delete(db, id);
      await audit(db, actor, 'DELETE', id, `Excluiu o imóvel "${row.titulo.slice(0, 160)}".`, 'imovel');
    });
  }
}
