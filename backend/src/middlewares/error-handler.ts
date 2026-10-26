import type { ErrorRequestHandler } from 'express';
import { logDevelopmentError } from '../shared/logger.js';
import { ZodError } from 'zod';
import { HttpError } from '../shared/http-error.js';
import { authConfig } from '../config/auth.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({ status: 'error', message: 'Dados inválidos.' });
    return;
  }
  if (error instanceof HttpError) {
    if (error.status === 429) response.setHeader('Retry-After', String(authConfig.rateWindowSeconds));
    response.status(error.status).json({ status: 'error', message: error.message });
    return;
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    response.status(409).json({ status: 'error', message: 'Cadastro em conflito com um registro existente.' });
    return;
  }
  if (typeof error === 'object' && error !== null && 'code' in error && (error.code === '23503' || error.code === '23001')) {
    response.status(409).json({ status: 'error', message: 'Operação em conflito com um registro relacionado.' });
    return;
  }
  logDevelopmentError('Erro ao processar requisição.', error);
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined;
  const clientError = typeof status === 'number' && Number.isInteger(status)
    && status >= 400 && status < 500;

  response.status(clientError ? status : 500).json({
    status: 'error',
    message: clientError ? 'Requisição inválida.' : 'Erro interno do servidor.',
  });
};
