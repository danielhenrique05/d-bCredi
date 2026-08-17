import React from 'react';
import { ExternalLink, Quote, Star } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const AVALIACAO_GERAL = { nota: 4.7, total: 12 };
const LINK_GOOGLE = 'https://www.google.com/maps/place/?q=place_id:ChIJD5QmVW9_45QRUnrHMkTjz3Q';

const depoimentos = [
  { texto: 'Empresa maravilhosa, com um casal extremamente comprometido e honesto. Já fiz empréstimos e tenho várias linhas de consórcio. Recomendo totalmente.', autor: 'Cliente d&b Credi' },
  { texto: 'Ótimo atendimento! Equipe ética e com um bom suporte, indico.', autor: 'Cliente d&b Credi' },
  { texto: 'Excelente atendimento, os atendentes se preocupam contigo.', autor: 'Cliente d&b Credi' },
  { texto: 'Atendimento muito bom, várias linhas de crédito.', autor: 'Cliente d&b Credi' },
  { texto: 'Muito bom. Ótima qualidade de serviço.', autor: 'Cliente d&b Credi' },
];

const Estrelas = ({ nota = 5 }: { nota?: number }) => (
  <div className="flex gap-0.5 text-yellow-300">
    {Array.from({ length: 5 }).map((_, index) => (
      <Star key={index} className={`h-3.5 w-3.5 ${index < Math.round(nota) ? 'fill-yellow-300' : 'fill-white/10 text-white/20'}`} />
    ))}
  </div>
);

const Avaliacoes: React.FC = () => {
  return (
    <ScrollReveal className="relative isolate overflow-hidden bg-[#0a1e52] py-14 text-white">
      <style>{`
        @keyframes depoimentos-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .animate-marquee { animation: depoimentos-marquee 34s linear infinite; }
        .animate-marquee:hover { animation-play-state: paused; }
      `}</style>

      <div className="relative z-10 container mx-auto flex flex-col items-center gap-2 px-4 text-center">
        <div className="flex items-center gap-2 text-blue-100">
          <Estrelas nota={AVALIACAO_GERAL.nota} />
          <span className="text-sm font-semibold">{AVALIACAO_GERAL.nota}</span>
          <a href={LINK_GOOGLE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-100/80 underline underline-offset-2 hover:text-white">
            {AVALIACAO_GERAL.total} avaliações no Google <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="relative z-10 mt-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#0a1e52] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#0a1e52] to-transparent" />
        <div className="flex w-max animate-marquee gap-4 px-4">
          {[...depoimentos, ...depoimentos].map((depoimento, index) => (
            <article key={index} aria-hidden={index >= depoimentos.length} className="w-72 flex-shrink-0 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md sm:w-80">
              <Quote className="h-5 w-5 text-yellow-300/60" />
              <p className="mt-2 text-sm leading-relaxed text-blue-100">&quot;{depoimento.texto}&quot;</p>
              <div className="mt-4 flex items-center justify-between"><span className="text-xs font-semibold text-white">{depoimento.autor}</span><Estrelas nota={5} /></div>
            </article>
          ))}
        </div>
      </div>
    </ScrollReveal>
  );
};

export default Avaliacoes;
