import { Router } from 'express';
import type { Database } from '../../database/transaction.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireCsrf } from '../../middlewares/request-security.js';
import { emailSchema } from '../../shared/validation.js';
import { issueCsrf } from '../../shared/session.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

export function authRoutes(db: Database): Router {
  const router = Router();
  const service = new AuthService(db);
  const controller = new AuthController(service);
  router.get('/csrf', issueCsrf);
  router.post('/login', requireCsrf, async (request, _response, next) => {
    // A origem já foi validada; inclusive corpos inválidos consomem limite por IP.
    const parsed = emailSchema.safeParse(request.body?.email);
    await service.limitLogin(request.ip ?? 'unknown', parsed.success ? parsed.data : undefined);
    next();
  }, controller.login);
  router.use(authenticate(db));
  router.get('/me', controller.me);
  router.patch('/me', requireCsrf, controller.profile);
  router.post('/logout', requireCsrf, controller.logout);
  router.post('/change-password', requireCsrf, controller.changePassword);
  return router;
}
