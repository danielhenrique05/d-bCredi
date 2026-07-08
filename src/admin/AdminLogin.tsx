import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';

  const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(hasSupabaseConfig);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setIsCheckingSession(false);
      return;
    }

    const checkSession = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      setIsCheckingSession(false);
    };

    void checkSession();
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Preencha seu e-mail e sua senha para continuar.');
      return;
    }

    if (!hasSupabaseConfig) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    const supabase = getSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('Credenciais invalidas ou acesso nao autorizado.');
      setIsLoading(false);
      return;
    }

    navigate('/admin/dashboard', { replace: true });
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/15 px-5 py-4 text-sm text-white backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validando acesso...
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.22),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.16),_transparent_30%)]" />

      <div className="relative w-full max-w-md rounded-[28px] border border-blue-100 bg-white/95 p-8 shadow-[0_30px_80px_rgba(30,64,175,0.28)] backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-700 text-white shadow-lg shadow-blue-300/50">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-700">
            Painel Administrativo
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
            Acesse sua conta
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Entre para gerenciar conteudo, acessos e operacoes internas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">E-mail</span>
            <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
              <Mail className="h-4 w-4 text-blue-500" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@empresa.com"
                autoComplete="email"
                className="w-full bg-transparent py-3.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Senha</span>
            <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
              <LockKeyhole className="h-4 w-4 text-blue-500" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                className="w-full bg-transparent py-3.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>
          </label>

          {error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-75"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
