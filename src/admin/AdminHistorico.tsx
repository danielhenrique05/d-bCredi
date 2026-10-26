import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Search, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listarHistorico, type RegistroHistorico } from '../services/historico';

const acoes = {
  CREATE: 'Criou imóvel',
  UPDATE: 'Editou imóvel',
  DELETE: 'Excluiu imóvel',
};

const AdminHistorico = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [historyEntries, setHistoryEntries] = useState<RegistroHistorico[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [atualizacao, setAtualizacao] = useState(0);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro('');
    setHistoryEntries([]);
    setTemMais(false);
    listarHistorico(selectedDate, pagina)
      .then(({ registros, temMais: proximaPagina }) => {
        if (!ativo) return;
        setHistoryEntries(registros);
        setTemMais(proximaPagina);
      })
      .catch((error: unknown) => {
        if (ativo) setErro(error instanceof Error ? error.message : 'Erro ao carregar histórico.');
      })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [selectedDate, pagina, atualizacao]);

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
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => { setSelectedDate(event.target.value); setPagina(0); }}
                className="w-full rounded-[18px] border border-white/10 bg-slate-950/30 px-4 py-3 text-sm font-medium text-white outline-none transition focus:border-white/30 focus:bg-slate-950/40"
              />
            </div>
            <button type="button" onClick={() => { setSelectedDate(''); setPagina(0); }} className="text-left underline">
              Todas as datas
            </button>
          </label>
        </div>
      </section>

      <section className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-blue-700">
          <Search className="h-4 w-4" />
          {!selectedDate
            ? 'Alterações registradas, da mais recente para a mais antiga'
            : `Mostrando alterações de ${selectedDate.split('-').reverse().join('/')}`}
          <button type="button" disabled={loading} onClick={() => { setPagina(0); setAtualizacao((valor) => valor + 1); }} className="ml-auto underline disabled:opacity-50">
            Atualizar
          </button>
        </div>

        {loading && <p role="status" className="text-sm text-gray-500">Carregando histórico...</p>}
        {erro && <p role="alert" className="text-sm text-red-600">{erro} Use Atualizar para tentar novamente.</p>}
        {!loading && !erro && historyEntries.length === 0 && <p className="text-sm text-gray-500">Nenhum registro encontrado para este período.</p>}

        <div className="space-y-3">
          {historyEntries.map((entry) => (
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
                      <p className="font-semibold text-gray-900">{acoes[entry.acao]}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm">
                        {entry.entidade === 'imovel' ? 'Imóveis' : entry.entidade}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {entry.usuario_nome || entry.usuario_email || (entry.user_id ? 'Usuário não identificado' : 'Sistema')}
                      {entry.usuario_nome && entry.usuario_email ? ` · ${entry.usuario_email}` : ''}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">{entry.descricao}</p>
                    <p className="mt-1 break-all text-xs text-gray-400">ID do imóvel: {entry.entidade_id}</p>
                  </div>
                </div>

                <div className="min-w-[140px] rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-3 text-sm shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    Registrado
                  </div>
                  <p className="mt-2 font-semibold text-gray-900">{new Date(entry.criado_em).toLocaleDateString('pt-BR')}</p>
                  <p className="mt-1 text-gray-600">{new Date(entry.criado_em).toLocaleTimeString('pt-BR')}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!erro && <div className="mt-5 flex items-center justify-end gap-4 text-sm text-blue-700">
          <button type="button" disabled={loading || pagina === 0} onClick={() => setPagina((valor) => valor - 1)} className="disabled:opacity-40">Anterior</button>
          <span>Página {pagina + 1}</span>
          <button type="button" disabled={loading || !temMais} onClick={() => setPagina((valor) => valor + 1)} className="disabled:opacity-40">Próxima</button>
        </div>}
      </section>
    </div>
  );
};

export default AdminHistorico;
