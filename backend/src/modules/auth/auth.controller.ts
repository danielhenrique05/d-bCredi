import type { Request, Response } from 'express';
import { authenticated } from '../../middlewares/authenticate.js';
import { clearSessionCookie, csrfToken, setSessionCookie } from '../../shared/session.js';
import { AuthService } from './auth.service.js';
import { changePasswordSchema, emptySchema, loginSchema, profileSchema } from './auth.schema.js';

export class AuthController {
  constructor(private readonly service: AuthService) {}
  login = async (request: Request, response: Response): Promise<void> => {
    const input = loginSchema.parse(request.body);
    const result = await this.service.login(input);
    setSessionCookie(response, result.token);
    response.json({ usuario: result.user, csrfToken: csrfToken(result.token) });
  };
  logout = async (request: Request, response: Response): Promise<void> => {
    emptySchema.parse(request.body);
    await this.service.logout(authenticated(response));
    clearSessionCookie(response);
    response.json({ message: 'Sessão encerrada.' });
  };
  me = async (_request: Request, response: Response): Promise<void> => {
    response.json({ usuario: await this.service.me(authenticated(response)) });
  };
  changePassword = async (request: Request, response: Response): Promise<void> => {
    await this.service.changePassword(authenticated(response), changePasswordSchema.parse(request.body));
    clearSessionCookie(response);
    response.json({ message: 'Senha alterada. Entre novamente.' });
  };
  profile = async (request: Request, response: Response): Promise<void> => {
    const input = profileSchema.parse(request.body);
    response.json({ usuario: await this.service.profile(authenticated(response), input.nome) });
  };
}
