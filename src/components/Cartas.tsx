import React, { useState, useEffect } from 'react';
import { Home, Car, Eye, Filter, X, CheckCircle, Info } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase'; // Garanta que o caminho para o seu cliente do supabase está correto
const supabase = getSupabaseClient()

interface Carta {
  id: number;
  tipo: 'imovel' | 'veiculo';
  numero: string;
  credito: number;
  entrada: number;
  parcelas: number;
  valorParcela: number; // Certifique-se de que no seu banco está "valorParcela" ou "valor_parcela"
  admin: string;
  status: 'disponivel' | 'reservado';
}

const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const CartasContempladas: React.FC = () => {
  const [cartas, setCartas] = useState<Carta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'imovel' | 'veiculo'>('todos');
  const [exibirDisponiveis, setExibirDisponiveis] = useState(true);
  const [exibirReservadas, setExibirReservadas] = useState(true);
  
  // Estados para o filtro de valor (slider)
  const [valorSlider, setValorSlider] = useState<number>(1000000); 
  const [filtroCredito, setFiltroCredito] = useState<number>(1000000); 

  // Estado para o Modal (Janelinha)
  const [cartaSelecionada, setCartaSelecionada] = useState<Carta | null>(null);

  // Buscar cartas do Supabase
  useEffect(() => {
    const buscarCartas = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('cartas_contempladas')
          .select('*');

        if (error) throw error;
        
        if (data) {
          // Mapeia caso as colunas do banco usem snake_case (ex: valor_parcela para valorParcela)
          const cartasFormatadas = data.map((item: any) => ({
            id: item.id,
            tipo: item.tipo,
            numero: item.numero,
            credito: Number(item.credito),
            entrada: Number(item.entrada),
            parcelas: Number(item.parcelas),
            valorParcela: Number(item.valor_parcela || item.valorParcela),
            admin: item.admin,
            status: item.status
          }));
          setCartas(cartasFormatadas);
        }
      } catch (err: any) {
        console.error('Erro ao buscar cartas do banco:', err.message);
      } finally {
        setLoading(false);
      }
    };

    buscarCartas();
  }, []);

  // Filtragem dos dados
  const cartasFiltradas = cartas.filter(carta => {
    const passaFiltroTipo = filtroTipo === 'todos' || carta.tipo === filtroTipo;
    const passaFiltroStatus = 
      (carta.status === 'disponivel' && exibirDisponiveis) || 
      (carta.status === 'reservado' && exibirReservadas);
    
    // Filtra cartas com crédito menor ou igual ao selecionado
    const passaFiltroCredito = carta.credito <= filtroCredito;
    
    return passaFiltroTipo && passaFiltroStatus && passaFiltroCredito;
  });

  // Função para chamar o WhatsApp
  const handleNegociar = (numero: string, valor: number) => {
    const telefone = "554999103430";
    const texto = `Olá! Tenho interesse em negociar a carta contemplada Nº ${numero} no valor de ${formatarMoeda(valor)}.`;
    window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  return (
    <section className="py-20 bg-gray-50 min-h-screen relative">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-gray-800 mb-2 uppercase">Cartas <span className="border-b-4 border-blue-600 pb-1">Contempladas</span></h2>
          <p className="text-gray-600 mt-4">
            Valores anunciados somente para parceiros credenciados, entre em contato para mais detalhes.
          </p>
        </div>

        {/* Área de Filtros */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
            <Filter className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-800 text-lg">Filtros de Busca</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Tipo de Bem */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase">1. Tipo de Bem</label>
              <div className="flex bg-gray-100 rounded-lg p-1 w-fit border border-gray-200">
                <button 
                  onClick={() => setFiltroTipo('todos')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filtroTipo === 'todos' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setFiltroTipo('imovel')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${filtroTipo === 'imovel' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Home className="w-4 h-4" /> Imóveis
                </button>
                <button 
                  onClick={() => setFiltroTipo('veiculo')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${filtroTipo === 'veiculo' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Car className="w-4 h-4" /> Veículos
                </button>
              </div>
            </div>

            {/* Status de Disponibilidade */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase">2. Status</label>
              <div className="flex flex-col gap-3 mt-2">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${exibirDisponiveis ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 group-hover:border-blue-400'}`}>
                    {exibirDisponiveis && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input type="checkbox" className="hidden" checked={exibirDisponiveis} onChange={(e) => setExibirDisponiveis(e.target.checked)} />
                  <span className="text-gray-700 font-medium">Disponíveis</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${exibirReservadas ? 'bg-gray-500 border-gray-500' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                    {exibirReservadas && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input type="checkbox" className="hidden" checked={exibirReservadas} onChange={(e) => setExibirReservadas(e.target.checked)} />
                  <span className="text-gray-700 font-medium">Reservadas</span>
                </label>
              </div>
            </div>

            {/* Valor do Crédito */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-semibold text-gray-700 uppercase">3. Limite de Crédito</label>
                <span className="text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-100">
                  Até {formatarMoeda(valorSlider)}
                </span>
              </div>
              
              <div className="mt-4 mb-5">
                <input 
                  type="range" 
                  min="10000" 
                  max="2000000" 
                  step="5000"
                  value={valorSlider}
                  onChange={(e) => setValorSlider(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              
              <button 
                onClick={() => setFiltroCredito(valorSlider)}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm text-sm uppercase tracking-wide"
              >
                Aplicar Valor
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Cartas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <p className="animate-pulse">Carregando cartas contempladas...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4 font-bold text-center w-16">Bem</th>
                  <th className="p-4 font-bold text-center">Nº da Carta</th>
                  <th className="p-4 font-bold text-blue-600">Crédito</th>
                  <th className="p-4 font-bold">Entrada</th>
                  <th className="p-4 font-bold">Parcelas</th>
                  <th className="p-4 font-bold text-center">Administradora</th>
                  <th className="p-4 font-bold text-center w-40">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cartasFiltradas.length > 0 ? (
                  cartasFiltradas.map((carta) => (
                    <tr key={carta.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-4 text-center">
                        {carta.tipo === 'imovel' ? (
                          <div className="bg-blue-100 p-2 rounded-lg inline-block">
                            <Home className="w-5 h-5 text-blue-700" />
                          </div>
                        ) : (
                          <div className="bg-blue-100 p-2 rounded-lg inline-block">
                            <Car className="w-5 h-5 text-blue-700" />
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center font-bold text-gray-700">{carta.numero}</td>
                      <td className="p-4 font-extrabold text-blue-700 text-lg">{formatarMoeda(carta.credito)}</td>
                      <td className="p-4 text-gray-700 font-medium">{formatarMoeda(carta.entrada)}</td>
                      <td className="p-4 text-gray-600 text-sm">
                        <span className="font-bold text-gray-800">{carta.parcelas}x</span> de {formatarMoeda(carta.valorParcela)}
                      </td>
                      <td className="p-4 text-center text-gray-500 font-medium text-sm">
                        {carta.admin}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            onClick={() => setCartaSelecionada(carta)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-gray-50 rounded-lg hover:bg-blue-100" 
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {carta.status === 'disponivel' ? (
                            <button 
                              onClick={() => handleNegociar(carta.numero, carta.credito)}
                              className="w-full bg-green-500 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-green-600 transition-colors shadow-sm"
                            >
                              Negociar
                            </button>
                          ) : (
                            <button 
                              disabled
                              className="w-full bg-gray-100 text-gray-500 px-3 py-2 rounded-lg font-bold text-sm cursor-not-allowed border border-gray-200"
                            >
                              Reservada
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-500 bg-gray-50">
                      <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="font-medium text-lg">Nenhuma carta encontrada.</p>
                      <p className="text-sm mt-1">Tente ajustar os filtros de busca acima.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal / Janelinha de Detalhes */}
      {cartaSelecionada && (
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col transform transition-all">
            
            <div className="bg-blue-700 p-5 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  {cartaSelecionada.tipo === 'imovel' ? <Home className="w-6 h-6" /> : <Car className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-bold text-xl leading-tight">Carta #{cartaSelecionada.numero}</h3>
                  <p className="text-blue-200 text-sm">
                    {cartaSelecionada.tipo === 'imovel' ? 'Consórcio de Imóvel' : 'Consórcio de Veículo'} • {cartaSelecionada.admin}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCartaSelecionada(null)} 
                className="text-blue-200 hover:text-white bg-blue-600 hover:bg-blue-500 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-2 mb-6">
                {cartaSelecionada.status === 'disponivel' ? (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 border border-green-200">
                    <CheckCircle className="w-4 h-4" /> Disponível para Negociação
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 border border-gray-200">
                    <Info className="w-4 h-4" /> Carta Reservada
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Valor do Crédito</p>
                  <p className="font-black text-blue-700 text-xl">{formatarMoeda(cartaSelecionada.credito)}</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Valor da Entrada</p>
                  <p className="font-bold text-gray-800 text-xl">{formatarMoeda(cartaSelecionada.entrada)}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Quantidade</p>
                  <p className="font-bold text-gray-800 text-lg">{cartaSelecionada.parcelas} Parcelas</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Valor da Parcela</p>
                  <p className="font-bold text-gray-800 text-lg">{formatarMoeda(cartaSelecionada.valorParcela)}</p>
                </div>
              </div>

              {cartaSelecionada.status === 'disponivel' ? (
                <button 
                  onClick={() => {
                    handleNegociar(cartaSelecionada.numero, cartaSelecionada.credito);
                    setCartaSelecionada(null);
                  }}
                  className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-600 transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  Falar com um Consultor
                </button>
              ) : (
                <button 
                  disabled
                  className="w-full bg-gray-200 text-gray-500 py-4 rounded-xl font-bold text-lg cursor-not-allowed"
                >
                  Indisponível no Momento
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CartasContempladas;
