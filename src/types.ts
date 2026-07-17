export interface CreditProduct {
  id: string;
  name: string;
  description: string;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  gracePeriod: string;
  interestRate: string;
  requirements: string[];
  icon: string;
}

export interface TeamMember {
  name: string;
  position: string;
  image: string;
  bio: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  image: string;
  category: string;
}

export interface Imovel {
  id: string;
  titulo: string;
  tipo: string;
  preco: number;
  cidade: string;
  bairro: string;
  quartos: number;
  banheiros: number;
  vagas: number;
  area: number;
  descricao: string;
  imagem_url: string | null;
  imagens: string[];
  destaque: boolean;
}
