import type { Database, DatabaseClient } from '../../database/transaction.js';
import { authorizedTransaction } from '../../shared/authorized-transaction.js';
import { forbidden, HttpError } from '../../shared/http-error.js';
import type { AuthContext } from '../auth/auth.repository.js';
import { historicoRepository } from './historico.repository.js';
import type { ListHistoricoInput } from './historico.schema.js';

export class HistoricoService {
  constructor(private readonly db: Database) {}

  private run<T>(context: AuthContext, work: (db: DatabaseClient) => Promise<T>): Promise<T> {
    return authorizedTransaction(this.db, context, (db, current) => {
      if (current.user.troca_senha_obrigatoria) throw forbidden();
      return work(db);
    }, true);
  }

  list(context: AuthContext, input: ListHistoricoInput) {
    return this.run(context, async db => {
      const rows = await historicoRepository.list(db, input);
      return { registros: rows.slice(0, input.limit), limit: input.limit, offset: input.offset, temMais: rows.length > input.limit };
    });
  }

  get(context: AuthContext, id: string) {
    return this.run(context, async db => {
      const row = await historicoRepository.byId(db, id);
      if (!row) throw new HttpError(404, 'Registro de histórico não encontrado.');
      return row;
    });
  }
}
