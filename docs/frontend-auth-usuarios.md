# Etapa 05.2 — Serviços de autenticação e usuários

Os serviços de `src/services/api/` utilizam a camada HTTP da etapa 05.1.
**Não estão conectados ao login, layout, rotas ou componentes ativos.**
`src/services/usuarios.ts`, que usa Supabase, permanece intacto.

## Organização e configuração

| Arquivo | Responsabilidade |
| --- | --- |
| `auth.ts` | Operações autenticadas e último perfil confirmado em memória |
| `usuarios.ts` | Sete operações administrativas existentes na API |
| `responses.ts` | Validar envelopes e selecionar exclusivamente campos públicos |
| `index.ts` | Criar os dois serviços compartilhando o mesmo cliente HTTP/CSRF |
| `src/lib/api/contracts.ts` | DTOs reutilizados e novos tipos de entrada/estado |

Importar os serviços não lê configuração nem realiza requisições. A factory
`createBackendServices()` valida a origem configurada, mas também não faz HTTP.
Somente chamadas explícitas aos métodos consultam a API. Não há singleton
ativo, contexto React, listeners, navegação ou armazenamento persistente novo.

Utilizar `VITE_DNB_API_BASE_URL` conforme a
[documentação da camada HTTP](frontend-http.md). Nenhuma variável sensível ou
configuração local foi alterada nesta etapa. Nenhuma dependência foi adicionada.

Exemplo para a integração futura, sem senha fixa e ainda fora dos componentes:

```ts
import { createBackendServices } from '../services/api';
import type { LoginInput } from '../lib/api/contracts';

const services = createBackendServices(); // criar uma vez por origem da API

async function entrar(input: LoginInput, signal?: AbortSignal) {
  const usuario = await services.auth.login(input, signal);
  const estado = services.auth.getState();
  // A futura interface decide a navegação, inclusive a troca obrigatória.
  return { usuario, estado };
}
```

As factories individuais aceitam `ApiClient` para composição/testes. Ao usá-las,
compartilhar a mesma instância HTTP. Não criar clientes separados para login e
gestão de usuários: cada cliente mantém seu próprio cache CSRF em memória.

## Autenticação

| Método do serviço | Endpoint | Retorno |
| --- | --- | --- |
| `auth.login(input, signal?)` | POST `/api/auth/login` | UsuarioApi |
| `auth.logout(signal?)` | POST `/api/auth/logout` | `{ message }` |
| `auth.me(signal?)` | GET `/api/auth/me` | UsuarioApi |
| `auth.updateProfile({ nome }, signal?)` | PATCH `/api/auth/me` | UsuarioApi |
| `auth.changePassword(input, signal?)` | POST `/api/auth/change-password` | `{ message }` |
| `auth.refreshCsrf(signal?)` | GET `/api/auth/csrf`, pelo gerenciador HTTP | `{ csrfToken }` |
| `auth.getState()` | Sem HTTP | Snapshot do último perfil confirmado |

Login envia somente `email` e `senha`. Atualização própria envia somente
`nome`, sem aceitar alteração de papel, e-mail ou status nesse endpoint.
Troca de senha envia `senha_atual` e `nova_senha`. A política de senha continua
sendo a do backend, com mínimo de oito caracteres, sem trim da credencial.

Os envelopes `{ usuario }` do transporte são desembrulhados para UsuarioApi.
O token retornado pelo login é adotado pelo cliente HTTP, sem ser acrescentado
ao perfil do serviço. Cookies HttpOnly continuam gerenciados pelo navegador.
Não há JWT, leitura de cookies ou gravação em localStorage/sessionStorage.

O estado público é um snapshot com `status` e `usuario`:

| status | Significado |
| --- | --- |
| unknown | A instância ainda não confirmou uma identidade |
| authenticated | Perfil confirmado, sem troca obrigatória pendente |
| password_change_required | Perfil confirmado com troca_senha_obrigatoria=true |
| anonymous | API confirmou encerramento/revogação ou ausência de sessão válida |

O cache armazena somente o perfil público; não conserva entradas de senha ou
CSRF. Retornos e snapshots são cópias, sem permitir alteração externa do cache.
Esse estado auxilia a interface futura e nunca substitui autorização no backend.

Fluxos contemplados:

1. Login e restauração por `me` reconhecem a troca obrigatória. A futura tela
   deverá priorizar alteração de senha e logout, sem conceder acesso normal.
2. Logout mantém o perfil enquanto aguarda a API e só retorna sucesso após
   receber uma resposta válida. Depois limpa o perfil e invalida CSRF pelo
   cliente existente. Se a API responder 401, limpa a identidade expirada, mas
   continua rejeitando a operação; não inventa confirmação de logout.
3. Troca de senha bem-sucedida muda o estado para anonymous: o backend revoga
   todas as sessões, limpa cookies e exige novo login. Nenhum novo login é
   executado automaticamente.
4. Um 401 de `me` ou atualização de perfil confirma perda da sessão e limpa o
   estado. Um 401 no login ou na troca de senha não provoca navegação global
   nem apaga o último perfil: senha atual incorreta também utiliza esse status.
5. Em falha de rede ou resposta inválida, não há sucesso fictício. O último
   perfil confirmado pode continuar no snapshot; isso não comprova que o cookie
   ainda seja válido. Reconciliar posteriormente por `me`, sem repetir mutações
   cujo resultado no servidor ficou incerto.

Login, logout e troca de senha simultâneos são recusados com ApiError de
invalid_request, sem enfileiramento. A futura interface deve desabilitar essas
ações enquanto aguarda. Respostas antigas de perfil não restauram identidade
após logout nem apagam um login mais recente. Leituras de perfil durante uma
transição são rejeitadas como cancelled.

## Gerenciamento administrativo

| Método do serviço | Endpoint | Entrada/retorno |
| --- | --- | --- |
| `usuarios.list(paginacao?, signal?)` | GET `/api/usuarios` | `{ limit?, offset? }` → `{ usuarios, limit, offset }` |
| `usuarios.get(id, signal?)` | GET `/api/usuarios/:id` | UUID → UsuarioApi |
| `usuarios.create(input, signal?)` | POST `/api/usuarios` | `{ nome, email, senha }` → UsuarioApi |
| `usuarios.update(id, input, signal?)` | PATCH `/api/usuarios/:id` | Dados/permissões → UsuarioApi |
| `usuarios.setStatus(id, input, signal?)` | PATCH `/api/usuarios/:id/status` | `{ ativo, senha_admin }` → UsuarioApi |
| `usuarios.resetPassword(id, input, signal?)` | POST `/api/usuarios/:id/reset-password` | `{ nova_senha, senha_admin }` → `{ message }` |
| `usuarios.revokeSessions(id, input, signal?)` | POST `/api/usuarios/:id/revoke-sessions` | `{ senha_admin }` → `{ message }` |

Cadastro envia exclusivamente nome, e-mail e senha: o backend determina papel
vendedor e troca obrigatória. Campos extras como papel, ativo ou senha_hash não
são encaminhados nesse fluxo. Não existe operação de exclusão física de conta.

Atualização comum aceita nome/e-mail. Quando `papel` é solicitado, o tipo
AtualizarUsuarioInput exige `senha_admin`. Isso é conservador: o backend só
exige a confirmação se o papel efetivamente mudar. Status, reset e revogação
também exigem senha administrativa nos tipos e payloads próprios.

UUID é validado como identificador e codificado antes de compor o caminho.
Sem paginação explícita, a API aplica seus padrões: limit=20 e offset=0.
O máximo atual é 100. Não há total ou temMais nesse endpoint; não inventar esses
campos na interface. E-mail único, último administrador ativo, senha válida e
todas as permissões definitivas continuam sendo verificados pelo backend.

Alterações administrativas não atualizam automaticamente o perfil em cache.
Mudar e-mail/papel, desativar ou revogar a própria conta pode invalidar a sessão
atual. A futura interface deverá revalidar `auth.me()` nesses casos e considerar
mudanças em outra aba; não há sincronização entre abas nesta etapa.

## Respostas, CSRF e erros

O mesmo cliente da etapa 05.1 faz serialização, cookies, CSRF e tratamento de
erros para os dois serviços. Não houve duplicação dessas regras. O login
rotaciona o token; `refreshCsrf` reutiliza a obtenção compartilhada. GETs comuns
não inicializam CSRF. Não há retry ou redirecionamento automático.

As respostas são verificadas quanto a envelope e tipos públicos. Apenas
`id`, `nome`, `email`, `papel`, `ativo`, `criado_em` e
`troca_senha_obrigatoria` saem na identidade; id e data permanecem strings.
Campos adicionais, incluindo hashes ou sessões, são descartados. Listas e
mensagens também são projetadas explicitamente. Resposta incompatível gera
ApiError invalid_response, sem expor o payload.

Erros HTTP preservam ApiError, inclusive 400/401/403/404/409/429 e 5xx. Um 409
pode significar e-mail duplicado ou proteção do último administrador; a mensagem
segura da infraestrutura não diferencia esses motivos. Retry-After depende
da exposição do header pelo CORS, conforme documentado na etapa 05.1.

Não foi encontrada incompatibilidade impeditiva com a API inspecionada. As
diferenças deliberadas são o desembrulho de usuário, o snapshot local e a
exigência de senha administrativa no tipo de toda solicitação explícita de papel.
Não há recuperação pública por e-mail ou operação administrativa adicional.

## Validação e próximos passos

Executar na raiz: `npm test`, `npm run typecheck`, `npm run build` e
`npm run lint`. Para lint do escopo: `npx --no-install eslint src/services/api
src/lib/api/contracts.ts tests/api/services.test.mjs`.

Os testes usam node:test e fetch simulado, com credenciais sintéticas geradas
para as fixtures. Cobrem todos os endpoints, CSRF compartilhado, perfil,
expiração, logout confirmado, troca de senha/obrigatória, payloads restritos,
paginação, erros, proteção de campos privados e concorrência de sessão.
Os testes de 403/409 verificam propagação das respostas simuladas; não
substituem os testes do backend para regras administrativas e transações.

Validação executada: 90 testes aprovados (45 da etapa 05.1 e 45 novos), sem
falhas, cancelados ou ignorados; TypeScript e build aprovados; ESLint do escopo
aprovado. O lint global mantém os mesmos cinco erros anteriores, um no
AdminCartas e quatro em arquivos do backend, sem alterações nesses arquivos.
O aviso de Browserslist desatualizado não impediu o build.

Próxima etapa: integrar contexto/telas e rotas em ambiente isolado, contemplando
troca obrigatória, perfil, falhas de sessão e menus por papel. A autorização de
uploads e a migração de identidade/dados precisam ser preparadas antes de
ativar o novo login no painel comercial. Nenhum componente foi migrado aqui.
