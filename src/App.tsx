import { Suspense, lazy, useEffect, useState } from 'react';
import { ArrowRight, Building2, CreditCard, Clock3, Sparkles, UserRound } from 'lucide-react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Products from './components/Products';
import Cartas from './components/Cartas';
import Footer from './components/Footer';
import Imoveis from './components/Imoveis';
import ImovelDetalhes from './components/ImovelDetalhes';
import type { Imovel } from './types';
import AdminCartas from './admin/AdminCartas';
import AdminImoveis from './admin/AdminImoveis';
import AdminHistorico from './admin/AdminHistorico';

const AdminLogin = lazy(() => import('./admin/AdminLogin'));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));

const PublicSite = () => {
  const [currentSection, setCurrentSection] = useState('home');
  const [imovelSelecionado, setImovelSelecionado] = useState<Imovel | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentSection, imovelSelecionado]);

  const handleSectionChange = (section: string) => {
    setImovelSelecionado(null);
    setCurrentSection(section);
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'home':
        return <Hero onSectionChange={handleSectionChange} />;
      case 'about':
        return <About />;
      case 'products':
        return <Products onSectionChange={handleSectionChange} />;
      case 'imoveis':
        if (imovelSelecionado) {
          return (
            <ImovelDetalhes
              imovel={imovelSelecionado}
              onBack={() => setImovelSelecionado(null)}
            />
          );
        }
        return <Imoveis onSelectImovel={(imovel) => setImovelSelecionado(imovel)} />;
      case 'cartas':
        return <Cartas />;
      default:
        return <Hero onSectionChange={handleSectionChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentSection={currentSection} onSectionChange={handleSectionChange} />
      {renderSection()}
      <Footer onSectionChange={handleSectionChange} />
    </div>
  );
};

const AdminDashboardHome = () => {
  const stats = [
    {
      label: 'Imoveis publicados',
      value: '18',
      icon: Building2,
      detail: '3 em destaque',
      accent: 'from-amber-500 to-orange-500',
    },
    {
      label: 'Cartas contempladas',
      value: '46',
      icon: CreditCard,
      detail: 'Atualizadas hoje',
      accent: 'from-blue-500 to-indigo-600',
    },
  ];

  const historyItems = [
    {
      user: 'admin@teste.com',
      action: 'Editou imóvel',
      item: 'Casa Vila Nova',
      time: '27/07/2026 14:12',
      type: 'Imóvel',
    },
    {
      user: 'financeiro@empresa.com',
      action: 'Atualizou carta',
      item: 'Carta nº 1042',
      time: '27/07/2026 13:40',
      type: 'Carta',
    },
    {
      user: 'suporte@empresa.com',
      action: 'Publicou anúncio',
      item: 'Apartamento Jardim',
      time: '27/07/2026 12:15',
      type: 'Imóvel',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-blue-100 bg-gradient-to-br from-slate-900 via-blue-800 to-indigo-700 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Painel central atualizado
            </div>
            <h3 className="text-3xl font-semibold tracking-tight">
              Olá, admin. Tudo pronto para acompanhar o negócio.
            </h3>
            <p className="mt-3 text-sm text-blue-50/90">
              Monitore operações, usuários e imóveis em um só lugar com uma visão mais limpa e profissional.
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-blue-100">Status</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="font-medium">Sistema online</span>
            </div>
            <p className="mt-2 text-sm text-blue-50/80">Atualizado há 2 minutos</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {stats.map(({ label, value, icon: Icon, detail, accent }) => (
            <article
              key={label}
              className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">
                  {detail}
                </span>
              </div>
              <p className="text-sm text-gray-500">{label}</p>
              <strong className="mt-2 block text-3xl font-semibold tracking-tight text-gray-900">
                {value}
              </strong>
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <Link
            to="/admin/cartas"
            className="group flex items-center justify-between rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">Gerenciar cartas</p>
              <p className="mt-1 text-sm text-gray-500">Acompanhe contemplações e status.</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-100">
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            to="/admin/imoveis"
            className="group flex items-center justify-between rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">Gerenciar imóveis</p>
              <p className="mt-1 text-sm text-gray-500">Publique, edite e destaque anúncios.</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-100">
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        </div>
      </div>

      <section className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">Histórico de movimentações</h4>
            <p className="mt-1 text-sm text-gray-500">
              Registro visual para futuras integrações com o Supabase.
            </p>
          </div>
          <Link
            to="/admin/historico"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            <Clock3 className="h-4 w-4" />
            Ver histórico completo
          </Link>
        </div>

        <div className="space-y-3">
          {historyItems.map((item, index) => (
            <div
              key={`${item.user}-${index}`}
              className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{item.action}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm">
                      {item.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{item.item}</p>
                  <p className="mt-1 text-sm text-gray-500">{item.user}</p>
                </div>
              </div>

              <div className="text-sm text-gray-500 md:text-right">
                <p className="font-medium text-gray-700">{item.time}</p>
                <p className="mt-1">Registro de auditoria</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-600">
          Carregando...
        </div>
      }
    >
      <Routes>
        {/* Rotas Públicas */}
        <Route path="/" element={<PublicSite />} />
        
        {/* Login do Admin */}
        <Route path="/admin" element={<AdminLogin />} />
        
        {/* Rotas Protegidas do Painel Admin */}
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardHome />} />
          
          {/* Nossa nova rota para gerenciar as Cartas */}
          <Route path="/admin/cartas" element={<AdminCartas />} />
          
          {/* Nossa nova rota para gerenciar os Imóveis */}
          <Route path="/admin/imoveis" element={<AdminImoveis />} />
          <Route path="/admin/historico" element={<AdminHistorico />} />
        </Route>
        
        {/* Fallback para páginas não encontradas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
