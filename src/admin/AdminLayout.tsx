import { useEffect, useState } from 'react';
import { LayoutDashboard, Loader2, LogOut, ShieldCheck, CreditCard } from 'lucide-react';
import { Navigate, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setIsLoading(false);
      return;
    }

    const loadSession = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      setSession(activeSession);
      setIsLoading(false);
    };

    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    void loadSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    navigate('/admin', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/15 px-5 py-4 text-sm text-white backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando área administrativa...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-blue-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                Ambiente Seguro
              </p>
              <h1 className="text-lg font-semibold text-gray-800">Admin Dashboard</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-right sm:block">
              <p className="text-xs uppercase tracking-[0.2em] text-blue-500">Usuário</p>
              <p className="text-sm font-medium text-gray-700">{session.user.email}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-[28px] bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-6 text-white shadow-xl">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Gestão administrativa</h2>
              <p className="mt-2 max-w-2xl text-sm text-blue-100">
                Seu acesso foi validado. Use este menu para navegar entre os módulos do sistema.
              </p>
            </div>
          </div>
        </section>

        {/* MENU DE NAVEGAÇÃO DO ADMIN */}
        <nav className="mb-8 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
          <Link
            to="/admin/dashboard"
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
              location.pathname === '/admin/dashboard'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Início
          </Link>
          
          <Link
            to="/admin/cartas"
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
              location.pathname === '/admin/cartas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Cartas Contempladas
          </Link>
        </nav>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;