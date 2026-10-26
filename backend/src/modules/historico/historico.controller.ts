import type { Request, Response } from 'express';
import { authenticated } from '../../middlewares/authenticate.js';
import { historicoDetailQuerySchema, historicoIdSchema, listHistoricoSchema } from './historico.schema.js';
import { HistoricoService } from './historico.service.js';

export class HistoricoController {
  constructor(private readonly service: HistoricoService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.list(authenticated(response), listHistoricoSchema.parse(request.query)));
  };
  get = async (request: Request, response: Response): Promise<void> => {
    // A consulta pontual também recusa parâmetros desconhecidos.
    historicoDetailQuerySchema.parse(request.query);
    response.json({ registro: await this.service.get(authenticated(response), historicoIdSchema.parse(request.params.id)) });
  };
}
