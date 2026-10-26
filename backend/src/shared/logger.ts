import { env } from '../config/env.js';

export function logDevelopmentError(context: string, error: unknown): void {
  if (env.nodeEnv !== 'development') return;

  // Não serializa configuração, mensagens do banco ou credenciais.
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
  const reason = error instanceof Error && /password|SASL|authentication/i.test(error.message)
    ? 'Falha de autenticação: confira DB_USER e DB_PASSWORD.'
    : error instanceof Error && /timeout/i.test(error.message)
      ? 'Tempo limite de conexão ou consulta excedido.'
      : undefined;
  console.error(context, {
    name: error instanceof Error ? error.name : 'UnknownError',
    code,
    reason,
  });
}
