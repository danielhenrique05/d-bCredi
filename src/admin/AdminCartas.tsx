import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Home, Car, CheckCircle, Info, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';

const supabase = getSupabaseClient()

//tipagem carta
interface Carta {
  id: string; 
  tipo: 'imovel' | 'veiculo';
  numero: string;
  credito: number;
  entrada: number;
  parcelas: number;
  valorParcela: number; 
  admin: string;
  status: 'disponivel' | 'reservado';
}

const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const AdminCartas = () => {
  const [cartas, setCartas] = useState<Carta[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cartaEditando, setCartaEditando] = useState<Carta | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados do Formulário
  const [formData, setFormData] = useState<Omit<Carta, 'id'>>({
    tipo: 'imovel',
    numero: '',
    credito: 0,
    entrada: 0,
    parcelas: 0,
    valorParcela: 0,
    admin: '',
    status: 'disponivel'
  });

  // 1. CARREGAR CARTAS DO BANCO DE DADOS
  const carregarCartas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cartas_contempladas')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) {
      alert('Erro ao buscar cartas do banco: ' + error.message);
    } else if (data) {
      // Mapear snake_case do banco de dados para camelCase do componente do seu amigo
      const cartasMapeadas: Carta[] = data.map((item: any) => ({
        id: item.id,
        tipo: item.tipo,
        numero: item.numero,
        credito: Number(item.credito),
        entrada: Number(item.entrada),
        parcelas: item.parcelas,
        valorParcela: Number(item.valor_parcela), // Conversão
        admin: item.admin,
        status: item.status
      }));
      setCartas(cartasMapeadas);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarCartas();
  }, []);

  // Função para abrir o modal de Nova Carta
  const handleNovaCarta = () => {
    setCartaEditando(null);
    setFormData({
      tipo: 'imovel',
      numero: '',
      credito: 0,
      entrada: 0,
      parcelas: 0,
      valorParcela: 0,
      admin: '',
      status: 'disponivel'
    });
    setIsModalOpen(true);
  };

  // Função para abrir o modal de Edição
  const handleEditar = (carta: Carta) => {
    setCartaEditando(carta);
    setFormData({
      tipo: carta.tipo,
      numero: carta.numero,
      credito: carta.credito,
      entrada: carta.entrada,
      parcelas: carta.parcelas,
      valorParcela: carta.valorParcela,
      admin: carta.admin,
      status: carta.status
    });
    setIsModalOpen(true);
  };

  // 2. EXCLUIR CARTA NO SUPABASE
  const handleExcluir = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta carta?')) {
      const { error } = await supabase
        .from('cartas_contempladas')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Erro ao excluir: ' + error.message);
      } else {
        setCartas(cartas.filter(c => c.id !== id));
      }
    }
  };

  // 3. ALTERAR STATUS RAPIDAMENTE (DISPONÍVEL <-> RESERVADO) NO BANCO
  const toggleStatus = async (id: string, statusAtual: 'disponivel' | 'reservado') => {
    const novoStatus = statusAtual === 'disponivel' ? 'reservado' : 'disponivel';

    const { error } = await supabase
      .from('cartas_contempladas')
      .update({ status: novoStatus })
      .eq('id', id);

    if (error) {
      alert('Erro ao alterar status: ' + error.message);
    } else {
      setCartas(cartas.map(c => c.id === id ? { ...c, status: novoStatus } : c));
    }
  };

  // 4. SALVAR OU ATUALIZAR NO SUPABASE
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Mapear de volta camelCase do front para snake_case do banco de dados
    const dadosParaSalvar = {
      tipo: formData.tipo,
      numero: formData.numero,
      credito: formData.credito,
      entrada: formData.entrada,
      parcelas: formData.parcelas,
      valor_parcela: formData.valorParcela, // Convertido para o banco
      admin: formData.admin,
      status: formData.status
    };

    if (cartaEditando) {
      // Atualizar existente
      const { error } = await supabase
        .from('cartas_contempladas')
        .update(dadosParaSalvar)
        .eq('id', cartaEditando.id);

      if (error) {
        alert('Erro ao atualizar dados: ' + error.message);
      } else {
        setIsModalOpen(false);
        carregarCartas();
      }
    } else {
      // Criar nova
      const { error } = await supabase
        .from('cartas_contempladas')
        .insert([dadosParaSalvar]);

      if (error) {
        alert('Erro ao cadastrar carta: ' + error.message);
      } else {
        setIsModalOpen(false);
        carregarCartas();
      }
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Cabeçalho da Seção */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gerenciar Cartas Contempladas</h2>
          <p className="text-sm text-gray-500 mt-1">Adicione, edite ou remova cartas do sistema.</p>
        </div>
        <button 
          onClick={handleNovaCarta}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nova Carta
        </button>
      </div>

      {/* Tabela Administrativa */}
      <div className="overflow-x-auto">
        {loading && cartas.length === 0 ? (
          <div className="p-12 flex justify-center items-center text-gray-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" /> Sincronizando com o banco de dados...
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="p-4 font-semibold text-center w-16">Bem</th>
                <th className="p-4 font-semibold">Nº da Carta</th>
                <th className="p-4 font-semibold">Crédito</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cartas.map((carta) => (
                <tr key={carta.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-center">
                    {carta.tipo === 'imovel' ? (
                      <Home className="w-5 h-5 text-gray-400 mx-auto" />
                    ) : (
                      <Car className="w-5 h-5 text-gray-400 mx-auto" />
                    )}
                  </td>
                  <td className="p-4 font-medium text-gray-800">
                    {carta.numero}
                    <div className="text-xs text-gray-400 font-normal">{carta.admin}</div>
                  </td>
                  <td className="p-4 font-semibold text-blue-600">{formatarMoeda(carta.credito)}</td>
                  <td className="p-4">
                    <button 
                      onClick={() => toggleStatus(carta.id, carta.status)}
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit transition-all hover:opacity-80 ${
                        carta.status === 'disponivel' 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                      title="Clique para alterar o status"
                    >
                      {carta.status === 'disponivel' ? (
                        <><CheckCircle className="w-3 h-3" /> Disponível</>
                      ) : (
                        <><Info className="w-3 h-3" /> Reservada</>
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEditar(carta)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleExcluir(carta.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {cartas.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Nenhuma carta cadastrada no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">
                {cartaEditando ? 'Editar Carta Contemplada' : 'Nova Carta Contemplada'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="cartaForm" onSubmit={handleSalvar} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Tipo */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Bem</label>
                    <select 
                      value={formData.tipo}
                      onChange={(e) => setFormData({...formData, tipo: e.target.value as 'imovel' | 'veiculo'})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      <option value="imovel">Imóvel</option>
                      <option value="veiculo">Veículo</option>
                    </select>
                  </div>

                  {/* Número */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Número da Carta</label>
                    <input 
                      type="text" required
                      value={formData.numero}
                      onChange={(e) => setFormData({...formData, numero: e.target.value})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                      placeholder="Ex: 12345"
                    />
                  </div>

                  {/* Crédito */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Valor do Crédito (R$)</label>
                    <input 
                      type="number" required min="0" step="0.01"
                      value={formData.credito || ''}
                      onChange={(e) => setFormData({...formData, credito: Number(e.target.value)})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>

                  {/* Entrada */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Valor da Entrada (R$)</label>
                    <input 
                      type="number" required min="0" step="0.01"
                      value={formData.entrada || ''}
                      onChange={(e) => setFormData({...formData, entrada: Number(e.target.value)})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>

                  {/* Parcelas */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Qtd. Parcelas Restantes</label>
                    <input 
                      type="number" required min="1"
                      value={formData.parcelas || ''}
                      onChange={(e) => setFormData({...formData, parcelas: Number(e.target.value)})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>

                  {/* Valor Parcela */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Valor da Parcela (R$)</label>
                    <input 
                      type="number" required min="0" step="0.01"
                      value={formData.valorParcela || ''}
                      onChange={(e) => setFormData({...formData, valorParcela: Number(e.target.value)})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>

                  {/* Administradora */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Administradora</label>
                    <input 
                      type="text" required
                      value={formData.admin}
                      onChange={(e) => setFormData({...formData, admin: e.target.value})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                      placeholder="Ex: HS Consórcios"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Status Inicial</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as 'disponivel' | 'reservado'})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      <option value="disponivel">Disponível</option>
                      <option value="reservado">Reservada</option>
                    </select>
                  </div>

                </div>
              </form>
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="cartaForm"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar Carta
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCartas;