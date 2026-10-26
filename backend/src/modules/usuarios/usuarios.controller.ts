import type { Request, Response } from 'express';
import { authenticated } from '../../middlewares/authenticate.js';
import { idSchema } from '../../shared/validation.js';
import { UsersService } from './usuarios.service.js';
import { createUserSchema, paginationSchema, reauthenticateSchema, resetPasswordSchema, statusSchema, updateUserSchema } from './usuarios.schema.js';

export class UsersController {
  constructor(private readonly service: UsersService) {}
  list = async (request: Request, response: Response): Promise<void> => {
    const { limit, offset } = paginationSchema.parse(request.query);
    response.json({ usuarios: await this.service.list(authenticated(response), limit, offset), limit, offset });
  };
  get = async (request: Request, response: Response): Promise<void> => {
    response.json({ usuario: await this.service.get(authenticated(response), idSchema.parse(request.params.id)) });
  };
  create = async (request: Request, response: Response): Promise<void> => {
    const user = await this.service.create(authenticated(response), createUserSchema.parse(request.body));
    response.status(201).json({ usuario: user });
  };
  update = async (request: Request, response: Response): Promise<void> => {
    response.json({ usuario: await this.service.update(authenticated(response), idSchema.parse(request.params.id), updateUserSchema.parse(request.body)) });
  };
  status = async (request: Request, response: Response): Promise<void> => {
    const input = statusSchema.parse(request.body);
    response.json({ usuario: await this.service.status(authenticated(response), idSchema.parse(request.params.id), input.ativo, input.senha_admin) });
  };
  resetPassword = async (request: Request, response: Response): Promise<void> => {
    const input = resetPasswordSchema.parse(request.body);
    await this.service.resetPassword(authenticated(response), idSchema.parse(request.params.id), input.senha_admin, input.nova_senha);
    response.json({ message: 'Credencial redefinida. A conta deverá alterar a senha ao entrar.' });
  };
  revokeSessions = async (request: Request, response: Response): Promise<void> => {
    const input = reauthenticateSchema.parse(request.body);
    await this.service.revokeSessions(authenticated(response), idSchema.parse(request.params.id), input.senha_admin);
    response.json({ message: 'Sessões revogadas.' });
  };
}
