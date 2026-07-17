import React, { useEffect, useState } from 'react';
import { ArrowRight, HeartHandshake, MessageCircle, ShieldCheck, Target, TrendingUp } from 'lucide-react';

interface HeroProps {
  onSectionChange: (section: string) => void;
}

const vantagens = [
  {
    title: '9 anos de história',
    description: 'Ajudando pessoas a conquistar seus objetivos.',
    icon: TrendingUp,
  },
  {
    title: 'Atendimento humano',
    description: 'Próximo, transparente e comprometido.',
    icon: HeartHandshake,
  },
  {
    title: 'Crédito consciente',
    description: 'Segurança para cada decisão financeira.',
    icon: ShieldCheck,
  },
  {
    title: 'Consórcio planejado',
    description: 'Estratégia para realizar novos planos.',
    icon: Target,
  },
];

const palavrasAnimadas = ['conquistas', 'realidade', 'sucesso', 'oportunidades'];

const Hero: React.FC<HeroProps> = ({ onSectionChange }) => {
  const [indicePalavra, setIndicePalavra] = useState(0);
  const [palavraDigitada, setPalavraDigitada] = useState('');
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    const palavraAtual = palavrasAnimadas[indicePalavra];
    let intervalo = apagando ? 45 : 90;

    if (!apagando && palavraDigitada === palavraAtual) {
      intervalo = 1500;
    } else if (apagando && palavraDigitada === '') {
      intervalo = 280;
    }

    const timer = window.setTimeout(() => {
      if (!apagando && palavraDigitada === palavraAtual) {
        setApagando(true);
        return;
      }

      if (apagando && palavraDigitada === '') {
        setApagando(false);
        setIndicePalavra((indice) => (indice + 1) % palavrasAnimadas.length);
        return;
      }

      setPalavraDigitada((palavra) =>
        apagando ? palavra.slice(0, -1) : palavraAtual.slice(0, palavra.length + 1)
      );
    }, intervalo);

    return () => window.clearTimeout(timer);
  }, [apagando, indicePalavra, palavraDigitada]);

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#0c2a7a] via-[#103bb3] to-[#0a1e52] py-20 text-white lg:py-28">
      <div className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-yellow-300/15 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/10 blur-3xl" />

      <div className="relative z-10 container mx-auto px-4">
        <div className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <div className="max-w-3xl">
            <span className="mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-blue-50 backdrop-blur-md">
              D&B CREDI
            </span>

            <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Transformamos sonhos em{' '}
              <span className="inline-flex min-w-[13ch] whitespace-nowrap text-yellow-400">
                {palavraDigitada}
                <span aria-hidden="true" className="ml-0.5 animate-pulse text-yellow-300">|</span>
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-blue-100 sm:text-xl">
              Soluções financeiras inteligentes, seguras e acessíveis para quem quer planejar, realizar e crescer com confiança.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <a
                href="https://wa.me/554999103430"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-7 py-4 font-bold text-blue-950 shadow-lg shadow-yellow-400/20 transition-all hover:-translate-y-0.5 hover:bg-yellow-300"
              >
                <MessageCircle className="h-5 w-5" />
                Falar no WhatsApp
                <ArrowRight className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={() => onSectionChange('products')}
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-7 py-4 font-semibold text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/10"
              >
                Conhecer soluções
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {vantagens.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-300/10 text-yellow-300 ring-1 ring-yellow-300/20">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mb-2 text-lg font-bold text-white">{title}</h2>
                <p className="text-sm leading-relaxed text-blue-100">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
