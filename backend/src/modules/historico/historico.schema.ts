import { z } from 'zod';
import { idSchema } from '../../shared/validation.js';

const integerQuery = (min: number, max: number) => z.string().max(7).regex(/^\d+$/)
  .transform(Number).pipe(z.number().int().min(min).max(max));

// UTC normalizado em milissegundos, como o serviço React atual. Rejeitar maior
// precisão evita truncar silenciosamente limites de período no Date do Node.
const timestamp = z.string().max(35).datetime({ offset: true }).refine(value => {
  const date = new Date(value);
  return !/\.\d{4}/.test(value) && Number.isFinite(date.getTime())
    && date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999;
}).transform(value => new Date(value).toISOString());

export const historicoIdSchema = z.string().max(19).regex(/^[1-9]\d*$/)
  .pipe(z.string().refine(value => BigInt(value) <= 9223372036854775807n));

export const historicoDetailQuerySchema = z.object({}).strict();

export const listHistoricoSchema = z.object({
  limit: integerQuery(1, 100).default(50),
  offset: integerQuery(0, 1000000).default(0),
  acao: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
  entidade: z.enum(['usuario', 'imovel']).optional(),
  usuario_id: idSchema.optional(),
  // A coluna é TEXT, não UUID: preserva também identificadores legados.
  entidade_id: z.string().min(1).max(256).refine(value => value.trim().length > 0 && !/[\p{Cc}\p{Cf}]/u.test(value)).optional(),
  data_inicio: timestamp.optional(),
  data_fim: timestamp.optional(),
}).strict().refine(input => input.data_inicio === undefined || input.data_fim === undefined
  || Date.parse(input.data_inicio) <= Date.parse(input.data_fim));

export type ListHistoricoInput = z.infer<typeof listHistoricoSchema>;
