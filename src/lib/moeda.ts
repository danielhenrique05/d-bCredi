export const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(valor) ? valor : 0);

export const converterMoeda = (valor: string): number => {
  const limpo = valor.replace(/[^\d,.-]/g, '').trim();
  if (!limpo) return 0;

  const normalizado = limpo
    .replace(/\./g, '')
    .replace(',', '.');

  const convertido = Number(normalizado);
  return Number.isFinite(convertido) ? convertido : 0;
};

export const formatarEntradaMoeda = (valor: string): string => {
  const caracteres = valor.replace(/[^\d,]/g, '');
  if (!caracteres) return '';

  const [inteiro = '', ...fracao] = caracteres.split(',');
  const inteiroFormatado = (inteiro || '0')
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const temCentavos = caracteres.includes(',');
  const centavos = fracao.join('').slice(0, 2);

  return `R$ ${inteiroFormatado}${temCentavos ? `,${centavos}` : ''}`;
};
