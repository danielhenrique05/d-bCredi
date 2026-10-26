import type { Request, Response } from 'express';
import { contempladosQuerySchema } from './contemplados.schema.js';
import { ContempladosService } from './contemplados.service.js';

export class ContempladosController {
  constructor(private readonly service: ContempladosService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    contempladosQuerySchema.parse(request.query);
    response.json(await this.service.list());
  };
}
