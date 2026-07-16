# 🏢 d&bCredi

> Um sistema moderno de gerenciamento de imóveis e cartas de crédito, desenvolvido com uma arquitetura segura e interface de alta performance.

---

## 📌 Sobre o Projeto

Este projeto foi desenvolvido para resolver a necessidade de [inserir o objetivo aqui, ex: uma empresa de consultoria imobiliária que precisa gerenciar sua vitrine de imóveis e propostas de cartas de crédito]. O sistema conta com uma área pública para os clientes e um painel administrativo protegido para os gestores.

### 🚀 Principais Funcionalidades
* **Vitrine Pública:** Visualização de imóveis disponíveis e simulador de cartas de crédito.
* **Painel Admin:** Área restrita para cadastro, edição e exclusão de imóveis (CRUD completo).
* **Autenticação Segura:** Login administrativo integrado ao serviço de autenticação do Supabase.
* **Segurança Avançada (RLS):** Banco de dados protegido no nível de linha (Row Level Security), impedindo acessos maliciosos diretamente no frontend.

---

## 🛠️ Tecnologias Utilizadas

O projeto foi construído utilizando as melhores práticas do mercado com as seguintes tecnologias:

| Tecnologia | Função no Projeto |
| :--- | :--- |
| **React + Vite** | Framework Frontend e ambiente de desenvolvimento rápido |
| **TypeScript** | Tipagem estática para maior segurança no código |
| **Tailwind CSS** | Estilização moderna, responsiva e utilitária |
| **Supabase** | Backend-as-a-Service (Autenticação, Banco Postgres e RLS) |
| **Lucide React** | Pacote de ícones minimalistas e modernos |
| **React Router** | Gerenciamento de rotas SPA e proteção de caminhos |

---

## 🔒 Arquitetura de Segurança

Atendendo a critérios rigorosos de segurança em aplicações SPA (Single Page Application):
1. **Row Level Security (RLS):** Todas as tabelas do PostgreSQL possuem políticas ativas onde apenas o usuário administrador autenticado possui permissões de escrita (`INSERT`, `UPDATE`, `DELETE`), enquanto a leitura (`SELECT`) é pública.
2. **Variáveis de Ambiente:** Chaves de API de desenvolvimento e produção isoladas via arquivos `.env` e gerenciadas de forma segura na hospedagem.

---

## 📦 Como Executar o Projeto Localmente

1. Clone o repositório:
   ```bash
   git clone [https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git](https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git)