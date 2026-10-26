import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import StepIndicator from './simulador/StepIndicator';
import { DadosClienteStep, ResultadoStep, TipoConsorcioStep, ValorStep } from './simulador/EtapasSimulador';
import { dadosIniciais, validarEtapa, type DadosSimulacao, type ErrosSimulacao, type Etapa } from './simulador/modelo';

const titulos = {
  1: 'Escolha o tipo de consórcio',
  2: 'Qual valor você está buscando?',
  3: 'Como podemos falar com você?',
  4: 'Tudo pronto para o próximo passo!',
};
const descricoes = {
  1: 'Todo plano tem um começo. Qual é o seu objetivo?',
  2: 'Conte para a gente o tamanho do seu plano.',
  3: 'Preencha seus dados para preparar a solicitação.',
  4: 'Confira seu resumo e converse com a D&B Credi.',
};

const SimuladorConsorcio = () => {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [dados, setDados] = useState<DadosSimulacao>({ ...dadosIniciais });
  const [erros, setErros] = useState<ErrosSimulacao>({});
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const etapasRef = useRef<HTMLDivElement>(null);
  const formularioRef = useRef<HTMLFormElement>(null);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useEffect(() => {
    tituloRef.current?.focus({ preventScroll: true });
    if (etapa > 1) etapasRef.current?.scrollIntoView({ block: 'start' });
  }, [etapa]);

  const atualizarDados = (alteracoes: Partial<DadosSimulacao>) => {
    setDados((atual) => ({ ...atual, ...alteracoes }));
    setErros((atuais) => {
      const restantes = { ...atuais };
      for (const campo of Object.keys(alteracoes) as (keyof DadosSimulacao)[]) delete restantes[campo];
      return restantes;
    });
  };

  const avancar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const novosErros = validarEtapa(etapa, dados);
    setErros(novosErros);
    const primeiroCampo = Object.keys(novosErros)[0];
    if (primeiroCampo) {
      formularioRef.current?.querySelector<HTMLInputElement>(`[name="${primeiroCampo}"]`)?.focus();
      return;
    }
    if (etapa < 4) setEtapa((atual) => (atual + 1) as Etapa);
  };

  const voltar = () => {
    setErros({});
    setEtapa((atual) => Math.max(1, atual - 1) as Etapa);
  };
  const navegarSecao = (section: string) => navigate('/', { state: { section } });

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <Header currentSection="simulador" onSectionChange={navegarSecao} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Link to="/" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 hover:underline"><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Voltar ao início</Link>
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Planeje sua próxima conquista</p>
          <h1 className="text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">Simulador de Consórcio</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">Seu objetivo em poucos passos. Atendimento com quem entende dos seus planos.</p>
        </div>
        <div ref={etapasRef} className="scroll-mt-40 rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(10,30,82,0.3)] sm:p-9">
          <StepIndicator etapa={etapa} />
          <div className="mb-7">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-700">Etapa {etapa} de 4</p>
            <h2 ref={tituloRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-blue-950 outline-none">{titulos[etapa]}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{descricoes[etapa]}</p>
          </div>
          <form ref={formularioRef} onSubmit={avancar} noValidate>
            {etapa === 1 && <TipoConsorcioStep tipo={dados.tipo} onChange={(tipo) => atualizarDados({ tipo })} erro={erros.tipo} />}
            {etapa === 2 && <ValorStep valor={dados.valorCentavos} onChange={(valorCentavos) => atualizarDados({ valorCentavos })} erro={erros.valorCentavos} />}
            {etapa === 3 && <DadosClienteStep dados={dados} onChange={atualizarDados} erros={erros} />}
            {etapa === 4 && <ResultadoStep dados={dados} />}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
              {etapa > 1 ? <button type="button" onClick={voltar} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><ArrowLeft aria-hidden="true" className="h-4 w-4" /> {etapa === 4 ? 'Revisar dados' : 'Voltar'}</button> : <span className="text-xs text-slate-500">Vamos começar?</span>}
              {etapa < 4 && <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{etapa === 3 ? 'Finalizar' : 'Continuar'}<ArrowRight aria-hidden="true" className="h-4 w-4" /></button>}
            </div>
          </form>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-xs leading-relaxed text-slate-500">Este formulário prepara uma solicitação de atendimento. As condições reais do consórcio serão apresentadas pela nossa equipe.</p>
      </main>
      <Footer onSectionChange={navegarSecao} />
    </div>
  );
};

export default SimuladorConsorcio;
