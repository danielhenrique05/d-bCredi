import { useEffect, useState } from 'react';
import { Building2, Star } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';

const AdminDashboardHome = () => {
  const [stats, setStats] = useState({
    totalImoveis: 0,
    imoveisDestaque: 0,
    valorCarteira: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarStats = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from('imoveis').select('preco, destaque');

      if (data) {
        setStats({
          totalImoveis: data.length,
          imoveisDestaque: data.filter((i) => i.destaque).length,
          valorCarteira: data.reduce((soma, i) => soma + Number(i.preco || 0), 0),
        });
      }

      setLoading(false);
    };

    void carregarStats();
  }, []);

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

  const cards = [
    { label: 'Imóveis publicados', value: stats.totalImoveis, icon: Building2 },
    { label: 'Imóveis em destaque', value: stats.imoveisDestaque, icon: Star },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 text-white shadow-[0_24px_60px_rgba(30,64,175,0.18)]">
        <p className="text-sm font-medium text-blue-100">Valor total em carteira</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">
          {loading ? '...' : formatarMoeda(stats.valorCarteira)}
        </p>
        <p className="mt-2 text-sm text-blue-100">
          Somatório do preço de todos os imóveis cadastrados no sistema.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(({ label, value, icon: Icon }) => (
          <article
            key={label}
            className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm text-gray-500">{label}</p>
            <strong className="mt-2 block text-3xl font-semibold tracking-tight text-gray-900">
              {loading ? '...' : value}
            </strong>
          </article>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboardHome;