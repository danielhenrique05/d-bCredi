import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max)
  .refine(value => !/[\p{Cc}\p{Cf}]/u.test(value));

// Frações entram como texto decimal: nunca arredondar dinheiro via ponto flutuante.
// Números JSON são aceitos somente se inteiros seguros; ambos viram texto SQL.
export const decimalSchema = z.union([z.string().trim(), z.number().refine(Number.isSafeInteger).transform(String)])
  .pipe(z.string().max(18).regex(/^(0|[1-9]\d{0,14})(?:\.\d{1,2})?$/))
  .transform(value => {
    const [whole, fraction = ''] = value.split('.');
    return `${whole}.${fraction.padEnd(2, '0')}`;
  });
const positiveDecimal = decimalSchema.refine(value => BigInt(value.replace('.', '')) > 0n);
const count = z.number().int().min(0).max(2147483647);
const image = z.string().trim().max(2048).url().refine(value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !/[\p{Cc}\p{Cf}]/u.test(value);
  } catch { return false; }
});
const fields = {
  titulo: text(200), tipo: z.enum(['Casa', 'Apartamento', 'Terreno', 'Comercial']),
  preco: decimalSchema, cidade: text(120), bairro: text(120),
  quartos: count.nullable(), banheiros: count.nullable(), vagas: count.nullable(),
  area: positiveDecimal.nullable(),
  descricao: z.string().trim().max(10000).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value.replace(/[\r\n\t]/g, ''))).nullable(),
  imagem_url: image.nullable(), imagens: z.array(image).max(20).nullable(), destaque: z.boolean().nullable(),
};
export const createImovelSchema = z.object({
  ...fields,
  quartos: fields.quartos.optional(), banheiros: fields.banheiros.optional(), vagas: fields.vagas.optional(),
  area: fields.area.optional(), descricao: fields.descricao.optional(), imagem_url: fields.imagem_url.optional(),
  imagens: fields.imagens.optional(), destaque: fields.destaque.optional(),
}).strict();
export const updateImovelSchema = z.object(fields).partial().strict().refine(value => Object.keys(value).length > 0);
export const deleteImovelSchema = z.object({}).strict();
export const listImoveisSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  tipo: fields.tipo.optional(), cidade: text(120).optional(), bairro: text(120).optional(),
  preco_min: decimalSchema.optional(), preco_max: decimalSchema.optional(),
  quartos: z.string().regex(/^\d{1,10}$/).transform(Number).pipe(count).optional(),
  destaque: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
}).strict().refine(value => value.preco_min === undefined || value.preco_max === undefined
  || BigInt(value.preco_min.replace('.', '')) <= BigInt(value.preco_max.replace('.', '')));

export type CreateImovelInput = z.infer<typeof createImovelSchema>;
export type UpdateImovelInput = z.infer<typeof updateImovelSchema>;
export type ListImoveisInput = z.infer<typeof listImoveisSchema>;
