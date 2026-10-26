import { z } from 'zod';
import { currentPasswordSchema, emailSchema, nomeSchema, passwordSchema } from '../../shared/validation.js';

export const loginSchema = z.object({ email: emailSchema, senha: currentPasswordSchema }).strict();
export const changePasswordSchema = z.object({ senha_atual: currentPasswordSchema, nova_senha: passwordSchema }).strict();
export const profileSchema = z.object({ nome: nomeSchema }).strict();
export const emptySchema = z.object({}).strict();
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordInput = z.infer<typeof changePasswordSchema>;
