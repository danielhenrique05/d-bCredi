import { Router } from 'express';
import type { Database } from '../../database/transaction.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireCsrf } from '../../middlewares/request-security.js';
import { ImoveisController } from './imoveis.controller.js';
import { ImoveisService } from './imoveis.service.js';

export function imoveisRoutes(db: Database): Router {
  const router = Router();
  const controller = new ImoveisController(new ImoveisService(db));
  router.get('/', controller.list);
  router.get('/gestao', authenticate(db), controller.managed);
  router.get('/:id', controller.get);
  router.post('/', authenticate(db), requireCsrf, controller.create);
  router.patch('/:id', authenticate(db), requireCsrf, controller.update);
  router.delete('/:id', authenticate(db), requireCsrf, controller.delete);
  return router;
}
