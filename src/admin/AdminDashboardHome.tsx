import React from "react";
import {
  Building2,
  FileText,
  Star,
  TrendingUp,
  ArrowUpRight,
  Clock3,
  Plus,
} from "lucide-react";

const AdminDashboardHome: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Painel administrativo
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Visão geral
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Acompanhe os principais dados da sua vitrine imobiliária.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Novo imóvel
          </button>
        </div>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Imóveis */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 size={23} />
            </div>

            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              <TrendingUp size={13} />
              Ativos
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Imóveis publicados
          </p>

          <div className="mt-1 flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">--</span>

            <ArrowUpRight
              size={19}
              className="mb-1 text-slate-300"
            />
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Total cadastrado na plataforma
          </p>
        </div>

        {/* Destaques */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
              <Star size={23} />
            </div>

            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
              Destaques
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Imóveis em destaque
          </p>

          <div className="mt-1 flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">--</span>

            <ArrowUpRight
              size={19}
              className="mb-1 text-slate-300"
            />
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Imóveis atualmente destacados
          </p>
        </div>

        {/* Cartas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <FileText size={23} />
            </div>

            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-600">
              Cartas
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Cartas cadastradas
          </p>

          <div className="mt-1 flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">--</span>

            <ArrowUpRight
              size={19}
              className="mb-1 text-slate-300"
            />
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Total de cartas contempladas
          </p>
        </div>

        {/* Disponíveis */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Clock3 size={23} />
            </div>

            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              Disponíveis
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Cartas disponíveis
          </p>

          <div className="mt-1 flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">--</span>

            <ArrowUpRight
              size={19}
              className="mb-1 text-slate-300"
            />
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Disponíveis para negociação
          </p>
        </div>
      </div>

      {/* Segunda linha */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Valor dos imóveis */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Valor total dos imóveis
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                R$ --
              </h2>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp size={23} />
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 rounded-full bg-blue-600" />
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Soma dos valores dos imóveis cadastrados
          </p>
        </div>

        {/* Crédito das cartas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Crédito total em cartas
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                R$ --
              </h2>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <FileText size={23} />
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 rounded-full bg-violet-600" />
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Soma dos créditos das cartas cadastradas
          </p>
        </div>
      </div>

      {/* Área inferior */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Imóveis por categoria */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Imóveis por categoria
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Distribuição dos imóveis cadastrados
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Casas", value: "--" },
              { label: "Apartamentos", value: "--" },
              { label: "Terrenos", value: "--" },
              { label: "Comerciais", value: "--" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-slate-50 p-4"
              >
                <p className="text-xs font-medium text-slate-500">
                  {item.label}
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Atividade */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Clock3 size={20} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Atividade
              </h2>

              <p className="text-xs text-slate-400">
                Últimas atualizações
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex gap-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />

              <div>
                <p className="text-sm font-medium text-slate-700">
                  Sistema pronto
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Aguarde os dados do banco
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500" />

              <div>
                <p className="text-sm font-medium text-slate-700">
                  Histórico
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Será conectado posteriormente
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé do painel */}
      <div className="mt-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold">
              Painel administrativo
            </h2>

            <p className="mt-1 text-sm text-blue-100">
              Gerencie imóveis, cartas e informações da sua vitrine em um só lugar.
            </p>
          </div>

          <div className="rounded-xl bg-white/10 px-4 py-3 text-sm">
            Sistema administrativo
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardHome;