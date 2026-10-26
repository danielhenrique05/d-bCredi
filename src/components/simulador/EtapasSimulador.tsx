import { useEffect } from 'react';
import { Car, Check, CheckCircle2, Home, MessageCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { criarLinkWhatsApp, formatarTelefone, formatarValor, tiposConsorcio, type DadosSimulacao, type ErrosSimulacao, type TipoConsorcio } from './modelo';

const campoClass = 'mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 aria-[invalid=true]:border-red-500';
const opcoes = [
  { id: 'imoveis' as const, Icone: Home, descricao: 'Um espaço para seus planos.' },
  { id: 'veiculos' as const, Icone: Car, descricao: 'Novos caminhos pela frente.' },
  { id: 'investimento' as const, Icone: TrendingUp, descricao: 'Planeje suas próximas conquistas.' },
];

export const TipoConsorcioStep = ({ tipo, onChange, erro }: { tipo: TipoConsorcio | null; onChange: (tipo: TipoConsorcio) => void; erro?: string }) => (
  <fieldset aria-describedby={erro ? 'erro-tipo' : undefined}>
    <legend className="sr-only">Escolha o tipo de consórcio</legend>
    <div className="grid gap-3 sm:grid-cols-3">
      {opcoes.map(({ id, Icone, descricao }) => (
        <label key={id} className="relative cursor-pointer">
          <input id={`tipo-${id}`} type="radio" name="tipo" value={id} checked={tipo === id} onChange={() => onChange(id)} className="peer sr-only" required aria-invalid={Boolean(erro)} />
          <span className="flex h-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition peer-checked:border-blue-700 peer-checked:bg-blue-50 peer-checked:ring-1 peer-checked:ring-blue-700 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-200 hover:border-blue-400 sm:flex-col sm:items-start sm:gap-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icone aria-hidden="true" className="h-6 w-6" /></span>
            <span><span className="block font-bold text-blue-950">{tiposConsorcio[id]}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{descricao}</span></span>
          </span>
          {tipo === id && <Check aria-hidden="true" className="absolute right-3 top-3 h-4 w-4 text-blue-700" />}
        </label>
      ))}
    </div>
    {erro && <p id="erro-tipo" role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}
  </fieldset>
);

// Limites provisórios em reais; ajuste aqui quando houver uma faixa oficial.
const limitesCredito = { minimo: 30000, maximo: 1000000, incremento: 5000 };
const moedaCredito = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 });

export const ValorStep = ({ valor, onChange, erro }: { valor: string; onChange: (valor: string) => void; erro?: string }) => {
  const { minimo, maximo, incremento } = limitesCredito;
  const informado = Number(valor) / 100;
  const selecionado = Math.min(maximo, Math.max(minimo, minimo + Math.round(((Number.isFinite(informado) ? informado : minimo) - minimo) / incremento) * incremento));
  const centavos = String(selecionado * 100);
  const percentual = ((selecionado - minimo) / (maximo - minimo)) * 100;

  // Inicializa o formulário também quando o usuário aceita o mínimo sem arrastar.
  useEffect(() => {
    if (valor !== centavos) onChange(centavos);
  }, [valor, centavos, onChange]);

  return (
    <div>
      <label htmlFor="valor-credito" className="text-sm font-semibold text-slate-700">Valor do crédito desejado</label>
      <output htmlFor="valor-credito" className="mt-3 block text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">{moedaCredito.format(selecionado)}</output>
      <div className="relative mt-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-blue-100">
          <div className="h-full rounded-full bg-blue-700" style={{ width: `${percentual}%` }} />
        </div>
        <input id="valor-credito" name="valorCentavos" type="range" min={minimo} max={maximo} step={incremento} value={selecionado}
          onChange={(event) => onChange(String(Number(event.target.value) * 100))}
          aria-valuetext={moedaCredito.format(selecionado)} aria-invalid={Boolean(erro)} aria-describedby={erro ? 'valor-ajuda erro-valor' : 'valor-ajuda'}
          className="relative block h-11 w-full cursor-pointer appearance-none rounded-lg bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-blue-950 [&::-webkit-slider-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-blue-950 [&::-moz-range-thumb]:bg-yellow-400 [&::-moz-range-thumb]:shadow-md" />
      </div>
      <div aria-hidden="true" className="flex justify-between gap-3 text-xs font-semibold text-slate-600 sm:text-sm"><span>{moedaCredito.format(minimo)}</span><span>{moedaCredito.format(maximo)}</span></div>
      <p id="valor-ajuda" className="mt-4 text-sm leading-relaxed text-slate-500">Arraste a barra para escolher o crédito, em intervalos de {moedaCredito.format(incremento)}. O valor selecionado será usado para orientar seu atendimento.</p>
      {erro && <p id="erro-valor" role="alert" className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
};

export const ResumoSimulacao = ({ dados, mostrarNome = false }: { dados: DadosSimulacao; mostrarNome?: boolean }) => (
  <dl className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:grid-cols-2">
    <div><dt className="text-xs text-slate-500">Tipo de consórcio</dt><dd className="mt-1 font-semibold text-blue-950">{dados.tipo ? tiposConsorcio[dados.tipo] : '—'}</dd></div>
    <div><dt className="text-xs text-slate-500">Crédito desejado</dt><dd className="mt-1 break-words font-semibold text-blue-950">R$ {formatarValor(dados.valorCentavos)}</dd></div>
    {mostrarNome && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Nome</dt><dd className="mt-1 break-words font-semibold text-blue-950">{dados.nome.trim()}</dd></div>}
  </dl>
);

export const DadosClienteStep = ({ dados, onChange, erros }: { dados: DadosSimulacao; onChange: (dados: Partial<DadosSimulacao>) => void; erros: ErrosSimulacao }) => (
  <div className="space-y-5">
    <ResumoSimulacao dados={dados} />
    <div>
      <label htmlFor="nome" className="text-sm font-semibold text-slate-700">Nome</label>
      <input id="nome" name="nome" autoComplete="name" required maxLength={120} value={dados.nome} onChange={(event) => onChange({ nome: event.target.value })} aria-invalid={Boolean(erros.nome)} aria-describedby={erros.nome ? 'erro-nome' : undefined} className={campoClass} />
      {erros.nome && <p id="erro-nome" role="alert" className="mt-2 text-sm text-red-600">{erros.nome}</p>}
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="telefone" className="text-sm font-semibold text-slate-700">Telefone / WhatsApp</label>
        <input id="telefone" name="telefone" type="tel" inputMode="tel" autoComplete="tel-national" required value={dados.telefone} placeholder="(49) 99999-9999" onChange={(event) => onChange({ telefone: formatarTelefone(event.target.value) })} aria-invalid={Boolean(erros.telefone)} aria-describedby={erros.telefone ? 'erro-telefone' : undefined} className={campoClass} />
        {erros.telefone && <p id="erro-telefone" role="alert" className="mt-2 text-sm text-red-600">{erros.telefone}</p>}
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-semibold text-slate-700">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={dados.email} onChange={(event) => onChange({ email: event.target.value })} aria-invalid={Boolean(erros.email)} aria-describedby={erros.email ? 'erro-email' : undefined} className={campoClass} />
        {erros.email && <p id="erro-email" role="alert" className="mt-2 text-sm text-red-600">{erros.email}</p>}
      </div>
    </div>
    <p className="text-xs leading-relaxed text-slate-500">Ao finalizar, você poderá revisar e compartilhar estes dados com nossa equipe pelo WhatsApp. <Link to="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">Política de Privacidade</Link>.</p>
  </div>
);

export const ResultadoStep = ({ dados }: { dados: DadosSimulacao }) => (
  <div className="space-y-6">
    <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
      <p className="text-sm leading-relaxed text-slate-600">Seu pedido está preparado. Para solicitar o atendimento, abra o WhatsApp e envie a mensagem à nossa equipe. <strong className="font-semibold text-blue-950">Seus dados ainda não foram enviados.</strong></p>
    </div>
    <ResumoSimulacao dados={dados} mostrarNome />
    <a href={criarLinkWhatsApp(dados)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-4 text-center text-sm font-bold text-blue-950 transition hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
      <MessageCircle aria-hidden="true" className="h-5 w-5 shrink-0" /> Solicitar simulação pelo WhatsApp
    </a>
    <p className="text-center text-xs leading-relaxed text-slate-500">As condições serão informadas pela equipe após o atendimento. Nenhuma parcela, taxa ou prazo foi calculado nesta etapa.</p>
  </div>
);
