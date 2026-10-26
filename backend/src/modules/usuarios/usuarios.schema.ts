import { z } from 'zod';
import { currentPasswordSchema, emailSchema, nomeSchema, passwordSchema } from '../../shared/validation.js';

export const createUserSchema = z.object({ nome: nomeSchema, email: emailSchema, senha: passwordSchema }).strict();
export const updateUserSchema = z.object({
  nome: nomeSchema.optional(), email: emailSchema.optional(),
  papel: z.enum(['admin', 'vendedor']).optional(), senha_admin: currentPasswordSchema.optional(),
}).strict().refine(data => data.nome !== undefined || data.email !== undefined || data.papel !== undefined);
export const statusSchema = z.object({ ativo: z.boolean(), senha_admin: currentPasswordSchema }).strict();
export const resetPasswordSchema = z.object({ nova_senha: passwordSchema, senha_admin: currentPasswordSchema }).strict();
export const reauthenticateSchema = z.object({ senha_admin: currentPasswordSchema }).strict();
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
}).strict();
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
