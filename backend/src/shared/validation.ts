import { z } from 'zod';

export const nomeSchema = z.string().trim().min(2).max(120).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value));
export const emailSchema = z.string().trim().max(254).email().transform(value => value.toLowerCase());
export const passwordSchema = z.string().min(8).max(128)
  .refine(value => !/^\s+$/.test(value) && !value.includes('\0'), 'Senha inválida.');
export const currentPasswordSchema = z.string().min(1).max(128).refine(value => !value.includes('\0'));
export const idSchema = z.string().uuid();
