import React, { useEffect, useState } from 'react';
import { Edit2, Image as ImageIcon, Loader2, MapPin, Plus, Star, Trash2, X } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import type { Imovel } from '../types';

type ImovelFormData = Omit<Imovel, 'id' | 'imagem_url'>;

const criarFormData = (): ImovelFormData => ({
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
  imagens: [],
});

const normalizarImagens = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((imagem): imagem is string => typeof imagem === 'string' && imagem.length > 0);
  }

  if (typeof value === 'string' && value.length > 0) {
    try {
      return normalizarImagens(JSON.parse(value));
    } catch {
      return [];
    }
  }

  return [];
};

const numero = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const AdminImoveis = () => {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imovelEditando, setImovelEditando] = useState<Imovel | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<ImovelFormData>(criarFormData);

  const carregarImoveis = async () => {
    setLoading(true);

    const { data, error } = await getSupabaseClient()
      .from('imoveis')
      .select('*')
      .order('destaque', { ascending: false });

    if (error) {
      alert(`Erro ao carregar imoveis: ${error.message}`);
    } else {
      setImoveis(
        (data ?? []).map((item) => ({
          id: String(item.id),
          titulo: item.titulo ?? '',
          tipo: item.tipo ?? '',
          preco: numero(item.preco),
          cidade: item.cidade ?? '',
          bairro: item.bairro ?? '',
          quartos: numero(item.quartos),
          banheiros: numero(item.banheiros),
          vagas: numero(item.vagas),
          area: numero(item.area),
          descricao: item.descricao ?? '',
          imagem_url: item.imagem_url ?? null,
          imagens: normalizarImagens(item.imagens),
          destaque: Boolean(item.destaque),
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    void carregarImoveis();
  }, []);

  const handleNovo = () => {
    setImovelEditando(null);
    setFormData(criarFormData());
    setIsModalOpen(true);
  };

  const handleEditar = (imovel: Imovel) => {
    setImovelEditando(imovel);
    setFormData({
      titulo: imovel.titulo,
      tipo: imovel.tipo,
      preco: imovel.preco,
      cidade: imovel.cidade,
      bairro: imovel.bairro,
      quartos: imovel.quartos,
      banheiros: imovel.banheiros,
      vagas: imovel.vagas,
      area: imovel.area,
      descricao: imovel.descricao,
      destaque: imovel.destaque,
      imagens: imovel.imagens,
    });
    setIsModalOpen(true);
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este imovel?')) return;

    const { error } = await getSupabaseClient().from('imoveis').delete().eq('id', id);

    if (error) {
      alert(`Erro ao deletar: ${error.message}`);
      return;
    }

    setImoveis((current) => current.filter((imovel) => imovel.id !== id));
  };

  const handleToggleDestaque = async (imovel: Imovel) => {
    const destaque = !imovel.destaque;
    const { error } = await getSupabaseClient()
      .from('imoveis')
      .update({ destaque })
      .eq('id', imovel.id);

    if (error) {
      alert(`Erro ao atualizar destaque: ${error.message}`);
      return;
    }

    setImoveis((current) =>
      current.map((item) => (item.id === imovel.id ? { ...item, destaque } : item))
    );
  };

  const handleUploadFotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    const novasUrls: string[] = [];

    for (const file of files) {
      const fileExtension = file.name.split('.').pop() ?? 'jpg';
      const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExtension}`;
      const filePath = `imoveis/${fileName}`;
      const supabase = getSupabaseClient();

      const { error: uploadError } = await supabase.storage.from('fotos-imoveis').upload(filePath, file);

      if (uploadError) {
        alert(`Erro no upload da foto ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from('fotos-imoveis').getPublicUrl(filePath);
      novasUrls.push(publicUrlData.publicUrl);
    }

    setFormData((current) => ({ ...current, imagens: [...current.imagens, ...novasUrls] }));
    setUploading(false);
    event.target.value = '';
  };

  const handleRemoverFoto = (index: number) => {
    setFormData((current) => ({
      ...current,
      imagens: current.imagens.filter((_, imagemIndex) => imagemIndex !== index),
    }));
  };

  const handleSalvar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const dadosParaSalvar = {
      titulo: formData.titulo.trim(),
      tipo: formData.tipo,
      preco: numero(formData.preco),
      cidade: formData.cidade.trim(),
      bairro: formData.bairro.trim(),
      quartos: numero(formData.quartos),
      banheiros: numero(formData.banheiros),
      vagas: numero(formData.vagas),
      area: numero(formData.area),
      descricao: formData.descricao.trim(),
      imagens: formData.imagens,
      imagem_url: formData.imagens[0] || null,
      destaque: formData.destaque,
    };

    const query = imovelEditando
      ? getSupabaseClient().from('imoveis').update(dadosParaSalvar).eq('id', imovelEditando.id)
      : getSupabaseClient().from('imoveis').insert([dadosParaSalvar]);

    const { error } = await query;

    if (error) {
      alert(`Erro ao salvar imovel: ${error.message}`);
    } else {
      setIsModalOpen(false);
      setImovelEditando(null);
      setFormData(criarFormData());
      await carregarImoveis();
    }

    setLoading(false);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gerenciar Imoveis</h2>
          <p className="mt-1 text-sm text-gray-500">Adicione, edite fotos e detalhes do catalogo.</p>
        </div>
        <button
          type="button"
          onClick={handleNovo}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Novo Imovel
        </button>
      </div>

      <div className="overflow-x-auto">
        {loading && imoveis.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" /> Carregando catalogo...
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-600">
                <th className="w-20 p-4 text-center font-semibold">Foto</th>
                <th className="p-4 font-semibold">Titulo e Localizacao</th>
                <th className="p-4 font-semibold">Preco</th>
                <th className="p-4 text-center font-semibold">Destaque</th>
                <th className="p-4 text-right font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {imoveis.map((imovel) => {
                const imagemCapa = imovel.imagem_url || imovel.imagens?.[0];

                return (
                  <tr key={imovel.id} className="transition-colors hover:bg-gray-50">
                    <td className="p-4 text-center">
                      {imagemCapa ? (
                        <img src={imagemCapa} alt={imovel.titulo} className="mx-auto h-14 w-14 rounded-lg object-cover shadow-sm" />
                      ) : (
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100">
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800">{imovel.titulo}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="h-3 w-3" /> {imovel.bairro}, {imovel.cidade} - {imovel.tipo}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-blue-600">{formatarMoeda(imovel.preco)}</td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleDestaque(imovel)}
                        className={`rounded-full p-2 transition-colors ${imovel.destaque ? 'bg-yellow-50 text-yellow-500' : 'text-gray-300 hover:bg-gray-100'}`}
                        title={imovel.destaque ? 'Remover destaque' : 'Destacar na tela inicial'}
                      >
                        <Star className="h-5 w-5" fill={imovel.destaque ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => handleEditar(imovel)} className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleExcluir(imovel.id)} className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
              <h3 className="text-lg font-bold text-gray-800">{imovelEditando ? 'Editar Imovel' : 'Novo Imovel'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <form id="imovelForm" onSubmit={handleSalvar} className="space-y-6">
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-800"><ImageIcon className="h-4 w-4" />Galeria de Fotos</h4>
                  <div className="mb-4 flex flex-wrap gap-4">
                    {formData.imagens.map((imagem, index) => (
                      <div key={`${imagem}-${index}`} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                        <img src={imagem} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                        <button type="button" onClick={() => handleRemoverFoto(index)} className="absolute inset-0 flex items-center justify-center bg-red-600/70 opacity-0 transition-opacity group-hover:opacity-100">
                          <Trash2 className="h-5 w-5 text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-blue-400 hover:bg-gray-50">
                      {uploading ? <Loader2 className="h-6 w-6 animate-spin text-blue-500" /> : <Plus className="h-6 w-6 text-gray-400" />}
                      <span className="mt-1 text-[10px] text-gray-500">{uploading ? 'Enviando...' : 'Adicionar'}</span>
                      <input type="file" multiple accept="image/*" disabled={uploading} onChange={handleUploadFotos} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700">Titulo do Anuncio</span><input type="text" required value={formData.titulo} onChange={(event) => setFormData((current) => ({ ...current, titulo: event.target.value }))} className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600" /></label>
                  <label className="block"><span className="mb-1 block text-sm font-semibold text-gray-700">Tipo</span><select value={formData.tipo} onChange={(event) => setFormData((current) => ({ ...current, tipo: event.target.value }))} className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600"><option value="Casa">Casa</option><option value="Apartamento">Apartamento</option><option value="Terreno">Terreno</option><option value="Comercial">Comercial</option></select></label>
                  <label className="block"><span className="mb-1 block text-sm font-semibold text-gray-700">Preco de Venda (R$)</span><input type="number" required min="0" step="0.01" value={formData.preco || ''} onChange={(event) => setFormData((current) => ({ ...current, preco: numero(event.target.value) }))} className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600" /></label>
                  <label className="block"><span className="mb-1 block text-sm font-semibold text-gray-700">Cidade</span><input type="text" required value={formData.cidade} onChange={(event) => setFormData((current) => ({ ...current, cidade: event.target.value }))} className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600" /></label>
                  <label className="block"><span className="mb-1 block text-sm font-semibold text-gray-700">Bairro</span><input type="text" required value={formData.bairro} onChange={(event) => setFormData((current) => ({ ...current, bairro: event.target.value }))} className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600" /></label>
                  <label className="block"><span className="mb-1 block text-sm font-semibold text-gray-700">Quartos</span><input type="number" min="0" value={formData.quartos} onChange={(event) => setFormData((current) => ({ ...current, quartos: numero(event.target.value) }))} className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600" /></label>
                  <label className="block"><span className="mb-1 block text-sm font-semibold text-gray-700">Banheiros</span><input type="number" min="0" value={formData.banheiros} onChange={(event) => setFormData((current) => ({ ...current, banheiros: numero(event.target.value) }))} className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600" /></label>
                  <label className="block"><span className="mb-1 block text-sm font-semibold text-gray-700">Vagas</span><input type="number" min="0" value={formData.vagas} onChange={(event) => setFormData((current) => ({ ...current, vagas: numero(event.target.value) }))} className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600" /></label>
                  <label className="block"><span className="mb-1 block text-sm font-semibold text-gray-700">Area (m2)</span><input type="number" min="0" step="0.01" value={formData.area} onChange={(event) => setFormData((current) => ({ ...current, area: numero(event.target.value) }))} className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600" /></label>
                  <label className="block md:col-span-2"><span className="mb-1 block text-sm font-semibold text-gray-700">Descricao</span><textarea rows={4} value={formData.descricao} onChange={(event) => setFormData((current) => ({ ...current, descricao: event.target.value }))} className="w-full resize-none rounded-lg border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-600" /></label>
                  <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:col-span-2"><input type="checkbox" checked={formData.destaque} onChange={(event) => setFormData((current) => ({ ...current, destaque: event.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><span className="text-sm font-semibold text-gray-700">Destacar este imovel na pagina inicial</span></label>
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 p-4">
              <button type="button" disabled={loading} onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-200">Cancelar</button>
              <button type="submit" form="imovelForm" disabled={loading || uploading} className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {imovelEditando ? 'Salvar Alteracoes' : 'Cadastrar Imovel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminImoveis;
