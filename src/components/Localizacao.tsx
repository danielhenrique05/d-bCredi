import { ArrowUpRight, MapPin, MessageCircle, Navigation } from 'lucide-react';
import { localizacao } from '../data/localizacao';
import ScrollReveal from './ScrollReveal';

const Localizacao = () => (
  <section id="localizacao" aria-labelledby="localizacao-titulo" className="bg-[#f4f7fb] px-4 py-16 sm:py-24">
    <div className="mx-auto max-w-6xl">
      <ScrollReveal className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
            <span aria-hidden="true" className="h-0.5 w-7 bg-blue-700" /> Nossa localização
          </p>
          <h2 id="localizacao-titulo" className="text-3xl font-bold leading-tight tracking-tight text-blue-950 sm:text-4xl">
            Vamos conversar de perto?
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-slate-600 sm:text-base">
          Tem planos, ideias ou dúvidas? Venha conhecer a gente e pensar no próximo passo juntos.
        </p>
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <div className="overflow-hidden rounded-[28px] border border-blue-950/10 bg-[#0a1e52] shadow-[0_20px_60px_-30px_rgba(10,30,82,0.45)] sm:rounded-[32px]">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative isolate overflow-hidden p-7 text-white sm:p-10 lg:p-12">
              <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 -z-10 h-80 w-80 rounded-full border border-white/[0.06]" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full border border-white/[0.06]" />

              <div className="mb-8 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-blue-950">
                  <MapPin aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Aqui, você é bem-vindo</span>
              </div>

              <h3 className="max-w-sm text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl">
                Grandes planos.<br />
                <span className="text-yellow-400">Uma boa conversa.</span>
              </h3>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-blue-100/90">
                Atendimento de verdade, olho no olho. Nossa equipe está aqui para ouvir você e ajudar a encontrar o melhor caminho.
              </p>

              <div className="my-7 border-y border-white/15 py-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">Visite a D&B Credi</p>
                <address className="text-sm not-italic leading-relaxed">
                  <span className="block font-semibold text-white">{localizacao.endereco}</span>
                  <span className="text-blue-100">{localizacao.bairro} · {localizacao.cidade} / {localizacao.estado}</span>
                </address>
              </div>

              <div className="flex flex-col items-start gap-5">
                <a
                  href={localizacao.rotasUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-yellow-400 px-6 py-3.5 text-sm font-bold text-blue-950 transition-colors hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300 sm:w-auto"
                >
                  <Navigation aria-hidden="true" className="h-4 w-4" /> Traçar rota no Google Maps
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
                </a>
                <a
                  href={localizacao.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white underline decoration-white/30 underline-offset-4 transition-colors hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300"
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4" /> Combine sua visita pelo WhatsApp
                </a>
              </div>
            </div>

            <div className="flex min-w-0 flex-col border-t border-white/10 bg-white lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-7">
                <div>
                  <p className="text-sm font-bold text-blue-950">Encontre a gente no mapa</p>
                  <p className="mt-0.5 text-xs text-slate-500">Concórdia, Santa Catarina</p>
                </div>
                <a
                  href={localizacao.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir localização da D&B Credi no Google Maps"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-100 text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <ArrowUpRight aria-hidden="true" className="h-5 w-5" />
                </a>
              </div>
              <iframe
                title="Localização da D&B Credi em Concórdia no Google Maps"
                src={localizacao.embedUrl}
                width="600"
                height="450"
                loading="lazy"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="block h-[340px] w-full flex-1 border-0 bg-slate-100 sm:min-h-[400px] lg:min-h-[480px]"
              />
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default Localizacao;
