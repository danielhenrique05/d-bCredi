import { Check } from 'lucide-react';
import type { Etapa } from './modelo';

const nomes = ['Tipo', 'Valor', 'Seus dados', 'Finalização'];

const StepIndicator = ({ etapa }: { etapa: Etapa }) => (
  <ol aria-label={`Progresso: etapa ${etapa} de 4`} className="mb-10 grid grid-cols-4">
    {nomes.map((nome, index) => {
      const numero = index + 1;
      return (
        <li key={nome} aria-current={etapa === numero ? 'step' : undefined} className="relative flex flex-col items-center gap-2 text-center">
          {index > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-5 h-0.5 w-full ${etapa >= numero ? 'bg-blue-700' : 'bg-slate-200'}`} />}
          <span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${etapa === numero ? 'bg-blue-700 text-white ring-4 ring-blue-100' : etapa > numero ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-500'}`}>
            {etapa > numero ? <Check aria-hidden="true" className="h-4 w-4" /> : numero}
            <span className="sr-only">{etapa > numero ? `Etapa ${numero} concluída` : `Etapa ${numero}`}</span>
          </span>
          <span className={`relative text-[11px] sm:text-xs ${etapa === numero ? 'font-bold text-blue-700' : 'text-slate-500'}`}>{nome}</span>
        </li>
      );
    })}
  </ol>
);

export default StepIndicator;
