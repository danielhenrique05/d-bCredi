import { Router } from 'express';
import type { Database } from '../../database/transaction.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireAdmin } from '../../middlewares/authorize.js';
import { HistoricoController } from './historico.controller.js';
import { HistoricoService } from './historico.service.js';

export function historicoRoutes(db: Database): Router {
  const router = Router();
  const controller = new HistoricoController(new HistoricoService(db));
  router.use(authenticate(db), requireAdmin);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  return router;
}
