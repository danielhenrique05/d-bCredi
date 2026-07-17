# 🏢 d-bCredi | Plataforma SaaS de Gestão de Imóveis

Uma solução moderna e de alta performance desenvolvida para imobiliárias e corretores autônomos gerenciarem seus portfólios de imóveis de forma simples, rápida e segura. O projeto conta com um portal público para clientes e um painel administrativo protegido para gerenciamento de anúncios.

---

## 🚀 Funcionalidades Principais

### 🌐 Portal Público (Área do Cliente)
* **Vitrine de Imóveis:** Listagem dinâmica de imóveis integrados em tempo real com o banco de dados.
* **Filtros Inteligentes:** Busca refinada por tipo, localização, preço, quantidade de quartos e área ($m^2$).
* **Imóveis em Destaque:** Seção dedicada para promover imóveis selecionados pelo administrador.

### 🔐 Painel Administrativo (Área do Corretor)
* **Controle de Acesso Seguro:** Autenticação via Supabase Auth (apenas administradores autorizados).
* **Cadastro Completo:** Formulário otimizado para inserção de títulos, descrições, preços, detalhes estruturais (quartos, banheiros, vagas, área) e localização.
* **Galeria de Fotos integrada:** Upload direto de imagens para o Supabase Storage com geração automática de capas de exibição (`imagem_url`).
* **Gerenciamento Ativo:** Opções para criar, editar, destacar ou excluir anúncios rapidamente.

---

## 🛠️ Tecnologias Utilizadas

O projeto foi construído utilizando o que há de mais moderno no desenvolvimento web para garantir velocidade e segurança:

* **Frontend:** React.js / Next.js com TypeScript e Tailwind CSS (para uma interface responsiva e elegante).
* **Backend como Serviço (BaaS):** [Supabase](https://supabase.com/) (Autenticação, Banco de Dados PostgreSQL e Storage de Imagens).
* **Hospedagem & Deploy:** [Vercel](https://vercel.com/) (Integração contínua e entrega global de conteúdo via CDN).

---

## 📦 Estrutura do Banco de Dados (PostgreSQL)

A tabela de `imoveis` no Supabase possui a seguinte estrutura de colunas otimizada para o sistema:

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `uuid` | Chave primária gerada automaticamente |
| `titulo` | `text` | Título comercial do anúncio |
| `tipo` | `text` | Tipo do imóvel (Ex: Casa, Apartamento, Terreno) |
| `preco` | `numeric` | Valor de venda em Reais (R$) |
| `cidade` | `text` | Cidade onde o imóvel está localizado |
| `bairro` | `text` | Bairro onde o imóvel está localizado |
| `quartos` | `integer` | Quantidade de quartos do imóvel |
| `banheiros` | `integer` | Quantidade de banheiros do imóvel |
| `vagas` | `integer` | Vagas de garagem |
| `area` | `numeric` | Metragem total do imóvel em $m^2$ |
| `descricao` | `text` | Detalhamento sobre o imóvel |
| `imagem_url` | `text` | URL da imagem principal (Capa) |
| `imagens` | `text[]` | Array de URLs das fotos (Galeria) |
| `destaque` | `boolean` | Define se o imóvel aparece na home (`true`/`false`) |
| `criado_em` | `timestamp` | Data de criação automática do registro |

---

## 🔧 Como Rodar o Projeto Localmente

### 1. Clonar o Repositório
```bash
git clone [https://github.com/seu-usuario/nome-do-repositorio.git](https://github.com/seu-usuario/nome-do-repositorio.git)
cd nome-do-repositorio