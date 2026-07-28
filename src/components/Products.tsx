import React from 'react';
import { CreditCard, Users, TrendingUp, Building  } from 'lucide-react';
import { creditProducts } from '../data/creditProducts';

interface ProductsProps {
  onSectionChange: (section: string) => void;
}

const Products: React.FC<ProductsProps> = ({ onSectionChange }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'CreditCard':
        return <CreditCard className="w-12 h-12 text-blue-600" />;
      case 'Users':
        return <Users className="w-12 h-12 text-green-600" />;
      case 'TrendingUp':
        return <TrendingUp className="w-12 h-12 text-yellow-600" />;
      case 'Building':
        return <Building className="w-12 h-12 text-purple-600" />;
      default:
        return <CreditCard className="w-12 h-12 text-blue-600" />;
    }
  };

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Nossas Linhas de Crédito</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Oferecemos soluções financeiras personalizadas para cada perfil e necessidade
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {creditProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
              <div className="p-8">
                <div className="mb-4">
                  {getIcon(product.icon)}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{product.name}</h3>
                <p className="text-gray-600 mb-4">{product.description}</p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Valor:</span>
                    <span className="font-semibold text-gray-700">
                      R$ {product.minAmount.toLocaleString()} - R$ {product.maxAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Prazo:</span>
                    <span className="font-semibold text-gray-700">
                      {product.minTerm} - {product.maxTerm} meses
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Taxa:</span>
                    <span className="font-semibold text-green-600">{product.interestRate}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Carência:</span>
                    <span className="font-semibold text-gray-700">{product.gracePeriod}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-700 mb-2">Documentos necessários:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {product.requirements.slice(0, 3).map((req, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        {req}
                      </li>
                    ))}
                    {product.requirements.length > 3 &&  (
                      <li className="text-blue-600 font-medium">
                        +{product.requirements.length - 3} outros documentos
                      </li>
                    )}
                  </ul>
                </div>
              </div>
              
              <div className="p-6 bg-gray-50 border-t">
                <button 
                  onClick={() => onSectionChange('contact')}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Fale com a gente
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 rounded-lg p-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Precisa de ajuda para escolher?</h3>
            <p className="text-gray-600 mb-6">
              Nossa equipe está pronta para ajudar você a encontrar a melhor solução de crédito
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => onSectionChange('contact')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Fale Conosco
              </button>
              <a 
                href="https://www.whatsapp.com/?lang=pt_BR" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Products;