import { Router } from 'express';
import { ContempladosClient } from './contemplados.client.js';
import { ContempladosController } from './contemplados.controller.js';
import { ContempladosService } from './contemplados.service.js';

export function contempladosRoutes(client = new ContempladosClient()): Router {
  const router = Router();
  const controller = new ContempladosController(new ContempladosService(client));
  router.get('/', controller.list);
  return router;
}
