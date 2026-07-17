import React, { useEffect, useState } from 'react';
import { Bath, Bed, Car, MapPin, Phone, Search, Square } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import type { Imovel } from '../types';

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800';

interface ImoveisProps {
  onSelectImovel: (imovel: Imovel) => void;
}

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

const Imoveis: React.FC<ImoveisProps> = ({ onSelectImovel }) => {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buscarImoveis = async () => {
      setLoading(true);

      try {
        const { data, error } = await getSupabaseClient()
          .from('imoveis')
          .select('*')
          .order('destaque', { ascending: false });

        if (error) throw error;

        const imoveisFormatados: Imovel[] = (data ?? []).map((item) => ({
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
        }));

        setImoveis(imoveisFormatados);
      } catch (error) {
        console.error('Erro ao buscar imoveis:', error);
      } finally {
        setLoading(false);
      }
    };

    void buscarImoveis();
  }, []);

  return (
    <section className="bg-gray-50 py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold text-gray-800">Imoveis a Venda</h2>
          <p className="mx-auto max-w-3xl text-xl text-gray-600">
            Encontre o imovel perfeito para morar ou investir.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <p className="animate-pulse">Buscando imoveis no catalogo...</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {imoveis.length > 0 ? (
              imoveis.map((imovel) => {
                const imagemCapa = imovel.imagem_url || imovel.imagens?.[0] || FALLBACK_IMAGE;
                const localizacao = [imovel.bairro, imovel.cidade].filter(Boolean).join(', ');

                return (
                  <article
                    key={imovel.id}
                    className="group overflow-hidden rounded-xl bg-white shadow-md transition-shadow hover:shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectImovel(imovel)}
                      className="relative block h-64 w-full overflow-hidden text-left"
                    >
                      <img
                        src={imagemCapa}
                        alt={imovel.titulo}
                        onError={(event) => {
                          event.currentTarget.src = FALLBACK_IMAGE;
                        }}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {imovel.destaque && (
                        <span className="absolute left-4 top-4 rounded-lg bg-yellow-400 px-3 py-1 text-sm font-bold text-blue-900 shadow-lg">
                          Destaque
                        </span>
                      )}
                      <span className="absolute right-4 top-4 rounded-lg bg-blue-600 px-3 py-1 font-bold text-white shadow-lg">
                        {formatarMoeda(imovel.preco)}
                      </span>
                    </button>

                    <div className="p-6">
                      <p className="mb-2 text-sm font-semibold text-blue-600">{imovel.tipo}</p>
                      <h3 className="mb-2 text-xl font-bold text-gray-800">{imovel.titulo}</h3>
                      <p className="mb-4 line-clamp-2 text-sm text-gray-600">
                        {imovel.descricao || 'Descricao nao informada.'}
                      </p>

                      <div className="mb-4 flex items-center text-gray-600">
                        <MapPin className="mr-1 h-4 w-4 text-blue-600" />
                        <span className="text-sm">{localizacao || 'Localizacao nao informada'}</span>
                      </div>

                      <div className="mb-6 grid grid-cols-2 gap-3 border-y border-gray-100 py-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Bed className="h-5 w-5 text-gray-400" />
                          {imovel.quartos} quartos
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Bath className="h-5 w-5 text-gray-400" />
                          {imovel.banheiros} banheiros
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Car className="h-5 w-5 text-gray-400" />
                          {imovel.vagas} vagas
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Square className="h-5 w-5 text-gray-400" />
                          {imovel.area} m2
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => onSelectImovel(imovel)}
                          className="flex w-full items-center justify-center rounded-lg bg-blue-50 py-3 font-semibold text-blue-600 transition-colors hover:bg-blue-100"
                        >
                          <Search className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </button>

                        <a
                          href={`https://wa.me/554999103430?text=${encodeURIComponent(`Ola! Tenho interesse no imovel: ${imovel.titulo}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full items-center justify-center rounded-lg bg-green-600 py-3 font-semibold text-white transition-colors hover:bg-green-700"
                        >
                          <Phone className="mr-2 h-4 w-4" />
                          Tenho Interesse
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="col-span-full p-12 text-center text-gray-500">
                Nenhum imovel disponivel no momento.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default Imoveis;
