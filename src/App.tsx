import { Suspense, lazy, useEffect, useState } from 'react';
import { BarChart3, Building2, FileCog, Users } from 'lucide-react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
import PoliticaDePrivacidade from './components/PoliticaDePrivacidade';
import Avaliacoes from './components/Avaliacoes';
import NossasSolucoes from './components/nossassolucoes';

const AdminLogin = lazy(() => import('./admin/AdminLogin'));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));

const PublicSite = () => {
  const location = useLocation();
  // Se chegamos aqui vindo de outra rota (ex: /politica-de-privacidade)
  // que passou { state: { section: 'about' } }, já abrimos nessa seção.
  const secaoInicial =
    (location.state as { section?: string } | null)?.section ?? 'home';

  const [currentSection, setCurrentSection] = useState(secaoInicial);
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
        return (
          <>
            <Hero onSectionChange={handleSectionChange} />
            <NossasSolucoes onSectionChange={handleSectionChange} />
            <Avaliacoes />
          </>
        );
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
    { label: 'Usuarios ativos', value: '128', icon: Users },
    { label: 'Fluxos em analise', value: '24', icon: FileCog },
    { label: 'Operacoes do mes', value: '312', icon: BarChart3 },
    { label: 'Imoveis publicados', value: '18', icon: Building2 },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <article
          key={label}
          className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-sm text-gray-500">{label}</p>
          <strong className="mt-2 block text-3xl font-semibold tracking-tight text-gray-900">
            {value}
          </strong>
        </article>
      ))}
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
        <Route path="/" element={<PublicSite />} />
        
        <Route path="/admin" element={<AdminLogin />} />
        
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardHome />} />
          
          <Route path="/admin/cartas" element={<AdminCartas />} />
          
          <Route path="/admin/imoveis" element={<AdminImoveis />} />
        </Route>

        <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
