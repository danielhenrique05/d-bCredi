import express from 'express';
import { errorHandler } from './middlewares/error-handler.js';
import { healthRouter } from './modules/health/health.routes.js';
import { pool } from './database/pool.js';
import type { Database } from './database/transaction.js';
import { authConfig } from './config/auth.js';
import { originPolicy } from './middlewares/request-security.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/usuarios/usuarios.routes.js';
import { imoveisRoutes } from './modules/imoveis/imoveis.routes.js';

export function createApp(database: Database = pool) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', authConfig.trustProxyHops);
  app.use(['/api/auth', '/api/usuarios', '/api/imoveis'], originPolicy);
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRoutes(database));
  app.use('/api/usuarios', usersRoutes(database));
  app.use('/api/imoveis', imoveisRoutes(database));
  app.use((_request, response) => {
    response.status(404).json({ status: 'error', message: 'Rota não encontrada.' });
  });
  app.use(errorHandler);
  return app;
}

export const app = createApp();
