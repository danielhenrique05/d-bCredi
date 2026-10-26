import { useState } from 'react';
import { ArrowUpRight, Check, MapPin, MessageCircle, Phone } from 'lucide-react';
import { localizacao } from '../data/localizacao';
import ScrollReveal from './ScrollReveal';

const modalidades = [
  {
    id: 'presencial',
    titulo: 'Atendimento presencial',
    descricao: 'Para quem deseja visitar a empresa.',
    Icone: MapPin,
    mensagem: 'Olá! Gostaria de agendar um atendimento presencial com a equipe da D&B Credi. Podemos combinar uma data e horário?',
  },
  {
    id: 'chamada',
    titulo: 'Chamada telefônica',
    descricao: 'Para quem prefere conversar por ligação.',
    Icone: Phone,
    mensagem: 'Olá! Gostaria de agendar uma chamada telefônica com um especialista da D&B Credi. Podemos combinar um horário?',
  },
  {
    id: 'whatsapp',
    titulo: 'Atendimento pelo WhatsApp',
    descricao: 'Para quem prefere conversar por mensagens.',
    Icone: MessageCircle,
    mensagem: 'Olá! Gostaria de conversar com um especialista da D&B Credi pelo WhatsApp para tirar algumas dúvidas.',
  },
] as const;

const whatsappBase = localizacao.whatsappUrl.split('?')[0];

const AgendamentoAtendimento = () => {
  const [modalidade, setModalidade] = useState<(typeof modalidades)[number]['id']>('presencial');
  const selecionada = modalidades.find((opcao) => opcao.id === modalidade)!;

  return (
    <section id="agendamento" aria-labelledby="agendamento-titulo" className="bg-white px-4 py-16 sm:py-20">
      <ScrollReveal className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Atendimento do seu jeito</p>
          <h2 id="agendamento-titulo" className="text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">Como prefere ser atendido?</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">Escolha a melhor forma de conversar com nossos especialistas.</p>
        </div>

        <fieldset>
          <legend className="sr-only">Escolha a modalidade de atendimento</legend>
          <div className="grid gap-4 md:grid-cols-3">
            {modalidades.map(({ id, titulo, descricao, Icone }) => (
              <label key={id} className="relative cursor-pointer">
                <input type="radio" name="modalidade-atendimento" value={id} checked={modalidade === id} onChange={() => setModalidade(id)} className="peer sr-only" />
                <span className="flex h-full flex-col rounded-2xl border border-blue-100 bg-[#f4f7fb] p-6 transition-colors hover:border-blue-400 peer-checked:border-blue-700 peer-checked:bg-blue-50 peer-checked:ring-2 peer-checked:ring-blue-700 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-blue-700">
                  <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0a1e52] text-yellow-400"><Icone aria-hidden="true" className="h-6 w-6" /></span>
                  <span className="text-lg font-bold text-blue-950">{titulo}</span>
                  <span className="mt-2 text-sm leading-relaxed text-slate-600">{descricao}</span>
                </span>
                {modalidade === id && <span aria-hidden="true" className="absolute right-5 top-5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-white"><Check className="h-4 w-4" /></span>}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-8 text-center">
          <a href={`${whatsappBase}?text=${encodeURIComponent(selecionada.mensagem)}`} target="_blank" rel="noopener noreferrer" aria-describedby="agendamento-aviso" className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-yellow-400 px-7 py-4 text-sm font-bold text-blue-950 transition-colors hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 sm:w-auto">
            <MessageCircle aria-hidden="true" className="h-5 w-5 shrink-0" /> Solicitar atendimento <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </a>
          <p id="agendamento-aviso" className="mx-auto mt-4 max-w-lg text-xs leading-relaxed text-slate-500">O WhatsApp será aberto em uma nova aba com a mensagem preparada. Envie para nossa equipe combinar o atendimento. Nenhum horário é confirmado automaticamente.</p>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default AgendamentoAtendimento;
