import { z } from 'zod';

export const CONTEMPLADOS_MAX_ITEMS = 5_000;
export const contempladosQuerySchema = z.object({}).strict();
const controlCharacters = /[\p{Cc}\p{Cf}]/u;

// Dinheiro permanece string. A comparação opcional usa centavos inteiros exatos.
const formattedMoney = z.string().max(64).trim()
  .transform(value => value.replace(/\s+/gu, ' '))
  .pipe(z.string().regex(/^R\$ (?:0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+),\d{2}$/, { abort: true }));
const decimalMoney = z.string().max(34).trim().regex(/^(?:0|[1-9]\d{0,29})(?:\.\d{1,2})?$/, { abort: true });
const decimalCents = (value: string): bigint => {
  const [integer, fraction = ''] = value.split('.');
  return BigInt(integer! + fraction.padEnd(2, '0'));
};
const formattedCents = (value: string): bigint => BigInt(value.replace(/\D/g, ''));

const category = z.string().max(32).trim()
  .transform(value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase())
  .pipe(z.enum(['imovel', 'veiculo']))
  .transform(value => value === 'imovel' ? 'Imóvel' as const : 'Veículo' as const);
const availability = z.string().max(32).trim().toLowerCase()
  .pipe(z.enum(['reservar', 'reservado']))
  .transform(value => value === 'reservar' ? 'Reservar' as const : 'Reservado' as const);
const image = z.preprocess(value => value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value,
  z.string().max(2048).trim().refine(value => {
    if (!/^https:\/\//i.test(value) || controlCharacters.test(value) || /[\s\\]/u.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
    } catch { return false; }
  }).optional());

const cartaSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  categoria: category,
  valor_credito_fmt: formattedMoney,
  entrada_fmt: formattedMoney,
  parcelas: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  valor_parcela_fmt: formattedMoney,
  administradora: z.string().max(120).trim().min(1).refine(value => !controlCharacters.test(value)),
  administradora_img: image,
  reserva: availability,
  // Se enviados, os valores decimais precisam concordar com os valores exibidos.
  valor_credito: decimalMoney.optional(),
  valor_parcela: decimalMoney.optional(),
}).superRefine((carta, context) => {
  for (const [raw, formatted] of [['valor_credito', 'valor_credito_fmt'], ['valor_parcela', 'valor_parcela_fmt']] as const) {
    if (carta[raw] !== undefined && decimalCents(carta[raw]) !== formattedCents(carta[formatted])) {
      context.addIssue({ code: 'custom', path: [raw], message: 'Valor decimal e formatado divergentes.' });
    }
  }
}).transform(carta => ({
  id: carta.id, categoria: carta.categoria,
  valor_credito_fmt: carta.valor_credito_fmt, entrada_fmt: carta.entrada_fmt,
  parcelas: carta.parcelas, valor_parcela_fmt: carta.valor_parcela_fmt,
  administradora: carta.administradora,
  ...(carta.administradora_img ? { administradora_img: carta.administradora_img } : {}),
  reserva: carta.reserva,
}));

export const contempladosSchema = z.array(cartaSchema).max(CONTEMPLADOS_MAX_ITEMS).superRefine((cartas, context) => {
  const ids = new Set<number>();
  cartas.forEach((carta, index) => {
    if (ids.has(carta.id)) context.addIssue({ code: 'custom', path: [index, 'id'], message: 'Identificador externo repetido.' });
    ids.add(carta.id);
  });
});
export type CartaContemplada = z.infer<typeof cartaSchema>;
