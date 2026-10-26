import { ArrowRight, Car, Home, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import ScrollReveal from './ScrollReveal';

const ChamadaSimulador = () => (
  <section aria-labelledby="chamada-simulador" className="bg-white px-4 pb-16 pt-6 sm:pb-20">
    <ScrollReveal className="mx-auto max-w-6xl">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[#0a1e52] p-7 text-white sm:p-10 lg:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-36 -z-10 h-96 w-96 rounded-full border-[48px] border-white/5" />
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div className="max-w-xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-yellow-300">Seu plano começa aqui</p>
            <h2 id="chamada-simulador" className="text-3xl font-bold tracking-tight sm:text-4xl">Simule seu consórcio</h2>
            <p className="mt-4 text-lg text-blue-100">Descubra uma opção que combina com seus planos.</p>
            <p className="mt-2 text-sm leading-relaxed text-blue-200">Escolha seu objetivo, informe o crédito desejado e prepare seu pedido para conversar com nossa equipe.</p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-blue-100">
              <span className="flex items-center gap-2"><Home aria-hidden="true" className="h-4 w-4 text-yellow-300" /> Imóveis</span>
              <span className="flex items-center gap-2"><Car aria-hidden="true" className="h-4 w-4 text-yellow-300" /> Veículos</span>
              <span className="flex items-center gap-2"><TrendingUp aria-hidden="true" className="h-4 w-4 text-yellow-300" /> Investimento</span>
            </div>
          </div>
          <Link to="/simulador-consorcio" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-yellow-400 px-7 py-4 text-sm font-bold text-blue-950 transition-colors hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300">
            SIMULAR AGORA <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </ScrollReveal>
  </section>
);

export default ChamadaSimulador;
