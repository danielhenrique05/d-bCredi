import { Router } from 'express';
import { pool } from '../../database/pool.js';
import { logDevelopmentError } from '../../shared/logger.js';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  response.json({ status: 'ok', message: 'D&B Credi API funcionando!' });
});

healthRouter.get('/db', async (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const result = await pool.query<{ banco: string }>('SELECT current_database() AS banco;');
    const database = result.rows[0]?.banco;
    if (!database) throw new Error('Consulta de saúde sem identificação do banco.');

    response.json({ status: 'ok', database });
  } catch (error: unknown) {
    logDevelopmentError('Falha na verificação do PostgreSQL.', error);
    response.status(503).json({
      status: 'error',
      message: 'Não foi possível conectar ao banco de dados.',
    });
  }
});
