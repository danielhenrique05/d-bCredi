import { parseArgs } from 'node:util';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { Readable } from 'node:stream';
import type { Database } from '../database/transaction.js';
import { bootstrapAdmin } from '../modules/usuarios/bootstrap-admin.js';
import { createUserSchema } from '../modules/usuarios/usuarios.schema.js';
import { hiddenPassword } from '../shared/hidden-input.js';
import { AdminInputError } from './admin-errors.js';

export interface AdminInput {
  isTTY: boolean;
  identity(values: { nome?: string; email?: string }): Promise<{ nome?: string; email?: string }>;
  password(prompt: string): Promise<string>;
  stdinPassword(): Promise<string>;
}

export async function readStdinPassword(input: Readable): Promise<string> {
  input.setEncoding('utf8');
  let password = '';
  for await (const chunk of input) {
    password += String(chunk);
    if (Buffer.byteLength(password, 'utf8') > 4096) throw new AdminInputError('senha', 'input_too_large', 'Entrada excede o limite.');
  }
  // Remove apenas uma quebra de linha do transporte, preservando a senha.
  return password.replace(/\r?\n$/, '');
}

export const terminalAdminInput: AdminInput = {
  isTTY: Boolean(stdin.isTTY),
  async identity(values) {
    const terminal = createInterface({ input: stdin, output: stdout });
    try {
      return {
        nome: values.nome ?? await terminal.question('Nome: '),
        email: values.email ?? await terminal.question('E-mail: '),
      };
    } finally { terminal.close(); }
  },
  password: hiddenPassword,
  stdinPassword: () => readStdinPassword(stdin),
};

export async function runAdminCreate(args: string[], input: AdminInput, loadDatabase: () => Promise<Database>): Promise<void> {
  let options;
  try {
    options = parseArgs({ args, strict: true, allowPositionals: false, options: {
      nome: { type: 'string' }, email: { type: 'string' }, 'password-stdin': { type: 'boolean', default: false },
    } }).values;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    const safeCode = code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' ? 'unknown_option'
      : code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE' ? 'invalid_option_value'
        : code === 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL' ? 'unexpected_positional' : 'invalid_arguments';
    throw new AdminInputError('argumentos', safeCode, 'Argumentos inválidos.');
  }
  let identity: { nome?: string; email?: string } = { nome: options.nome, email: options.email };
  if ((!identity.nome || !identity.email) && input.isTTY) identity = await input.identity(identity);
  // Nome/e-mail inválidos não solicitam senha e não carregam o banco.
  const profile = createUserSchema.pick({ nome: true, email: true }).parse(identity);
  if (options['password-stdin'] && input.isTTY) throw new AdminInputError('password-stdin', 'invalid_mode', 'Entrada não interativa necessária.');
  if (!options['password-stdin'] && !input.isTTY) throw new AdminInputError('senha', 'interactive_terminal_required', 'Terminal interativo necessário.');
  const password = options['password-stdin'] ? await input.stdinPassword() : await input.password('Senha (entrada oculta): ');
  if (!options['password-stdin'] && password !== await input.password('Confirme a senha: ')) {
    throw new AdminInputError('confirmacao_senha', 'password_mismatch', 'As senhas não correspondem.');
  }
  const data = createUserSchema.parse({ ...profile, senha: password });
  await bootstrapAdmin(await loadDatabase(), data);
}
