import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Search, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

type HistoryEntry = {
  id: number;
  date: string;
  time: string;
  user: string;
  action: string;
  item: string;
  area: string;
  details: string;
};

const historyEntries: HistoryEntry[] = [
  {
    id: 1,
    date: '27/07/2026',
    time: '14:12',
    user: 'admin@teste.com',
    action: 'Editou imóvel',
    item: 'Casa Vila Nova',
    area: 'Imóveis',
    details: 'Atualizou descrição, preço e fotos destacadas.',
  },
  {
    id: 2,
    date: '27/07/2026',
    time: '13:40',
    user: 'financeiro@empresa.com',
    action: 'Atualizou carta',
    item: 'Carta nº 1042',
    area: 'Cartas',
    details: 'Alterou status para contemplada e ajustou observações.',
  },
  {
    id: 3,
    date: '26/07/2026',
    time: '12:15',
    user: 'suporte@empresa.com',
    action: 'Publicou anúncio',
    item: 'Apartamento Jardim',
    area: 'Imóveis',
    details: 'Criou novo anúncio e habilitou destaque no portal.',
  },
  {
    id: 4,
    date: '26/07/2026',
    time: '09:05',
    user: 'marketing@empresa.com',
    action: 'Editou carta',
    item: 'Carta nº 1008',
    area: 'Cartas',
    details: 'Atualizou dados cadastrais e anexou nova documentação.',
  },
];

const AdminHistorico = () => {
  const [selectedDate, setSelectedDate] = useState('todos');

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(historyEntries.map((entry) => entry.date))).sort((a, b) => {
      const [dayA, monthA, yearA] = a.split('/').map(Number);
      const [dayB, monthB, yearB] = b.split('/').map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA).getTime();
      const dateB = new Date(yearB, monthB - 1, dayB).getTime();
      return dateB - dateA;
    });
  }, []);

  const filteredEntries = useMemo(() => {
    if (selectedDate === 'todos') {
      return historyEntries;
    }

    return historyEntries.filter((entry) => entry.date === selectedDate);
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">
            Registro completo
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">
            Histórico de alterações
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Consulte todas as movimentações registradas e filtre por data para localizar uma alteração específica.
          </p>
        </div>

        <Link
          to="/admin/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao dashboard
        </Link>
      </div>

      <section className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-slate-900 via-blue-800 to-indigo-700 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-100">Filtro de auditoria</p>
            <h3 className="mt-2 text-xl font-semibold">
              Selecione o dia para visualizar as alterações ocorridas
            </h3>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-blue-50">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" />
              Data da modificação
            </span>
            <div className="rounded-[20px] border border-white/20 bg-white/12 p-[2px] shadow-[0_10px_35px_rgba(15,23,42,0.15)] backdrop-blur">
              <select
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full rounded-[18px] border border-white/10 bg-slate-950/30 px-4 py-3 text-sm font-medium text-white outline-none transition focus:border-white/30 focus:bg-slate-950/40"
              >
                <option value="todos" className="bg-slate-900 text-white">
                  Todos os registros
                </option>
                {uniqueDates.map((date) => (
                  <option key={date} value={date} className="bg-slate-900 text-white">
                    {date}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-blue-700">
          <Search className="h-4 w-4" />
          {selectedDate === 'todos'
            ? 'Exibindo todas as alterações registradas'
            : `Mostrando alterações de ${selectedDate}`}
        </div>

        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-[24px] border border-gray-200 bg-gray-50/80 p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{entry.action}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm">
                        {entry.area}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{entry.item}</p>
                    <p className="mt-1 text-sm text-gray-500">{entry.user}</p>
                    <p className="mt-2 text-sm text-gray-600">{entry.details}</p>
                  </div>
                </div>

                <div className="min-w-[140px] rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-3 text-sm shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    Modificado
                  </div>
                  <p className="mt-2 font-semibold text-gray-900">{entry.date}</p>
                  <p className="mt-1 text-gray-600">{entry.time}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminHistorico;
