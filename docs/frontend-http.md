# Etapa 05.1 — Camada HTTP do frontend

A infraestrutura de `src/lib/api/` está pronta para a API Node.js independente.
**Nenhum componente ou serviço ativo foi conectado a ela.** O site continua
usando Supabase Auth, consultas Supabase, Storage e a integração antiga de cartas.
Importar os módulos ou criar um cliente não realiza requisições.

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `config.ts` | Origem explícita, restrições de produção, caminhos e query |
| `client.ts` | GET/POST/PATCH/DELETE, JSON, cookies e ciclo CSRF |
| `csrf.ts` | Token em memória, obtenção compartilhada, renovação e invalidação |
| `errors.ts` | ApiError com mensagens seguras e espera cancelável |
| `contracts.ts` | DTOs de autenticação, usuários, imóveis, histórico e cartas |

Não há contexto de autenticação, interceptor de navegação ou serviço de domínio
novo. Os modelos Supabase existentes não foram alterados.

## Configuração

Definir **a origem absoluta, sem `/api` no final**, em variável pública do Vite:

```dotenv
# Somente no ambiente de desenvolvimento
VITE_DNB_API_BASE_URL=http://127.0.0.1:3000
```

Adicionar somente essa variável ao arquivo de ambiente apropriado, preservando
as configurações existentes. Não sobrescrever `.env` ou `.env.local`. O novo
`.env.example` mantém o valor vazio para evitar destino ou ativação implícitos.
Reiniciar o Vite após editar variáveis; produção exige novo build no ambiente
correto porque essas variáveis são incorporadas ao bundle.

Em produção, usar uma origem HTTPS real, por exemplo
`https://api.seu-dominio.example`, substituindo o domínio ilustrativo. HTTP,
localhost, loopback e endereço não especificado são recusados nesse modo.
Credenciais na URL, paths, query e fragmentos também são recusados. Não existe
fallback para localhost, origem do site ou função da Vercel. Sem configuração,
`createApiClient()` lança ApiError de configuração; o site ativo não importa
essa camada e continua funcionando como antes.

Essa variável não é segredo. Nunca colocar senhas, credenciais PostgreSQL ou
chaves privilegiadas do Storage em variáveis `VITE_*`. Os parâmetros `baseUrl`,
`production` e `fetchImpl` da factory permitem testes isolados; `production`
não pode desligar as proteções de um bundle Vite de produção.

Padronizar hostname local: frontend e API com `127.0.0.1`, ou ambos com
`localhost`. A API deve permitir a Origin exata em `AUTH_ALLOWED_ORIGINS`.
CORS sozinho não resolve cookies entre sites. HTTPS, SameSite e bloqueios de
cookies de terceiros deverão ser verificados na topologia final.

O proxy `/api/contemplados` em `vite.config.ts`, a função `api/contemplados.ts`
e `vercel.json` não foram alterados. A nova camada utiliza a origem explícita
do backend, sem encadear a função antiga. A vitrine atual continua fazendo a
chamada relativa anterior.

## Utilização futura

Exemplo para um serviço futuro, ainda não conectado aos componentes:

```ts
import { createApiClient } from '../lib/api/client';
import type { ImoveisResponse, LoginInput, LoginResponse } from '../lib/api/contracts';

const api = createApiClient(); // compartilhar uma instância por origem

export function consultarImoveis(signal?: AbortSignal) {
  return api.get<ImoveisResponse>('/api/imoveis', {
    signal,
    query: { limit: 20, offset: 0 },
  });
}

export function entrar(input: LoginInput, signal?: AbortSignal) {
  return api.post<LoginResponse>('/api/auth/login', input, { signal });
}
```

Os caminhos devem começar com `/api/`, sem URL absoluta, query ou fragmento
embutido. Usar `query` para parâmetros: null/undefined são omitidos, enquanto
zero e false são preservados. O destino não pode ser trocado pela requisição.

```ts
api.get<Resposta>(caminho, { query, signal });
api.post<Resposta>(caminho, corpo, { query, signal });
api.patch<Resposta>(caminho, corpo, { query, signal });
api.delete(caminho, { query, signal }); // Promise<void> por padrão
api.refreshCsrf(signal);              // obtenção explícita, sem mutação
api.clearCsrf();                      // limpa estado local; não faz logout
```

POST usa `{}` quando o corpo é omitido. DELETE envia JSON `{}`, conforme a
API de imóveis. `204` retorna undefined sem ler JSON; utilizar retorno void
para endpoints sem conteúdo. Outros sucessos devem conter JSON com media type
application/json ou application/*+json. HTML, JSON inválido ou corpo vazio
inesperado são erros de resposta.

O cliente é destinado a JSON, não a FormData/arquivos ou uploads em base64.
URLs assinadas de outros provedores precisarão de fluxo próprio. Corpos
circulares, BigInt, funções, símbolos e números não finitos são recusados antes
da rede. Valores decimais em strings não são arredondados.

Os DTOs preservam decimais, nulos, envelopes e BIGINT do histórico como string;
cartas continuam um array. A tipagem é estática: não substitui validação de
domínio em runtime. Esta etapa valida configuração, transporte e formato CSRF.

## Cookies e CSRF

Todas as chamadas usam `credentials: 'include'`, inclusive a obtenção CSRF.
O navegador gerencia cookies HttpOnly. O cliente não lê ou grava cookies,
não envia Authorization e não acessa localStorage/sessionStorage.

Antes de POST, PATCH ou DELETE, obtém `/api/auth/csrf` e envia X-CSRF-Token
com Content-Type application/json. GETs comuns não obtêm CSRF nem recebem esse
header. Origin é definido pelo navegador, sem tentativa de forjá-lo.

Obtenções simultâneas compartilham uma requisição. O cache existe somente na
memória da instância; após recarga, a primeira escrita obtém CSRF novamente,
com os cookies que o navegador ainda possuir. A renovação ocorre após nove
minutos, antes dos dez minutos do cookie anônimo do backend.

Login bem-sucedido adota o csrfToken retornado, pois o servidor rotaciona o
cookie. Login sem token válido é erro e invalida o cache. Logout e alteração
de senha também invalidam CSRF. Falhas nessas três operações invalidam o cache
por segurança: resposta incompleta não comprova se o cookie já mudou. Isso
não redireciona, limpa perfil ou inicia outro login.

Utilizar `refreshCsrf()` para renovação explícita. Evitar GET manual do endpoint
por fora do mecanismo: ele pode rotacionar o cookie sem atualizar o cache.
Outra aba também pode alterar o cookie. Um 403 não prova expiração de CSRF;
pode ser falta de permissão. Não há renovação seguida de reenvio automático.

Cancelar um consumidor que aguarda CSRF impede sua mutação sem cancelar os
demais consumidores. `clearCsrf()` cancela a obtenção compartilhada pendente e
impede que a resposta antiga volte ao cache. O AbortSignal da operação é
encaminhado ao fetch comercial. Cancelamento não desfaz operação já aceita
pelo servidor.

## Erros e limites

ApiError oferece `kind`, `status` e `retryAfterSeconds` opcional:

| kind | Situação |
| --- | --- |
| configuration | Origem ausente ou inválida |
| invalid_request | Caminho, query ou serialização inválidos |
| http | HTTP não bem-sucedido; mantém o status |
| invalid_response | Sucesso sem JSON esperado, JSON ou CSRF inválido |
| network | Fetch ou leitura do corpo falhou |
| cancelled | AbortSignal cancelado ou obtenção CSRF invalidada |

400, 401, 403, 404, 409, 429 e 5xx têm mensagens locais seguras. Corpos e
mensagens externas, causas de rede, URLs, senhas e tokens não são anexados ao
erro nem registrados em logs. Detalhes de negócio de um 409 não são repassados;
mensagens específicas dependerão do contrato de domínio futuro.

Nenhum 401 provoca navegação automática. Credenciais de login inválidas e senha
atual incorreta precisam ser tratadas pelo módulo que iniciou a chamada.
Não existem retries, backoff ou agendamento automático de mutações.

Retry-After numérico de um 429 é informado somente quando visível ao fetch.
O backend atual não expõe esse header em CORS; entre origens ele pode ficar
indisponível no navegador. A mensagem genérica permanece válida e o backend
não foi modificado nesta etapa.

Não há timeout automático: o consumidor pode fornecer AbortSignal, inclusive
AbortSignal.timeout(...) em navegadores compatíveis. Cookies, CORS e HTTPS
reais precisarão de testes em navegador quando as telas forem integradas.

## Testes e validação

Na raiz do frontend, com Node.js 22.14 ou superior:

```powershell
npm test
npm run typecheck
npm run build
npx --no-install eslint src/lib/api src/vite-env.d.ts tests/api
npm run lint
```

Os testes utilizam node:test, asserções nativas e fetch totalmente simulado.
Não abrem portas nem consultam Supabase, API real, PostgreSQL ou fornecedor.
Nenhuma dependência foi adicionada. O teste importa TypeScript por
`--experimental-strip-types`; o Node 22.14 emite o aviso experimental esperado.
Esse recurso é exclusivo dos testes. O build continua usando Vite.

A cobertura inclui origem, produção, query, métodos/credenciais, JSON/204,
erros HTTP/rede, ausência de retry, rotação/renovação/concorrência CSRF,
recarga, invalidação e cancelamentos antes e durante as chamadas.

O lint global já tinha cinco erros: um em `src/admin/AdminCartas.tsx` e quatro
em arquivos do backend. Eles não fazem parte desta alteração; o lint dos
arquivos novos deve passar. A entrega informa os resultados separadamente.

Validação executada nesta entrega: 45 testes aprovados, zero falhas ou testes
ignorados; `npm run typecheck` e `npm run build` aprovados; ESLint dos arquivos
novos aprovado. `npm run lint` permanece com os mesmos cinco erros anteriores.
O build também informou a base Browserslist desatualizada, sem impedir sua
conclusão; nenhuma dependência foi atualizada para tratar esse aviso.

Os serviços de autenticação e usuários da etapa 05.2 estão descritos em
[Serviços de autenticação e usuários](frontend-auth-usuarios.md), com cliente
HTTP/CSRF compartilhado. A migração coordenada das telas, autorização de imagens,
dados e roteamento permanece pendente. Nenhuma dessas etapas ativa o novo login
ou troca a fonte do catálogo nos componentes atuais.
