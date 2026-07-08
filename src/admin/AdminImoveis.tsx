import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, MapPin, Image as ImageIcon, Star, Building } from 'lucide-react';

interface Imovel {
  id: number;
  titulo: string;
  tipo: 'Casa' | 'Apartamento' | 'Terreno' | 'Comercial';
  preco: number;
  cidade: string;
  bairro: string;
  quartos: number;
  banheiros: number;
  vagas: number;
  area: number;
  descricao: string;
  destaque: boolean;
  imagens: string[];
}

const dadosIniciais: Imovel[] = [
  {
    id: 1,
    titulo: 'Casa de Alto Padrão no Centro',
    tipo: 'Casa',
    preco: 850000,
    cidade: 'Concórdia',
    bairro: 'Centro',
    quartos: 3,
    banheiros: 2,
    vagas: 2,
    area: 180,
    descricao: 'Linda casa com acabamento premium, área de festas e piscina.',
    destaque: true,
    imagens: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
  }
];

const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const AdminImoveis = () => {
  const [imoveis, setImoveis] = useState<Imovel[]>(dadosIniciais);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imovelEditando, setImovelEditando] = useState<Imovel | null>(null);

  const [formData, setFormData] = useState<Omit<Imovel, 'id'>>({
    titulo: '',
    tipo: 'Casa',
    preco: 0,
    cidade: '',
    bairro: '',
    quartos: 0,
    banheiros: 0,
    vagas: 0,
    area: 0,
    descricao: '',
    destaque: false,
    imagens: []
  });

  const handleNovo = () => {
    setImovelEditando(null);
    setFormData({
      titulo: '', tipo: 'Casa', preco: 0, cidade: '', bairro: '',
      quartos: 0, banheiros: 0, vagas: 0, area: 0, descricao: '', destaque: false, imagens: []
    });
    setIsModalOpen(true);
  };

  const handleEditar = (imovel: Imovel) => {
    setImovelEditando(imovel);
    setFormData({ ...imovel });
    setIsModalOpen(true);
  };

  const handleExcluir = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este imóvel?')) {
      setImoveis(imoveis.filter(i => i.id !== id));
    }
  };

  const handleToggleDestaque = (id: number) => {
    setImoveis(imoveis.map(i => i.id === id ? { ...i, destaque: !i.destaque } : i));
  };

  // Função para simular o upload de fotos no Front-end
  const handleUploadFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const novasFotos = Array.from(e.target.files).map(file => URL.createObjectURL(file));
      setFormData({ ...formData, imagens: [...formData.imagens, ...novasFotos] });
    }
  };

  const handleRemoverFoto = (index: number) => {
    const novasImagens = [...formData.imagens];
    novasImagens.splice(index, 1);
    setFormData({ ...formData, imagens: novasImagens });
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (imovelEditando) {
      setImoveis(imoveis.map(i => i.id === imovelEditando.id ? { ...formData, id: i.id } as Imovel : i));
    } else {
      const novoImovel = { ...formData, id: Date.now() } as Imovel;
      setImoveis([novoImovel, ...imoveis]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gerenciar Imóveis</h2>
          <p className="text-sm text-gray-500 mt-1">Adicione, edite fotos e detalhes do seu catálogo de imóveis.</p>
        </div>
        <button onClick={handleNovo} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Imóvel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
              <th className="p-4 font-semibold text-center w-20">Foto</th>
              <th className="p-4 font-semibold">Título e Localização</th>
              <th className="p-4 font-semibold">Preço</th>
              <th className="p-4 font-semibold text-center">Destaque</th>
              <th className="p-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {imoveis.map((imovel) => (
              <tr key={imovel.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 text-center">
                  {imovel.imagens.length > 0 ? (
                    <img src={imovel.imagens[0]} alt={imovel.titulo} className="w-14 h-14 object-cover rounded-lg mx-auto shadow-sm" />
                  ) : (
                    <div className="w-14 h-14 bg-gray-100 rounded-lg mx-auto flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="font-medium text-gray-800">{imovel.titulo}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {imovel.bairro}, {imovel.cidade} • {imovel.tipo}
                  </div>
                </td>
                <td className="p-4 font-semibold text-blue-600">{formatarMoeda(imovel.preco)}</td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => handleToggleDestaque(imovel.id)}
                    className={`p-2 rounded-full transition-colors ${imovel.destaque ? 'text-yellow-500 bg-yellow-50' : 'text-gray-300 hover:bg-gray-100'}`}
                    title={imovel.destaque ? 'Remover destaque' : 'Destacar na tela inicial'}
                  >
                    <Star className="w-5 h-5" fill={imovel.destaque ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleEditar(imovel)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleExcluir(imovel.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">{imovelEditando ? 'Editar Imóvel' : 'Novo Imóvel'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="imovelForm" onSubmit={handleSalvar} className="space-y-6">
                
                {/* Seção de Fotos */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Galeria de Fotos</h4>
                  
                  <div className="flex flex-wrap gap-4 mb-4">
                    {formData.imagens.map((img, index) => (
                      <div key={index} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                        <img src={img} alt="Preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => handleRemoverFoto(index)} className="absolute inset-0 bg-red-600/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="w-24 h-24 flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors">
                      <Plus className="w-6 h-6 text-gray-400" />
                      <span className="text-[10px] text-gray-500 mt-1">Adicionar</span>
                      <input type="file" multiple accept="image/*" onChange={handleUploadFotos} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Título do Anúncio</label>
                    <input type="text" required value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Ex: Lindo apartamento mobiliado..." />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
                    <select value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value as any})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none">
                      <option value="Casa">Casa</option>
                      <option value="Apartamento">Apartamento</option>
                      <option value="Terreno">Terreno</option>
                      <option value="Comercial">Comercial</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Preço de Venda (R$)</label>
                    <input type="number" required min="0" step="0.01" value={formData.preco || ''} onChange={(e) => setFormData({...formData, preco: Number(e.target.value)})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade</label>
                    <input type="text" required value={formData.cidade} onChange={(e) => setFormData({...formData, cidade: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro</label>
                    <input type="text" required value={formData.bairro} onChange={(e) => setFormData({...formData, bairro: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Quartos</label>
                      <input type="number" min="0" value={formData.quartos} onChange={(e) => setFormData({...formData, quartos: Number(e.target.value)})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Banheiros</label>
                      <input type="number" min="0" value={formData.banheiros} onChange={(e) => setFormData({...formData, banheiros: Number(e.target.value)})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Vagas</label>
                      <input type="number" min="0" value={formData.vagas} onChange={(e) => setFormData({...formData, vagas: Number(e.target.value)})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Área (m²)</label>
                      <input type="number" min="0" value={formData.area} onChange={(e) => setFormData({...formData, area: Number(e.target.value)})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                    <textarea rows={4} value={formData.descricao} onChange={(e) => setFormData({...formData, descricao: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none resize-none" placeholder="Descreva os diferenciais do imóvel..."></textarea>
                  </div>
                </div>
              </form>
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">Cancelar</button>
              <button type="submit" form="imovelForm" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">Salvar Imóvel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminImoveis;