import { ZodError } from 'zod';
import { EnvironmentError } from '../config/env-validation.js';
import { HttpError } from '../shared/http-error.js';

export class AdminInputError extends Error {
  constructor(public readonly field: string, public readonly code: string, message: string) {
    super(message);
    this.name = 'AdminInputError';
  }
}

const fields = new Set(['nome', 'email', 'senha', 'confirmacao_senha', 'argumentos', 'password-stdin',
  'NODE_ENV', 'PORT', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'banco', 'administrador', 'confirmacao', 'entrada']);
const codes = new Set(['invalid_type', 'too_small', 'too_big', 'invalid_format', 'custom', 'unrecognized_keys',
  'missing_variable', 'invalid_port', 'invalid_environment', 'unknown_option', 'invalid_option_value',
  'unexpected_positional', 'invalid_arguments', 'invalid_mode', 'interactive_terminal_required',
  'password_mismatch', 'input_too_large', 'development_only', 'local_database_only', 'local_host_only',
  'invalid_recovery_target', 'admin_not_found', 'admin_required', 'confirmation_required',
  'recovery_account_changed', 'recovery_interactive_only', 'recovery_arguments_not_allowed']);

function line(field: string, code: string, message: string): string {
  return `- ${field} [${code}]: ${message}`;
}

function validationMessage(field: string, code: string): string {
  if (code === 'invalid_type') return 'Informe este campo no formato esperado.';
  if (field === 'nome') return code === 'custom' ? 'O nome não pode conter caracteres de controle.' : 'O nome deve ter de 2 a 120 caracteres.';
  if (field === 'email') return code === 'too_big' ? 'O e-mail deve ter até 254 caracteres.' : 'Informe um e-mail válido.';
  if (field === 'senha') return code === 'custom'
    ? 'A senha não pode ser apenas espaços nem conter caractere NUL.'
    : 'A senha deve ter de 8 a 128 caracteres.';
  return 'Confira os campos obrigatórios e remova opções não reconhecidas.';
}

// Não usa issue.message, error.message, issue.input, argv ou objetos de erros brutos.
// Mesmo mensagens customizadas do Zod podem conter a entrada original.
export function formatAdminError(error: unknown, heading = 'Administrador não criado.'): string[] {
  const lines = [heading];
  if (error instanceof ZodError) {
    for (const issue of error.issues) {
      const first = issue.path[0];
      const field = typeof first === 'string' && fields.has(first) ? first : 'entrada';
      const code = codes.has(issue.code) ? issue.code : 'invalid_input';
      lines.push(line(field, code, validationMessage(field, code)));
    }
    return lines;
  }
  if (error instanceof EnvironmentError) {
    const field = fields.has(error.field) ? error.field : 'ambiente';
    const code = codes.has(error.code) ? error.code : 'invalid_configuration';
    const message = code === 'missing_variable' ? 'Defina esta variável em backend/.env ou no ambiente do processo.'
      : code === 'invalid_port' ? 'Informe uma porta inteira entre 1 e 65535.'
        : 'Use development, test ou production.';
    return [...lines, line(field, code, message)];
  }
  if (error instanceof AdminInputError) {
    const messages: Record<string, string> = {
      unknown_option: 'Opção desconhecida. Use --nome, --email e --password-stdin; senhas não são argumentos.',
      invalid_option_value: 'Forneça um valor para a opção. Coloque nomes com espaços entre aspas.',
      unexpected_positional: 'Não use argumentos posicionais. No PowerShell, use npm.cmd para preservar as flags.',
      invalid_arguments: 'Use --nome, --email e --password-stdin para entrada não interativa.',
      invalid_mode: '--password-stdin exige entrada não interativa.',
      interactive_terminal_required: 'Use terminal interativo ou forneça a senha por uma fonte segura com --password-stdin.',
      password_mismatch: 'A confirmação não corresponde à senha.',
      input_too_large: 'A entrada de senha excede o limite permitido.',
      development_only: 'Recuperação permitida somente com NODE_ENV=development explícito.',
      local_database_only: 'Recuperação permitida somente no banco db_credi_dev.',
      local_host_only: 'Use PostgreSQL local em 127.0.0.1, localhost ou ::1.',
      invalid_recovery_target: 'O banco conectado deve ser db_credi_dev em um endereço de loopback local.',
      admin_not_found: 'Não foi encontrada uma conta com esse e-mail. Nenhuma conta foi alterada.',
      admin_required: 'A conta selecionada deve ter papel admin. Nenhuma conta foi alterada.',
      confirmation_required: 'Operação cancelada. Digite REDEFINIR para confirmar; nenhuma conta foi alterada.',
      recovery_account_changed: 'A conta selecionada mudou durante o procedimento. Reinicie a recuperação.',
      recovery_interactive_only: 'A recuperação exige um terminal interativo para e-mail, senha e confirmação.',
      recovery_arguments_not_allowed: 'Execute npm run admin:reset-password sem argumentos. Não há flags de senha ou confirmação automática.',
    };
    return [...lines, line(fields.has(error.field) ? error.field : 'entrada', codes.has(error.code) ? error.code : 'invalid_input',
      Object.hasOwn(messages, error.code) ? messages[error.code]! : 'Entrada inválida.')];
  }
  if (error instanceof HttpError && error.status === 409) {
    if (error.message === 'Já existe conta com esse e-mail.') {
      return [...lines, line('email', 'conflict', 'Já existe uma conta com esse e-mail; nenhuma conta foi promovida.')];
    }
    return [...lines, line('administrador', 'already_exists', 'Já existe administrador. Use o gerenciamento autenticado de usuários.')];
  }
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === '23505') return [...lines, line('email', 'conflict', 'Já existe uma conta com esse e-mail.')];
  if (code === '42P01' || code === '42703') {
    return [...lines, line('banco', code, 'Confira o esquema e aplique explicitamente a migration documentada antes de tentar novamente.')];
  }
  if (code === '28P01') return [...lines, line('banco', code, 'Confira DB_USER e DB_PASSWORD no ambiente local.')];
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') return [...lines, line('conexao', code, 'Confira o serviço PostgreSQL, DB_HOST e DB_PORT.')];
  return [...lines, line('procedimento', 'internal_error', 'Falha no procedimento administrativo. Confira a configuração local e a migration.')];
}
