import React, { useState } from 'react';
import { Menu, MessageCircle, Phone, X } from 'lucide-react';
import Logo from '../imgs/d&blogo.png';

interface HeaderProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
}

const menuItems = [
  { id: 'home', label: 'Início' },
  { id: 'about', label: 'Sobre Nós' },
  { id: 'products', label: 'Consignado e Consórcios' },
  { id: 'cartas', label: 'Cartas Contempladas' },
  { id: 'imoveis', label: 'Imóveis' },
  { id: 'simulator', label: 'Simulador' },
];

const Header: React.FC<HeaderProps> = ({ currentSection, onSectionChange }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSectionChange = (section: string) => {
    onSectionChange(section);
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-lg">
      <div className="bg-blue-700 py-2 text-white">
        <div className="container mx-auto flex items-center justify-between px-4 text-sm">
          <a href="tel:+554999103430" className="flex items-center gap-2 hover:text-yellow-200">
            <Phone className="h-4 w-4" /> +55 49 9910-3430
          </a>
          <a href="https://wa.me/554999103430" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-yellow-200">
            <MessageCircle className="h-4 w-4" /> Atendimento via WhatsApp
          </a>
        </div>
      </div>

      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img className="h-16 w-18" src={Logo} alt="d&b Credi" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">d&b Credi</h1>
              <p className="text-sm text-gray-600">O crédito que você precisa</p>
            </div>
          </div>

          <div className="hidden items-center space-x-8 md:flex">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSectionChange(item.id)}
                className={`font-medium transition-colors ${currentSection === item.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => setIsMenuOpen((current) => !current)} className="rounded-lg p-2 hover:bg-gray-100 md:hidden" aria-label="Abrir menu">
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="mt-4 border-t border-gray-200 pb-4 pt-3 md:hidden">
            <div className="flex flex-col gap-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSectionChange(item.id)}
                  className={`rounded-lg px-4 py-2 text-left ${currentSection === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
