import type { RequestHandler, Response } from 'express';
import type { Database } from '../database/transaction.js';
import { authConfig } from '../config/auth.js';
import { authRepository, type AuthContext } from '../modules/auth/auth.repository.js';
import { unauthorized } from '../shared/http-error.js';
import { digestToken, readToken } from '../shared/session.js';

export function authenticated(response: Response): AuthContext {
  const context = response.locals.auth as AuthContext | undefined;
  if (!context) throw unauthorized();
  return context;
}
export const authenticate = (db: Database): RequestHandler => async (request, response, next) => {
  const token = readToken(request, authConfig.sessionCookie);
  if (!token) throw unauthorized();
  const context = await authRepository.session(db, digestToken(token));
  if (!context) throw unauthorized();
  response.locals.auth = context;
  next();
};
