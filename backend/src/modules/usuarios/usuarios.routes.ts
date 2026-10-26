import { Router } from 'express';
import type { Database } from '../../database/transaction.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireAdmin } from '../../middlewares/authorize.js';
import { requireCsrf } from '../../middlewares/request-security.js';
import { UsersController } from './usuarios.controller.js';
import { UsersService } from './usuarios.service.js';

export function usersRoutes(db: Database): Router {
  const router = Router();
  const controller = new UsersController(new UsersService(db));
  router.use(authenticate(db), requireAdmin);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', requireCsrf, controller.create);
  router.patch('/:id', requireCsrf, controller.update);
  router.patch('/:id/status', requireCsrf, controller.status);
  router.post('/:id/reset-password', requireCsrf, controller.resetPassword);
  router.post('/:id/revoke-sessions', requireCsrf, controller.revokeSessions);
  return router;
}
