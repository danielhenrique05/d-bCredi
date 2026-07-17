import React from 'react';
import { ArrowRight, HeartHandshake, ShieldCheck, Target, TrendingUp } from 'lucide-react';

interface HeroProps {
  onSectionChange: (section: string) => void;
}

const Hero: React.FC<HeroProps> = ({ onSectionChange }) => {
  return (
    <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 py-20 text-white">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-yellow-300">d&b Credi</p>
            <h2 className="mb-6 text-5xl font-bold leading-tight">
              Transformamos sonhos em <span className="text-yellow-400">conquistas</span>
            </h2>
            <p className="mb-8 text-xl text-blue-100">
              Soluções financeiras inteligentes, seguras e acessíveis para quem quer planejar, realizar e crescer com confiança.
            </p>
            <div className="mb-12 flex flex-col gap-4 sm:flex-row">
              <a
                href="https://wa.me/554999103430"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-yellow-400 px-8 py-4 font-semibold text-blue-900 transition-colors hover:bg-yellow-300"
              >
                Falar no WhatsApp <ArrowRight className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={() => onSectionChange('products')}
                className="rounded-lg border-2 border-white px-8 py-4 font-semibold text-white transition-colors hover:bg-white hover:text-blue-800"
              >
                Conhecer soluções
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg bg-white/10 p-6 backdrop-blur-sm">
              <TrendingUp className="mb-4 h-12 w-12 text-yellow-400" />
              <h3 className="mb-2 text-2xl font-bold">9 anos</h3>
              <p className="text-blue-100">Ajudando pessoas a conquistar seus objetivos</p>
            </div>
            <div className="rounded-lg bg-white/10 p-6 backdrop-blur-sm">
              <HeartHandshake className="mb-4 h-12 w-12 text-yellow-400" />
              <h3 className="mb-2 text-2xl font-bold">Atendimento humano</h3>
              <p className="text-blue-100">Próximo, transparente e comprometido</p>
            </div>
            <div className="rounded-lg bg-white/10 p-6 backdrop-blur-sm">
              <ShieldCheck className="mb-4 h-12 w-12 text-yellow-400" />
              <h3 className="mb-2 text-2xl font-bold">Crédito consciente</h3>
              <p className="text-blue-100">Segurança para cada decisão financeira</p>
            </div>
            <div className="rounded-lg bg-white/10 p-6 backdrop-blur-sm">
              <Target className="mb-4 h-12 w-12 text-yellow-400" />
              <h3 className="mb-2 text-2xl font-bold">Consórcio planejado</h3>
              <p className="text-blue-100">Estratégia para realizar novos planos</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
