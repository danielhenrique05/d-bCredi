import { HttpError } from '../../shared/http-error.js';
import { ContempladosClient } from './contemplados.client.js';
import { CONTEMPLADOS_MAX_ITEMS, contempladosSchema, type CartaContemplada } from './contemplados.schema.js';

export class ContempladosService {
  constructor(private readonly client: ContempladosClient) {}

  async list(): Promise<CartaContemplada[]> {
    const payload = await this.client.list();
    // Limita o trabalho de validação antes de percorrer os registros externos.
    if (!Array.isArray(payload) || payload.length > CONTEMPLADOS_MAX_ITEMS) throw this.invalidCatalog();
    const result = contempladosSchema.safeParse(payload);
    if (!result.success) throw this.invalidCatalog();
    return result.data;
  }

  private invalidCatalog(): HttpError {
    return new HttpError(502, 'O fornecedor retornou um catálogo de cartas inválido. Tente novamente mais tarde.');
  }
}
