import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Footer from "./Footer";
import {
  ArrowLeft,
  ShieldCheck,
  ScrollText,
  UserCheck,
  Database,
  RefreshCw,
  Cookie,
  Lock,
  Eye,
  Pencil,
  XCircle,
  Download,
  Trash2,
  Phone,
  MessageCircle,
  Mail,
  ChevronDown,
  HeartHandshake,
} from "lucide-react";

/* ---------- dados de apoio (fácil de editar/ajustar) ---------- */

const valores = [
  {
    icon: HeartHandshake,
    titulo: "Honestidade e transparência",
    texto: "Explicamos de forma clara o que fazemos com seus dados, sem letras miúdas.",
  },
  {
    icon: ShieldCheck,
    titulo: "Compromisso e respeito",
    texto: "Tratamos suas informações com o mesmo cuidado que gostaríamos de receber.",
  },
  {
    icon: Lock,
    titulo: "Segurança em primeiro lugar",
    texto: "Usamos medidas técnicas para proteger seus dados contra acessos indevidos.",
  },
  {
    icon: UserCheck,
    titulo: "Você no controle",
    texto: "Seus direitos sobre seus dados são seus — e é fácil exercê-los.",
  },
];

const conceitos = [
  {
    titulo: "LGPD",
    texto: "A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) é quem define as regras do jogo.",
  },
  {
    titulo: "Titular dos dados",
    texto: "É você — a pessoa a quem as informações pessoais pertencem.",
  },
  {
    titulo: "Dados pessoais",
    texto: "Informações que identificam você, como nome, CPF e endereço.",
  },
  {
    titulo: "Tratamento",
    texto: "Tudo o que fazemos com seus dados: coletar, guardar, usar, compartilhar.",
  },
];

const tiposDeDados = [
  {
    icon: UserCheck,
    titulo: "Dados cadastrais",
    texto: "Nome, CPF, RG, data de nascimento, endereço, e-mail e telefone.",
  },
  {
    icon: Database,
    titulo: "Dados financeiros",
    texto: "Renda, histórico de crédito e dados bancários usados na análise de propostas.",
  },
  {
    icon: Eye,
    titulo: "Dados de navegação",
    texto: "Cookies, IP e páginas visitadas, pra melhorar sua experiência no site.",
  },
  {
    icon: ScrollText,
    titulo: "Outros dados",
    texto: "Informações adicionais necessárias pra formalizar contratos, quando aplicável.",
  },
];

const usoDosDados = [
  {
    titulo: "Relacionamento",
    texto: "Manter contato e dar suporte durante toda a sua jornada com a gente.",
  },
  {
    titulo: "Análise de crédito",
    texto: "Avaliar propostas de crédito, consórcio ou financiamento com responsabilidade.",
  },
  {
    titulo: "Segurança",
    texto: "Prevenir fraudes e confirmar sua identidade em nossos canais.",
  },
  {
    titulo: "Obrigações legais",
    texto: "Cumprir exigências de leis e órgãos reguladores do setor financeiro.",
  },
  {
    titulo: "Comunicação",
    texto: "Enviar novidades sobre produtos e atualizações do seu contrato.",
  },
];

const direitos = [
  { icon: Eye, titulo: "Confirmação e acesso", texto: "Saber se tratamos seus dados e pedir uma cópia deles." },
  { icon: Pencil, titulo: "Correção", texto: "Atualizar dados incompletos, incorretos ou desatualizados." },
  { icon: XCircle, titulo: "Revogar consentimento", texto: "Retirar sua autorização para tratamentos que dependem dela." },
  { icon: Download, titulo: "Portabilidade", texto: "Solicitar o envio dos seus dados a outro fornecedor." },
  { icon: Trash2, titulo: "Eliminação", texto: "Pedir a exclusão de dados que não sejam mais necessários." },
  { icon: RefreshCw, titulo: "Outros direitos", texto: "Demais garantias previstas no artigo 18 da LGPD." },
];

const politicaCompleta = [
  {
    id: "quem-somos",
    pergunta: "Quem somos e o que esta política cobre",
    resposta:
      "Esta política se aplica ao site e aos canais digitais da d&b Credi, inscrita no CNPJ 28.125.510/0001-04. Ela explica como tratamos os dados pessoais de clientes, visitantes do site e pessoas que solicitam simulações ou propostas de crédito.",
  },
  {
    id: "coleta",
    pergunta: "Quais dados coletamos, em detalhe",
    resposta:
      "Coletamos dados fornecidos diretamente por você (em formulários, simulações e propostas), dados gerados durante o uso dos nossos serviços (como histórico de contratos) e dados de navegação obtidos por cookies. Quando necessário para análise de crédito, também podemos consultar informações em órgãos de proteção ao crédito.",
  },
  {
    id: "compartilhamento",
    pergunta: "Com quem compartilhamos seus dados",
    resposta:
      "Podemos compartilhar dados com instituições financeiras parceiras (para viabilizar propostas), órgãos de proteção ao crédito como Serasa e SCPC, autoridades públicas quando exigido por lei, e prestadores de serviço que atuam em nosso nome — sempre restrito ao necessário para cada finalidade.",
  },
  {
    id: "seguranca",
    pergunta: "Como protegemos seus dados e por quanto tempo os guardamos",
    resposta:
      "Adotamos controles técnicos e administrativos para reduzir o risco de acesso não autorizado, perda ou vazamento. Mantemos os dados pelo tempo necessário para cumprir as finalidades informadas ou obrigações legais e regulatórias aplicáveis ao setor financeiro.",
  },
  {
    id: "cookies",
    pergunta: "Como usamos cookies",
    resposta:
      "Cookies são pequenos arquivos que ajudam o site a funcionar corretamente e a entender como ele é utilizado. Você pode gerenciar ou desativar cookies diretamente nas configurações do seu navegador, embora isso possa limitar algumas funcionalidades do site.",
  },
  {
    id: "alteracoes",
    pergunta: "Alterações nesta política",
    resposta:
      "Esta política pode ser atualizada periodicamente para refletir mudanças legais ou nos nossos serviços. A data da última atualização fica sempre indicada no topo desta página.",
  },
];

/* ---------- componentes auxiliares ---------- */

function CardGrid({
  items,
  cols = "md:grid-cols-2 lg:grid-cols-4",
}: {
  items: { icon?: React.ElementType; titulo: string; texto: string }[];
  cols?: string;
}) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${cols}`}>
      {items.map((item) => (
        <div
          key={item.titulo}
          className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          {item.icon && (
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <item.icon className="h-5 w-5" />
            </div>
          )}
          <h3 className="font-semibold text-gray-900">{item.titulo}</h3>
          <p className="mt-1 text-sm text-gray-600">{item.texto}</p>
        </div>
      ))}
    </div>
  );
}

function Accordion() {
  const [abertoId, setAbertoId] = useState<string | null>(politicaCompleta[0].id);

  return (
    <div className="divide-y divide-gray-200 rounded-[24px] border border-gray-200 bg-white">
      {politicaCompleta.map((item) => {
        const aberto = abertoId === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setAbertoId(aberto ? null : item.id)}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
              aria-expanded={aberto}
            >
              <span className="font-medium text-gray-900">{item.pergunta}</span>
              <ChevronDown
                className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${
                  aberto ? "rotate-180" : ""
                }`}
              />
            </button>
            {aberto && (
              <div className="px-6 pb-5 text-sm leading-relaxed text-gray-600">
                {item.resposta}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- página principal ---------- */

export default function PoliticaDePrivacidade() {
  const navigate = useNavigate();

  const handleSectionChange = (section: string) => {
    navigate("/", { state: { section } });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para o site
          </Link>
        </div>
      </div>

      <section className="bg-gradient-to-b from-blue-50 to-gray-50 px-4 py-16">
        <div className="container mx-auto max-w-3xl text-center">
          
          <h1 className="mt-4 text-3xl font-bold text-gray-900 md:text-4xl">
            Feita pra você entender como cuidamos dos seus dados
          </h1>
          <p className="mt-4 text-gray-600">
            Aqui explicamos, de um jeito simples, como a d&amp;b Credi coleta,
            usa e protege seus dados pessoais — e quais direitos você tem
            sobre eles.
          </p>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Privacidade é um dos nossos valores
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
            Os mesmos princípios que guiam nosso atendimento guiam também o
            cuidado com os seus dados.
          </p>
          <div className="mt-8">
            <CardGrid items={valores} />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Alguns conceitos que ajudam a entender tudo
          </h2>
          <div className="mt-8">
            <CardGrid items={conceitos} />
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Quais dados podemos ter sobre você
          </h2>
          <div className="mt-8">
            <CardGrid items={tiposDeDados} />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Para que usamos essas informações
          </h2>
          <div className="mt-8">
            <CardGrid items={usoDosDados} cols="md:grid-cols-3 lg:grid-cols-5" />
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="container mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Cookie className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            E o que são cookies, afinal?
          </h2>
          <p className="text-gray-600">
            São pequenos arquivos que ajudam o site a funcionar direitinho e a
            entender melhor a sua navegação, pra tornar sua experiência mais
            completa.
          </p>
        </div>
      </section>

      <section className="bg-white px-4 py-14">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Você no controle dos seus dados
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
            Seus direitos são garantidos pela LGPD e podem ser exercidos a
            qualquer momento.
          </p>
          <div className="mt-8">
            <CardGrid items={direitos} cols="md:grid-cols-3 lg:grid-cols-3" />
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Exercer seus direitos é simples
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-600">
            Fale com a gente por qualquer um dos nossos canais de
            atendimento.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="https://wa.me/554999103430"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition-colors hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a
              href="tel:+554999103430"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Phone className="h-4 w-4" /> +55 49 9910-3430
            </a>
            <a
              href="mailto:dpo@dbcredi.com.br?subject=Aos%20cuidados%20do%20Encarregado"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Mail className="h-4 w-4" /> dpo@dbcredi.com.br
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Saiba tudo em detalhes
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
            Esta página é um resumo. Abaixo você encontra a versão completa
            da nossa Política de Privacidade.
          </p>
          <div className="mt-8">
            <Accordion />
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 pt-6">
        <div className="container mx-auto max-w-3xl rounded-[24px] border border-blue-100 bg-blue-50 p-6 text-center text-sm text-gray-600">
          Dúvidas sobre esta política ou sobre o tratamento dos seus dados?
          Escreva para{" "}
          <a
            href="mailto:dpo@dbcredi.com.br"
            className="font-medium text-blue-700 underline"
          >
            dpo@dbcredi.com.br
          </a>
          , com o assunto "Aos cuidados do Encarregado".
        </div>
      </section>

      <Footer onSectionChange={handleSectionChange} />
    </div>
  );
}