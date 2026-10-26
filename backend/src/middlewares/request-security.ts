import type { RequestHandler } from 'express';
import { authConfig } from '../config/auth.js';
import { forbidden, HttpError } from '../shared/http-error.js';
import { csrfToken, equalToken, readToken } from '../shared/session.js';

export const originPolicy: RequestHandler = (request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.vary('Origin');
  const origin = request.get('Origin');
  if (origin && !authConfig.allowedOrigins.has(origin)) { next(forbidden()); return; }
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (request.method === 'OPTIONS') {
    if (!origin) { next(forbidden()); return; }
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    response.status(204).end(); return;
  }
  next();
};

export const requireCsrf: RequestHandler = (request, _response, next) => {
  const origin = request.get('Origin');
  if (!origin || !authConfig.allowedOrigins.has(origin)) { next(forbidden()); return; }
  if (!request.is('application/json')) { next(new HttpError(400, 'Envie um corpo JSON.')); return; }
  const token = readToken(request, authConfig.sessionCookie) ?? readToken(request, authConfig.csrfCookie);
  const supplied = request.get('X-CSRF-Token');
  if (!token || !supplied || !/^[A-Za-z0-9_-]{43}$/.test(supplied) || !equalToken(csrfToken(token), supplied)) {
    next(forbidden()); return;
  }
  next();
};
