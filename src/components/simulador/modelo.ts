import { localizacao } from '../../data/localizacao';

export type TipoConsorcio = 'imoveis' | 'veiculos' | 'investimento';
export type Etapa = 1 | 2 | 3 | 4;
export interface DadosSimulacao {
  tipo: TipoConsorcio | null;
  valorCentavos: string;
  nome: string;
  telefone: string;
  email: string;
}
export type ErrosSimulacao = Partial<Record<keyof DadosSimulacao, string>>;

export const tiposConsorcio: Record<TipoConsorcio, string> = {
  imoveis: 'Imóveis', veiculos: 'Veículos', investimento: 'Investimento',
};

export const dadosIniciais: DadosSimulacao = {
  tipo: null, valorCentavos: '', nome: '', telefone: '', email: '',
};

export const formatarValor = (centavos: string) => {
  if (!centavos) return '';
  const valor = Number(centavos);
  if (!Number.isSafeInteger(valor)) return centavos;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor / 100);
};

export const formatarTelefone = (valor: string) => {
  const numeros = valor.replace(/\D/g, '').slice(0, 11);
  if (numeros.length <= 2) return numeros;
  const numero = numeros.slice(2);
  const corte = numero.length > 8 ? 5 : 4;
  return `(${numeros.slice(0, 2)}) ${numero.slice(0, corte)}${numero.length > corte ? `-${numero.slice(corte)}` : ''}`;
};

export const validarEtapa = (etapa: Etapa, dados: DadosSimulacao): ErrosSimulacao => {
  const erros: ErrosSimulacao = {};
  if (etapa === 1 && !dados.tipo) erros.tipo = 'Escolha um tipo de consórcio para continuar.';
  if (etapa === 2 && (!/^\d+$/.test(dados.valorCentavos) || !Number.isSafeInteger(Number(dados.valorCentavos)) || Number(dados.valorCentavos) <= 0)) {
    erros.valorCentavos = 'Informe um valor de crédito válido, maior que zero.';
  }
  if (etapa === 3) {
    if (dados.nome.trim().length < 2 || !/\p{L}/u.test(dados.nome)) erros.nome = 'Informe seu nome.';
    if (!/^[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(dados.telefone.replace(/\D/g, ''))) {
      erros.telefone = 'Informe um telefone válido com DDD, de 10 ou 11 dígitos.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) erros.email = 'Informe um e-mail válido, como nome@exemplo.com.';
  }
  return erros;
};

// Não persiste nem envia dados. O cliente revisa e envia a mensagem no WhatsApp.
export const criarLinkWhatsApp = (dados: DadosSimulacao) => {
  const url = new URL(localizacao.whatsappUrl);
  url.searchParams.set('text', [
    'Olá! Gostaria de solicitar uma simulação de consórcio.',
    `Tipo: ${dados.tipo ? tiposConsorcio[dados.tipo] : ''}`,
    `Crédito desejado: R$ ${formatarValor(dados.valorCentavos)}`,
    `Nome: ${dados.nome.trim()}`,
    `Telefone: ${dados.telefone}`,
    `E-mail: ${dados.email.trim()}`,
  ].join('\n'));
  return url.toString();
};
