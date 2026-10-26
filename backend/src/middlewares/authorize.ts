import type { RequestHandler } from 'express';
import { authenticated } from './authenticate.js';
import { forbidden } from '../shared/http-error.js';

export const requireAdmin: RequestHandler = (_request, response, next) => {
  if (authenticated(response).user.papel !== 'admin') throw forbidden();
  next();
};
