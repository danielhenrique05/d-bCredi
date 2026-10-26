import type { Request, Response } from 'express';
import { authenticated } from '../../middlewares/authenticate.js';
import { idSchema } from '../../shared/validation.js';
import { createImovelSchema, deleteImovelSchema, listImoveisSchema, updateImovelSchema } from './imoveis.schema.js';
import { ImoveisService } from './imoveis.service.js';

export class ImoveisController {
  constructor(private readonly service: ImoveisService) {}
  list = async (request: Request, response: Response): Promise<void> => {
    const input = listImoveisSchema.parse(request.query);
    response.json({ imoveis: await this.service.list(input), limit: input.limit, offset: input.offset });
  };
  managed = async (request: Request, response: Response): Promise<void> => {
    const input = listImoveisSchema.parse(request.query);
    response.json({ imoveis: await this.service.managed(authenticated(response), input), limit: input.limit, offset: input.offset });
  };
  get = async (request: Request, response: Response): Promise<void> => {
    response.json({ imovel: await this.service.get(idSchema.parse(request.params.id)) });
  };
  create = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json({ imovel: await this.service.create(authenticated(response), createImovelSchema.parse(request.body)) });
  };
  update = async (request: Request, response: Response): Promise<void> => {
    response.json({ imovel: await this.service.update(authenticated(response), idSchema.parse(request.params.id), updateImovelSchema.parse(request.body)) });
  };
  delete = async (request: Request, response: Response): Promise<void> => {
    deleteImovelSchema.parse(request.body);
    await this.service.delete(authenticated(response), idSchema.parse(request.params.id));
    response.status(204).end();
  };
}
