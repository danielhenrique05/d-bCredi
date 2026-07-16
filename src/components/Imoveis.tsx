import React, { useState, useEffect } from 'react';
import { MapPin, Bed, Bath, Square, Phone, Search } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase'; 
const supabase = getSupabaseClient()

interface Imovel {
  id: number;
  title: string;
  price: string;
  location: string;
  beds: number;
  baths: number;
  area: string;
  images: string[];
}

interface ImoveisProps {
  onSelectImovel: (imovel: Imovel) => void;
}

const Imoveis: React.FC<ImoveisProps> = ({ onSelectImovel }) => {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Buscar imóveis do Supabase
  useEffect(() => {
    const buscarImoveis = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('imoveis')
          .select('*');

        if (error) throw error;

        if (data) {
          // Garante que o formato vindo do Supabase bate com o que a interface espera
          const imoveisFormatados = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            location: item.location,
            beds: Number(item.beds),
            baths: Number(item.baths),
            area: item.area,
            // Caso as imagens venham como string JSON no banco, fazemos o parse
            images: typeof item.images === 'string' ? JSON.parse(item.images) : item.images
          }));
          setImoveis(imoveisFormatados);
        }
      } catch (err: any) {
        console.error('Erro ao buscar imóveis:', err.message);
      } finally {
        setLoading(false);
      }
    };

    buscarImoveis();
  }, []);

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Imóveis à Venda</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Encontre o imóvel perfeito para você morar ou investir, com as melhores condições de negociação.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <p className="animate-pulse">Buscando imóveis no catálogo...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {imoveis.length > 0 ? (
              imoveis.map((imovel) => (
                <div key={imovel.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow group">
                  <div className="relative h-64 cursor-pointer" onClick={() => onSelectImovel(imovel)}>
                    <img 
                      src={imovel.images && imovel.images[0] ? imovel.images[0] : 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800'} 
                      alt={imovel.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-4 right-4 bg-blue-600 text-white font-bold px-3 py-1 rounded-lg shadow-lg">
                      {imovel.price}
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{imovel.title}</h3>
                    
                    <div className="flex items-center text-gray-600 mb-4">
                      <MapPin className="w-4 h-4 mr-1 text-blue-600" />
                      <span className="text-sm">{imovel.location}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 border-t border-b border-gray-100 py-4 mb-6">
                      <div className="flex flex-col items-center">
                        <Bed className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-sm font-semibold text-gray-700">{imovel.beds} Quartos</span>
                      </div>
                      <div className="flex flex-col items-center border-l border-r border-gray-100">
                        <Bath className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-sm font-semibold text-gray-700">{imovel.baths} Banheiros</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Square className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-sm font-semibold text-gray-700">{imovel.area}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => onSelectImovel(imovel)}
                        className="w-full flex items-center justify-center bg-blue-50 text-blue-600 py-3 rounded-lg font-semibold hover:bg-blue-100 transition-colors"
                      >
                        <Search className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </button>

                      <a 
                        href={`https://wa.me/558881498642?text=Olá! Tenho interesse no imóvel: ${imovel.title}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Tenho Interesse
                      </a>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-12 text-center text-gray-500">
                Nenhum imóvel disponível no momento.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default Imoveis;