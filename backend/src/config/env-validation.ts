export class EnvironmentError extends Error {
  constructor(public readonly field: string, public readonly code: string, message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

// Mesmas regras de configuração, sem leitura de arquivos ou efeitos ao importar.
export function validateEnv(source: NodeJS.ProcessEnv) {
  function required(name: string, allowEmpty = false): string {
    const value = source[name];
    if (value === undefined || (!allowEmpty && value.trim() === '')) {
      throw new EnvironmentError(name, 'missing_variable', 'Defina esta variável em backend/.env ou no ambiente do processo.');
    }
    return value;
  }

  function port(name: string, fallback?: string): number {
    const value = source[name] ?? fallback ?? required(name);
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
      throw new EnvironmentError(name, 'invalid_port', 'Informe uma porta inteira entre 1 e 65535.');
    }
    return Number(value);
  }

  const nodeEnv = source.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new EnvironmentError('NODE_ENV', 'invalid_environment', 'Use development, test ou production.');
  }

  return {
    nodeEnv,
    port: port('PORT', '3000'),
    database: {
      host: required('DB_HOST'),
      port: port('DB_PORT'),
      user: required('DB_USER'),
      password: required('DB_PASSWORD', true),
      database: required('DB_NAME'),
    },
  };
}
