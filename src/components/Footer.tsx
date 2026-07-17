import React from 'react';
import { Facebook, Instagram, MessageCircle, Phone } from 'lucide-react';
import Logo from '../imgs/d&blogo.png';

interface FooterProps {
  onSectionChange: (section: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onSectionChange }) => {
  return (
    <footer className="bg-gray-800 py-12 text-white">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <img className="h-16 w-16" src={Logo} alt="d&b Credi" />
              <div>
                <h3 className="text-xl font-bold">d&b Credi</h3>
                <p className="text-sm text-gray-400">O crédito que você precisa</p>
              </div>
            </div>
            <p className="mb-4 text-gray-400">
              Soluções financeiras inteligentes, seguras e acessíveis para transformar sonhos em conquistas.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/dbcrediconcordia" target="_blank" rel="noopener noreferrer" aria-label="Facebook da d&b Credi" className="text-gray-400 transition-colors hover:text-white"><Facebook className="h-5 w-5" /></a>
              <a href="https://www.instagram.com/dbcredi" target="_blank" rel="noopener noreferrer" aria-label="Instagram da d&b Credi" className="text-gray-400 transition-colors hover:text-white"><Instagram className="h-5 w-5" /></a>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">Links Rápidos</h4>
            <div className="flex flex-col gap-2">
              {[['home', 'Início'], ['about', 'Sobre Nós'], ['products', 'Consignado e Consórcios'], ['cartas', 'Cartas Contempladas'], ['imoveis', 'Imóveis'], ['simulator', 'Simulador']].map(([section, label]) => (
                <button key={section} type="button" onClick={() => onSectionChange(section)} className="text-left text-gray-400 transition-colors hover:text-white">{label}</button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">Nossos Valores</h4>
            <div className="space-y-2 text-gray-400">
              <p>Honestidade e transparência</p>
              <p>Compromisso e respeito</p>
              <p>Excelência no atendimento</p>
              <p>Fé, trabalho e dedicação</p>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">Atendimento</h4>
            <div className="space-y-3">
              <a href="tel:+554999103430" className="flex items-center gap-2 text-gray-400 transition-colors hover:text-white"><Phone className="h-4 w-4 text-blue-400" /> +55 49 9910-3430</a>
              <p className="text-sm text-gray-400">Fale com nossa equipe e encontre a solução ideal para seus planos.</p>
              <a href="https://wa.me/554999103430" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-gray-700 pt-8 text-center text-sm text-gray-400 md:flex-row md:items-center md:justify-between md:text-left">
          <div>
            <p>© {new Date().getFullYear()} d&b Credi. Todos os direitos reservados.</p>
            <p className="mt-1">d&b Credi | CNPJ: 28.125.510/0001-04</p>
          </div>
          <div className="md:text-right">
            <p>Atendimento: +55 49 9910-3430</p>
            <p className="mt-1">Crédito consciente para realizar seus objetivos.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
