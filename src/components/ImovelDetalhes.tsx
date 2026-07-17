import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bath, Bed, Car, ChevronLeft, ChevronRight, MapPin, Square } from 'lucide-react';
import type { Imovel } from '../types';

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800';

interface ImovelDetalhesProps {
  imovel: Imovel;
  onBack: () => void;
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const ImovelDetalhes: React.FC<ImovelDetalhesProps> = ({ imovel, onBack }) => {
  const [indexFoto, setIndexFoto] = useState(0);

  const imagens = useMemo(() => {
    const galeria = imovel.imagens ?? [];
    return imovel.imagem_url && !galeria.includes(imovel.imagem_url)
      ? [imovel.imagem_url, ...galeria]
      : galeria;
  }, [imovel.imagem_url, imovel.imagens]);

  const fotoAtual = imagens[indexFoto] ?? imovel.imagem_url ?? FALLBACK_IMAGE;
  const localizacao = [imovel.bairro, imovel.cidade].filter(Boolean).join(', ');

  useEffect(() => {
    setIndexFoto(0);
  }, [imovel.id]);

  const proximaFoto = () => {
    if (imagens.length <= 1) return;
    setIndexFoto((prev) => (prev === imagens.length - 1 ? 0 : prev + 1));
  };

  const fotoAnterior = () => {
    if (imagens.length <= 1) return;
    setIndexFoto((prev) => (prev === 0 ? imagens.length - 1 : prev - 1));
  };

  return (
    <section className="min-h-screen bg-white py-12">
      <div className="container mx-auto px-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-8 flex items-center font-bold text-blue-600 transition-transform hover:-translate-x-1"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Voltar para a vitrine
        </button>

        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="group relative mb-4 h-[500px] overflow-hidden rounded-3xl bg-gray-200 shadow-xl">
              <img
                src={fotoAtual}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_IMAGE;
                }}
                className="h-full w-full object-cover transition-all duration-500"
                alt={`Foto de ${imovel.titulo}`}
              />

              {imagens.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={fotoAnterior}
                    aria-label="Foto anterior"
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md transition-all group-hover:opacity-100 md:opacity-0"
                  >
                    <ChevronLeft className="h-6 w-6 text-gray-800" />
                  </button>
                  <button
                    type="button"
                    onClick={proximaFoto}
                    aria-label="Proxima foto"
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md transition-all group-hover:opacity-100 md:opacity-0"
                  >
                    <ChevronRight className="h-6 w-6 text-gray-800" />
                  </button>
                  <div className="absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
                    {indexFoto + 1} / {imagens.length}
                  </div>
                </>
              )}
            </div>

            {imagens.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {imagens.map((imagem, index) => (
                  <button
                    key={`${imovel.id}-${imagem}-${index}`}
                    type="button"
                    onClick={() => setIndexFoto(index)}
                    className={`h-24 overflow-hidden rounded-xl border-2 transition-all ${
                      indexFoto === index
                        ? 'scale-95 border-blue-600'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={imagem}
                      className="h-full w-full object-cover"
                      alt={`Miniatura ${index + 1} de ${imovel.titulo}`}
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-12 rounded-3xl bg-gray-50 p-8">
              <h3 className="mb-6 text-2xl font-bold">Sobre este imovel</h3>
              <p className="text-lg leading-relaxed text-gray-600">
                {imovel.descricao || 'Descricao nao informada.'}
              </p>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-28 rounded-3xl border border-gray-100 bg-white p-8 shadow-2xl">
              <p className="mb-2 text-sm font-semibold text-blue-600">{imovel.tipo}</p>
              <h1 className="mb-4 text-3xl font-bold text-gray-800">{imovel.titulo}</h1>
              <div className="mb-4 flex items-center text-gray-600">
                <MapPin className="mr-2 h-5 w-5 text-blue-600" />
                {localizacao || 'Localizacao nao informada'}
              </div>
              <div className="mb-8 text-4xl font-black text-blue-600">
                {formatarMoeda(imovel.preco)}
              </div>

              <div className="mb-8 space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                  <span className="flex items-center text-gray-500"><Bed className="mr-2 h-5 w-5" />Quartos</span>
                  <span className="font-bold">{imovel.quartos}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                  <span className="flex items-center text-gray-500"><Bath className="mr-2 h-5 w-5" />Banheiros</span>
                  <span className="font-bold">{imovel.banheiros}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                  <span className="flex items-center text-gray-500"><Car className="mr-2 h-5 w-5" />Vagas</span>
                  <span className="font-bold">{imovel.vagas}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                  <span className="flex items-center text-gray-500"><Square className="mr-2 h-5 w-5" />Area</span>
                  <span className="font-bold">{imovel.area} m2</span>
                </div>
              </div>

              <a
                href={`https://wa.me/554999103430?text=${encodeURIComponent(`Interesse no imovel: ${imovel.titulo}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-2xl bg-green-600 py-4 text-center text-xl font-bold text-white shadow-lg transition-all hover:bg-green-700"
              >
                Tenho Interesse
              </a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default ImovelDetalhes;
