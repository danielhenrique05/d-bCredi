import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react'
import ScrollReveal from './ScrollReveal';


interface NossasSolucoesProps {
  onSectionChange: (section: string) => void;
}


const categorias = [
  {
    titulo: 'Consignado e Consórcios',
    descricao: 'Linhas de crédito facilitadas, com parcelas que cabem no seu bolso.',
    imagem: '/imgs/categoria-consignado.jpg',
    section: 'products',
  },
  {
    titulo: 'Cartas Contempladas',
    descricao: 'Aproveite cartas já contempladas e realize seu plano sem esperar o sorteio.',
    imagem: '/imgs/categoria-cartas.jpg',
    section: 'cartas',
  },
  {
    titulo: 'Imóveis',
    descricao: 'Encontre o imóvel ideal com condições que combinam com a sua realidade.',
    imagem: '/imgs/categoria-imoveis.jpg',
    section: 'imoveis',
  },
];

const NossasSolucoes: React.FC<NossasSolucoesProps> = ({ onSectionChange }) => {
  const trilhoRef = useRef<HTMLDivElement>(null);

  const rolar = (direcao: 'esq' | 'dir') => {
    trilhoRef.current?.scrollBy({
      left: direcao === 'dir' ? 340 : -340,
      behavior: 'smooth',
    });
  };

  return (
    <section className="bg-white px-4 py-16">
      <div className="container mx-auto max-w-6xl">
        <ScrollReveal className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Encontre a solução ideal pro seu momento
          </h2>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-blue-700" />
        </ScrollReveal>

        <ScrollReveal delay={120} className="relative mt-10">
          <div
            ref={trilhoRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 md:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {categorias.map((c) => (
              <button
                key={c.titulo}
                type="button"
                onClick={() => onSectionChange(c.section)}
                className="group w-64 flex-shrink-0 snap-start text-left sm:w-72"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900">
                  <img
                    src={c.imagem}
                    alt={c.titulo}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{c.titulo}</h3>
                <p className="mt-1 text-sm text-gray-600">{c.descricao}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => rolar('esq')}
              aria-label="Categoria anterior"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => rolar('dir')}
              aria-label="Próxima categoria"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={220}>
          <div className="relative mt-4 overflow-hidden rounded-[28px] bg-gradient-to-r from-[#0c2a7a] to-[#103bb3] p-8 text-white sm:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-yellow-300/10 blur-3xl" />
          <div className="relative max-w-md">
            <h3 className="text-2xl font-bold leading-snug sm:text-3xl">
              Conte pra gente o que você precisa
            </h3>
            <p className="mt-3 text-blue-100">
              Nossa equipe monta a solução ideal pro seu momento — atendimento
              humano, sem robô e sem letra miúda.
            </p>
            <a
              href="https://wa.me/554999103430"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-3 font-bold text-blue-950 transition-all hover:-translate-y-0.5 hover:bg-yellow-300"
            >
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </a>
          </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default NossasSolucoes
