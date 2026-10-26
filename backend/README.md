# D&B Credi API

API independente do frontend React e do Supabase Auth atual. Node.js 22,
TypeScript estrito/NodeNext, Express 5, PostgreSQL e ES Modules. Os imports
relativos usam `.js`; a compilação gera `dist/`.

## Instalação e ambiente

No PowerShell, a partir da raiz do projeto:

```powershell
cd backend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edite seu `.env` local, sem versioná-lo. O exemplo não contém credenciais;
preencha `DB_PASSWORD` conforme o PostgreSQL instalado. Os scripts não
sobrescrevem o ambiente local. Banco e tabelas comerciais devem existir.

| Variável | Padrão/requisito |
| --- | --- |
| `NODE_ENV` | `development`; também aceita `test` e `production` |
| `PORT` | 3000 |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Obrigatórias; senha vazia somente se o PostgreSQL permitir |
| `AUTH_ALLOWED_ORIGINS` | Origens exatas separadas por vírgula; obrigatória e somente HTTPS em produção |
| `AUTH_SESSION_SECONDS` | 28800 (8 horas); entre 300 e 604800 |
| `AUTH_COOKIE_SAME_SITE` | `lax`; aceita `strict`; `none` exige produção/HTTPS |
| `AUTH_LOGIN_WINDOW_SECONDS` | 900 (15 minutos); entre 60 e 3600 |
| `AUTH_LOGIN_IP_LIMIT` | 50 tentativas por janela |
| `AUTH_LOGIN_ACCOUNT_LIMIT` | 10 tentativas por conta/janela |
| `TRUST_PROXY_HOPS` | 0; ajustar somente para a topologia real de proxy confiável |

As origens padrão locais são `localhost` e `127.0.0.1`, nas portas 5173 e 3000.
Use o mesmo hostname no navegador e na API; esses dois nomes são hosts
diferentes para cookies. Somente `backend/.env` é carregado, independentemente
da pasta de execução; variáveis do processo têm prioridade. Não são usados
`DATABASE_URL`, `VITE_*`, `db.js` ou conexão Supabase.

`.env` e suas variantes, logs, `node_modules/` e `dist/` são ignorados pelo Git;
`.env.example` é versionável.

## Migration explícita

Confira o banco configurado antes de executar:

```powershell
npm.cmd run db:migrate -- 2026102401_auth.sql
```

`src/database/migrations/2026102401_auth.sql` é transacional e reaplicável para
o mesmo esquema. Não roda no startup. Não cria usuários nem remove tabelas.

A migration já estava aplicada em `db_credi_dev` e seu esquema foi conferido
na auditoria de 24/10/2026, por consultas somente de leitura. Nesta auditoria
não foi aplicada migration nem alterada qualquer conta, senha ou dado local.

- `usuarios.troca_senha_obrigatoria`: booleano não nulo, padrão `false`.
  Cadastro administrativo e reset recebem `true`; troca pessoal volta a `false`.
- `sessoes`: UUID, FK `usuario_id -> usuarios.id` com `ON DELETE RESTRICT`,
  `token_hash` único, `criado_em`, `expira_em`, `revogada_em`. O hash é validado
  como 64 caracteres hexadecimais; expiração deve ser posterior à criação.
  Índices atendem usuário com sessões não revogadas e expiração.
- `auth_login_limites`: hash SHA-256 de IP/conta, contador e início da janela,
  com índice por janela. UPSERT atômico compartilha limites entre processos,
  sem Redis ou armazenamento de IP/e-mail em texto puro.
- As tabelas novas não concedem acesso a `PUBLIC`. Em produção, separar as
  contas PostgreSQL de migrations e de execução, com permissões adequadas.

A expiração é verificada em cada autenticação, sem depender de limpeza de
linhas. Não há exclusão automática. Definir retenção/manutenção das sessões
e limites antes da implantação. Os relacionamentos comerciais e a restrição
de ações do histórico são preservados.

O índice único `usuarios_email_unico ON lower(email)` protege contra conflitos
inclusive entre processos. A FK `imoveis.user_id -> usuarios.id` permanece com
`ON DELETE RESTRICT`. `historico` mantém sua PK e as ações `CREATE/UPDATE/DELETE`;
`user_id` não possui FK no esquema existente. Não foi adicionada restrição
retroativa: usuários não são excluídos fisicamente e o histórico conserva UUID,
nome e e-mail do responsável. O módulo apenas insere histórico; não introduz
consultas que exijam novos índices nessa tabela.

## Primeiro administrador

Após a migration, execute explicitamente:

```powershell
npm run admin:create
```

Nome e e-mail são solicitados no terminal; senha e confirmação não têm eco.
Para fornecer nome/e-mail por argumentos no PowerShell, use `npm.cmd` para
evitar a remoção de flags pelo wrapper `npm.ps1` observado neste ambiente:

```powershell
npm.cmd run admin:create -- --nome "Administrador Inicial" --email "admin@example.test"
```

Política de senha: 8 a 128 caracteres,
sem truncamento, sem senha apenas de espaços e sem NUL. A senha não é aparada
nem normalizada. Para gerenciador de segredos, há `--password-stdin`, somente
com entrada não interativa. Não passe senha em argumentos, `echo`, arquivos
versionados ou histórico de terminal.

No modo `--password-stdin`, nome/e-mail precisam estar nos argumentos e somente
a senha deve vir de stdin, em UTF-8, sem JSON. É removida apenas uma quebra de
linha final de transporte; espaços da senha são preservados. Substitua nome
e e-mail no exemplo abaixo. A senha é pedida sem exibi-la, não aparece no
comando e não recebe um valor fixo:

```powershell
$senhaSegura = Read-Host 'Senha do administrador (8 a 128 caracteres)' -AsSecureString
$credencialStdin = [PSCredential]::new('stdin', $senhaSegura)
try {
  $credencialStdin.GetNetworkCredential().Password |
    npm.cmd run admin:create -- --nome "SEU NOME" --email "seu-email@exemplo.com" --password-stdin
} finally {
  $senhaSegura.Dispose()
  Remove-Variable senhaSegura, credencialStdin
}
```

O bootstrap recusa e-mail conflitante e qualquer administrador preexistente,
inclusive inativo. Não promove contas existentes. Criação e histórico são
atômicos, sob lock que impede duas inicializações simultâneas. Não existe
cadastro público de admin, senha padrão ou criação automática no startup.

Administradores adicionais entram primeiro como vendedores e são promovidos
por um administrador autenticado, mediante confirmação de sua senha.

### Diagnóstico de erros do CLI

O CLI mostra campo, código e explicação controlada. Por exemplo:

```text
Administrador não criado.
- email [invalid_format]: Informe um e-mail válido.
```

Outros exemplos: `nome [too_small]`, `senha [too_small]`,
`DB_USER [missing_variable]` e `administrador [already_exists]`. Nome/e-mail
são validados antes de solicitar/ler a senha; o banco só é carregado depois
de toda a entrada ser válida. Sua importação dinâmica dentro do tratamento
do CLI também captura erros de configuração que antes escapavam do `try/catch`.

O diagnóstico Zod lê `issues`, pois os erros de campo não estão em `error.code`.
As variáveis de ambiente usam validador próprio. Mensagens não serializam
erros brutos, `issues.input`, valores recebidos, argumentos, stacks ou segredos.
A recusa de administrador existente não apaga nem promove contas.

## Recuperar a senha de um administrador local

O fluxo HTTP de reset existente exige outro administrador autenticado e sua
senha, e não redefine a própria conta. Quando a senha do primeiro administrador
for perdida, existe um procedimento **exclusivo do desenvolvimento local**:

```powershell
cd C:\Users\Daniel\Desktop\projetoCREDITO\backend
npm run admin:reset-password
```

Pré-requisitos em `backend/.env` ou no ambiente do processo:

- `NODE_ENV=development` explícito. `production`, `test` e valor ausente são recusados.
- `DB_NAME=db_credi_dev`.
- `DB_HOST` igual a `127.0.0.1`, `localhost` ou `::1`, com PostgreSQL local e
  as demais variáveis `DB_*` já configuradas. Não usar túnel ou proxy remoto.
- Migration de autenticação já aplicada; o comando não altera o esquema.

Além da configuração, verifica por leitura o banco real via `current_database()`
e o endereço real do servidor via `host(inet_server_addr())`. Rejeita outro
banco, endereço não local ou endereço não identificável. Repete a verificação
na conexão da transação que fará a alteração.

O procedimento exige um terminal interativo e não aceita argumentos, flags
de confirmação automática, senha por stdin ou senha por variável de ambiente:

1. Informe o e-mail da conta administrativa existente. O e-mail é normalizado
   para consulta e a conta deve possuir papel `admin`.
2. Digite a nova senha e a confirmação, ambas sem eco. Aplica a política
   existente de **8 a 128 caracteres**, sem senha apenas de espaços ou NUL.
3. Leia o aviso e digite exatamente **REDEFINIR** para autorizar a operação.
   Enter, outra resposta ou cancelamento não executam a redefinição.

Somente a senha e `troca_senha_obrigatoria=true` da conta selecionada são
atualizadas. UUID, nome, e-mail, papel, status, data de criação e relacionamentos
são preservados. Não cria contas, não promove vendedores e não reativa contas
desativadas. Conta inexistente ou sem papel admin é recusada antes de pedir senha.

Argon2id, validação, transação e repositórios já existentes são reutilizados.
A atualização, a revogação de todas as sessões anteriores dessa conta e o
registro `UPDATE` no histórico ocorrem na mesma transação. A conta é revalidada
sob o mesmo lock adotado no gerenciamento administrativo. Se ela mudar de
papel/e-mail durante a interação, o comando recusa a alteração. Se a auditoria
falhar, senha, indicador e revogações sofrem rollback.

O histórico identifica a conta recuperada e descreve explicitamente o uso do
CLI local; não representa uma troca autenticada pela API e não armazena senha,
hash, token ou dados da interação. Não é criado endpoint público de recuperação.

Após recuperar, entre na **API local** com a nova senha e altere-a novamente
pelo fluxo autenticado `/api/auth/change-password`, usando a senha recém
definida como `senha_atual`. A troca obrigatória limita o acesso até essa etapa;
a troca pessoal revoga as sessões e exige novo login. Isso não modifica a
autenticação Supabase utilizada pelo frontend React.

Implementação: `src/cli/reset-admin-password.ts`, `admin-reset-command.ts` e
`recover-admin-password.ts`, com o formatador seguro de erros compartilhado.
Não há nova dependência ou migration.

Os testes de `tests/admin-reset.test.ts` usam contas/sessões novas em
PostgreSQL/PGlite isolado em memória, senhas aleatórias, SQL, hash e transações
reais. Somente os metadados TCP de destino são simulados, pois PGlite não abre
conexões de rede. Cobrem ambiente, alvo configurado/real, confirmação, conta
inexistente/vendedora, validação, preservação de identidade, revogação seletiva,
troca obrigatória, concorrência com alteração da conta e rollback da auditoria.

O comando não foi executado contra a conta de desenvolvimento durante a
implementação. Foi feita somente a leitura dos metadados para confirmar que
a verificação do destino reconhece o PostgreSQL local, sem consultar ou alterar
senhas/contas. Execute-o manualmente quando desejar redefinir sua senha.

## Executar

```powershell
npm run dev
npm run build
npm start
```

`dev` usa `tsx watch`; `start` usa o JavaScript compilado. O bind continua em
`127.0.0.1` para desenvolvimento local. Ctrl+C/SIGTERM encerram HTTP e Pool
com prazo total de quatro segundos. O health HTTP não depende do banco.

### Inicialização e encerramento HTTP

`PORT` continua com padrão 3000 e validação inteira entre 1 e 65535. A API não
tenta outra porta nem encerra processos que estejam usando a porta configurada.
O log de disponibilidade é emitido exclusivamente no evento nativo `listening`.
No [Express 5](https://expressjs.com/en/guide/migrating-5/#app.listen), o callback
de `app.listen` também recebe erros; ignorar esse argumento era a causa do
sucesso falso antes de `EADDRINUSE`. O entrypoint agora usa `createServer(app)`
com listeners registrados antes de `listen`, sem mudar as rotas Express.

- `EADDRINUSE`: informa que a porta configurada está ocupada e termina com código 1.
- `EACCES`: informa falta de permissão para usar a porta e termina com código 1.
- Outras falhas, inclusive síncronas: mensagem segura e encerramento com código 1.
- `SIGINT`/`SIGTERM`: param novas conexões, aguardam requisições em andamento e
  encerram o pool. Repetições compartilham a mesma operação e o pool fecha uma
  única vez. Os listeners de sinal são removidos ao concluir a limpeza.

Se o bind falha ou o encerramento começa antes de `listening`, a API também
limpa os recursos e não anuncia disponibilidade. Não há consulta nem migration
no startup. Falhas no fechamento são tratadas sem rejeição não capturada;
se um recurso não fechar, o próprio processo termina com código 1. No prazo
máximo, conexões HTTP remanescentes são encerradas, o fechamento do pool é
solicitado e o próprio processo termina. Não há sinalização de processos externos.

O `tsx watch` instalado reinicia o processo ao alterar dependências ou pressionar
Enter e aguarda até cinco segundos antes de forçar sua saída. O prazo interno
de quatro segundos evita ultrapassar essa espera nas plataformas com sinais
cooperativos. Falha de bind encerra a instância da API; o watcher pode continuar
aguardando mudanças/Enter. Não é preciso alterar o script `dev`.

No Windows, `SIGTERM` enviado por outro processo não possui o mesmo comportamento
POSIX: a emulação pode encerrar o processo diretamente, sem executar handlers
JavaScript. Isso também pode ocorrer em reinícios do watcher. O teste real de
`tsx watch` confirmou liberação/reutilização da porta, mas não promete execução
dos hooks em término forçado. Os handlers foram testados por eventos emitidos
dentro de subprocessos isolados via IPC. Essa distinção segue a
[documentação de sinais do Node.js](https://nodejs.org/download/release/v22.18.0/docs/api/process.html#signal-events).

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod http://127.0.0.1:3000/api/health/db
```

O segundo executa somente `SELECT current_database() AS banco;`, retornando
200 com o banco real ou 503 genérico. Localmente espera-se `db_credi_dev`.

## Endpoints de autenticação, usuários e health

Respostas de autenticação/usuários usam `Cache-Control: no-store`. Campos
públicos: `id`, `nome`, `email`, `papel`, `ativo`, `criado_em` e
`troca_senha_obrigatoria`. `senha_hash` nunca é retornado.

| Método | Rota | Permissão / corpo JSON |
| --- | --- | --- |
| GET | `/api/health` | Público |
| GET | `/api/health/db` | Público |
| GET | `/api/auth/csrf` | Público; devolve `csrfToken`; prepara cookie pré-login quando não há cookie de sessão |
| POST | `/api/auth/login` | Público + CSRF; `email`, `senha` |
| POST | `/api/auth/logout` | Autenticado + CSRF; `{}` |
| GET | `/api/auth/me` | Autenticado |
| PATCH | `/api/auth/me` | Autenticado + CSRF; somente `nome` |
| POST | `/api/auth/change-password` | Autenticado + CSRF; `senha_atual`, `nova_senha` |
| GET | `/api/usuarios?limit=20&offset=0` | Admin; limite máximo 100 |
| GET | `/api/usuarios/:id` | Admin |
| POST | `/api/usuarios` | Admin + CSRF; `nome`, `email`, `senha`; cria somente vendedor |
| PATCH | `/api/usuarios/:id` | Admin + CSRF; `nome`, `email`, `papel` opcionais; mudança de papel exige `senha_admin` |
| PATCH | `/api/usuarios/:id/status` | Admin + CSRF; `ativo`, `senha_admin` |
| POST | `/api/usuarios/:id/reset-password` | Admin + CSRF; `nova_senha`, `senha_admin` |
| POST | `/api/usuarios/:id/revoke-sessions` | Admin + CSRF; `senha_admin` |

Corpos são estritos, sem campos desconhecidos. IDs devem ser UUID; e-mails
são validados, aparados e normalizados para minúsculas. O índice existente
em `lower(email)` garante unicidade inclusive em disputas. Não há exclusão
física de usuários. Vendedor não acessa dados de terceiros ou gerenciamento.

Com troca obrigatória, só é possível consultar perfil, sair e alterar senha;
a atualização do perfil e o gerenciamento ficam bloqueados, inclusive para
admins recuperados pelo CLI. Mudança pessoal de senha revoga
todas as sessões, inclusive a atual, exigindo novo login.

Reset administrativo exige senha do administrador, aplica senha temporária
forte, revoga sessões e exige troca no próximo login. A entrega deve ocorrer
por canal seguro fora da API; não há e-mail automático ou senha na resposta.
Para a própria conta, usar `change-password`. Desativação e mudança de
papel/e-mail também revogam sessões. Reativação não restaura sessões antigas.

| Papel | Acesso |
| --- | --- |
| `admin` ativo e sem troca pendente | Perfil próprio e gerenciamento de usuários; operações sensíveis exigem a senha atual do administrador |
| `vendedor` ativo e sem troca pendente | Perfil próprio, alteração apenas do nome, troca de senha e logout |
| Conta com troca pendente | Login, CSRF, consulta do próprio perfil, troca de senha e logout |
| Conta inativa | Não efetua login nem utiliza sessões anteriores |

O servidor consulta papel/status no banco; campos enviados pelo cliente não
concedem permissões. A criação HTTP aceita apenas `nome`, `email` e `senha` e
sempre cadastra vendedor com troca obrigatória. Promoção usa `PATCH` explícito
por admin com `senha_admin`. O último administrador ativo não pode ser
desativado nem rebaixado, mesmo com requisições concorrentes.

Fluxo do vendedor: admin cadastra a senha temporária e a entrega por canal
seguro; vendedor faz login, recebe `troca_senha_obrigatoria=true`, envia
`senha_atual`/`nova_senha` em `change-password` e efetua novo login. O perfil
passa a indicar `false`. O UUID e os relacionamentos são mantidos.

Login retorna 200 com `{ usuario, csrfToken }` e `Set-Cookie`. Não retorna token
de sessão no corpo. Demais operações retornam `{ usuario }`, `{ usuarios,
limit, offset }` ou `{ message }`; cadastro retorna 201. Erros usam `{ status:
"error", message }`: 400 para entrada inválida, 401 para credencial/sessão
inválida, 403 para permissão/CSRF/origem/troca pendente, 404 para recurso ausente,
409 para conflito/último admin, 413 para JSON acima de 16 KiB, 429 para limite de
login e 500 genérico para falha interna. Credencial incorreta, conta ausente e
conta inativa têm o mesmo 401 após validação do corpo e do CSRF.

## Cookies e CSRF

Sessões usam `randomBytes`, com token de 32 bytes (256 bits). Somente SHA-256
do token é persistido; hashes rápidos são apropriados a esses tokens de alta
entropia, não a senhas. Expiração absoluta padrão: oito horas. Papel e status
são consultados no banco a cada requisição.

Cookies são `HttpOnly`, sem `Domain`, `Path=/`, `SameSite=Lax` por padrão.
Em produção, sempre `Secure` e prefixo `__Host-`. Token de sessão não aparece
no JSON. O cookie pré-login dura dez minutos no navegador.

Obtenha `/api/auth/csrf`, mantenha o cookie e envie o valor retornado no header
`X-CSRF-Token`. É um HMAC-SHA-256 com a chave aleatória privada da sessão/cookie
pré-login e uma finalidade fixa, comparado em tempo constante. Login cria nova
sessão e devolve novo CSRF; o pré-login não serve na sessão autenticada. Após
recarregar a página, obtenha `/csrf` novamente para a sessão atual.

Mutações, inclusive login/logout, exigem `Origin` exato permitido, JSON e CSRF.
CLIs também precisam enviar `Origin`. Sua ausência é permitida somente nas
leituras. CORS permite credenciais exclusivamente para origens configuradas,
nunca `*`.

Exemplo PowerShell sem credenciais literais, com conta criada pelo CLI:

```powershell
$api = 'http://127.0.0.1:3000'
$headers = @{ Origin = $api }
$csrf = Invoke-RestMethod "$api/api/auth/csrf" -Headers $headers -SessionVariable sessao
$headers['X-CSRF-Token'] = $csrf.csrfToken
$credencial = Get-Credential -Message 'Credenciais da API local'
$corpo = @{ email = $credencial.UserName; senha = $credencial.GetNetworkCredential().Password } | ConvertTo-Json
$login = Invoke-RestMethod "$api/api/auth/login" -Method Post -Headers $headers -WebSession $sessao -ContentType 'application/json' -Body $corpo
$headers['X-CSRF-Token'] = $login.csrfToken
Invoke-RestMethod "$api/api/auth/me" -Headers $headers -WebSession $sessao
Invoke-RestMethod "$api/api/usuarios?limit=20" -Headers $headers -WebSession $sessao
Invoke-RestMethod "$api/api/auth/logout" -Method Post -Headers $headers -WebSession $sessao -ContentType 'application/json' -Body '{}'
Remove-Variable corpo, credencial, login, csrf
```

## Módulo 02: imóveis

Catálogo público e gerenciamento autenticado na tabela `imoveis` existente.
Arquivos: `src/modules/imoveis/imoveis.{routes,controller,service,repository,schema}.ts`.
Reutiliza sessões, Origin/CSRF, validação Zod, transação autorizada e tratamento
de erros. Não cria autenticação, upload ou estados de publicação adicionais.

### Auditoria e decisões

O esquema local foi inspecionado por consultas somente de leitura. Confirmados
os 17 campos, `preco`/`area` como `NUMERIC` sem precisão fixa, `imagens TEXT[]`,
campos opcionais nulos, UUID/data gerados no banco, PK e FK `user_id -> usuarios`
com `ON DELETE RESTRICT`. Não há trigger local de histórico nem tabelas com FK
para `imoveis`. O frontend e as migrations Supabase permitem leitura pública de
todos os anúncios; essa visibilidade foi preservada, inclusive para anúncios
antigos sem proprietário e sem destaque.

O painel atual usa `auth.users`, filtra pelo proprietário para vendedores,
permite destaque e exclusão física e utiliza Supabase Storage. A nova API usa
`usuarios.id`, obtido da sessão local. Nenhum vínculo Supabase foi migrado.

Mantida exclusão física: ela corresponde ao comportamento atual e não possui
dependentes no esquema inspecionado. Histórico independente sobrevive ao DELETE.
Caso exista uma FK impeditiva no futuro, a API responde 409 sem expor nomes SQL.
Os códigos SQLSTATE de FK/RESTRICT são tratados conforme a
[documentação PostgreSQL](https://www.postgresql.org/docs/18/errcodes-appendix.html).

### Endpoints de imóveis

| Método | Rota | Acesso / resposta |
| --- | --- | --- |
| GET | `/api/imoveis` | Público; `{ imoveis, limit, offset }` |
| GET | `/api/imoveis/gestao` | Autenticado; admin vê todos, vendedor somente próprios |
| GET | `/api/imoveis/:id` | Público; `{ imovel }` |
| POST | `/api/imoveis` | Admin ou vendedor; 201 `{ imovel }` |
| PATCH | `/api/imoveis/:id` | Admin ou proprietário; 200 `{ imovel }` |
| DELETE | `/api/imoveis/:id` | Admin ou proprietário; JSON `{}` e 204 sem corpo |

POST/PATCH/DELETE exigem sessão válida, conta ativa, troca de senha já concluída,
Origin permitido e `X-CSRF-Token`, conforme o login documentado acima. Gestão
também bloqueia troca pendente. Admin pode gerenciar anúncios sem dono;
vendedor não pode. Não há associação automática de registros antigos.

Ausência/expiração/revogação de sessão retorna 401; CSRF, origem e troca pendente
retornam 403; UUID/campos inválidos retornam 400. Na escrita, imóvel alheio e
inexistente retornam o mesmo 404, preservando uma resposta segura. Erros internos
usam 500 genérico; conflito com registros relacionados usa 409.

`user_id`, `id` e `criado_em` são proibidos nos corpos, inclusive para admins.
O cadastro sempre pertence ao usuário da sessão. Na transação, a API consulta
novamente sessão, status, papel e troca obrigatória e bloqueia o imóvel com
`FOR UPDATE` antes de validar propriedade e persistir. Reutiliza o lock de
usuários existente para impedir que revogação/desativação/mudança de papel
concorra com autorização antiga; avaliar granularidade apenas se o volume exigir.

Consultas públicas e respostas de criação/edição omitem `user_id` e quaisquer
dados privados do usuário. Somente `/gestao` inclui o UUID do proprietário para
o painel autenticado; não inclui nome, e-mail ou credenciais. As rotas usam
`Cache-Control: no-store` e CORS com credenciais apenas para origens permitidas.

### Campos e precisão decimal

| Campo | Entrada |
| --- | --- |
| `titulo` | Obrigatório; texto aparado de 1 a 200 caracteres |
| `tipo` | Obrigatório; `Casa`, `Apartamento`, `Terreno` ou `Comercial` |
| `preco` | Obrigatório; decimal não negativo, até 15 dígitos inteiros e 2 casas |
| `cidade`, `bairro` | Obrigatórios; textos aparados de 1 a 120 caracteres |
| `quartos`, `banheiros`, `vagas` | Opcionais/nulos; inteiros JSON entre 0 e 2147483647 |
| `area` | Opcional/nula; decimal estritamente positivo, mesmos limites do preço |
| `descricao` | Opcional/nula; até 10000 caracteres; aceita vazio e quebras de linha |
| `imagem_url` | Opcional/nula; URL absoluta HTTP(S), até 2048 caracteres, sem credenciais embutidas |
| `imagens` | Opcional/nula; array de até 20 URLs com as mesmas regras |
| `destaque` | Opcional/nulo; booleano; omissão no cadastro recebe `false` |

No cadastro, demais opcionais omitidos recebem `null`. No PATCH, omissão
preserva o valor, `null` limpa campos anuláveis e `[]` limpa a galeria. Pelo
menos um campo atualizável é obrigatório. Campos desconhecidos são rejeitados.
O corpo JSON completo continua limitado a 16 KiB, mesmo se cada campo couber
no seu limite individual. Textos não aceitam NUL/caracteres de controle;
descrição permite tabulação e quebras de linha. Não há interpretação de HTML.

**Envie frações de `preco` e `area` como strings decimais**, por exemplo
`"350000.90"` e `"120.50"`. Não envie vírgulas, notação exponencial ou mais de
duas casas. Números JSON são aceitos somente se inteiros seguros, como `350000`;
frações JSON como `350000.90` são recusadas para evitar precisão já perdida no
parse. A API normaliza entradas para duas casas sem arredondamento e persiste
como `NUMERIC`. Respostas devolvem preço/área como strings exatas (área pode
ser nula), inclusive valores antigos com mais casas, que não são regravados
em PATCH de outro campo. Não há conversão financeira para `number` no backend.

### Listagem, filtros e paginação

Ambas as listagens aceitam os filtros abaixo. Nenhum filtro escolhe proprietário
nem muda o escopo protegido definido pela sessão.

| Query | Regra |
| --- | --- |
| `limit` | Padrão 20; de 1 a 100 |
| `offset` | Padrão 0; de 0 a 1000000 |
| `tipo` | Um dos quatro tipos do formulário |
| `cidade`, `bairro` | Igualdade ignorando caixa, mantendo acentos; `%`/`_` são literais |
| `preco_min`, `preco_max` | Limites inclusivos, formato decimal; mínimo não pode exceder máximo |
| `quartos` | Quantidade exata, inteira e não negativa |
| `destaque` | Somente `true` ou `false`; `false` também inclui destaque nulo |

Os filtros correspondem aos campos do catálogo e podem ser combinados. A ordem
é fixa: destaque verdadeiro primeiro (nulo equivale a falso), depois criação
mais recente e UUID decrescente como desempate. Não há nomes de colunas ou
ordenação livre enviados ao SQL. Alterações no catálogo entre requisições
podem deslocar páginas com offset; a paginação não cria um snapshot entre HTTPs.

```http
GET /api/imoveis?tipo=Casa&cidade=Conc%C3%B3rdia&preco_max=500000.00&limit=20&offset=0
GET /api/imoveis/gestao?destaque=true&limit=10
```

### Histórico e imagens

CREATE/UPDATE/DELETE gravam `entidade='imovel'`, UUID do anúncio, autor obtido
da sessão, ação, data e descrição curta com o título (até 160 caracteres).
Não copiam descrição livre, galeria, URLs, cookies, senhas ou tokens para o
histórico. Persistência e histórico usam a mesma transação. Falha na auditoria
reverte cadastro, edição ou exclusão. PATCH sem mudança real retorna o imóvel
sem UPDATE efetivo nem novo evento; comparações de NUMERIC e arrays são feitas
no PostgreSQL, sem comparar dinheiro em ponto flutuante.

`imagem_url` e `imagens` são referências independentes; a API não escolhe capa,
não consulta URLs, não faz upload/download e não remove arquivos ao excluir
anúncios ou referências. O React atual usa `imagem_url` ou a primeira imagem
como capa e faz upload no bucket Supabase `fotos-imoveis`. Essas dependências
permanecem. Planejar armazenamento e limpeza de arquivos em etapa futura.

### Exemplos e teste manual

Exemplo de corpo de cadastro; não contém credenciais:

```json
{
  "titulo": "Casa de demonstração",
  "tipo": "Casa",
  "preco": "350000.90",
  "cidade": "Concórdia",
  "bairro": "Centro",
  "quartos": 3,
  "banheiros": 2,
  "vagas": 1,
  "area": "120.50",
  "descricao": "Descrição do anúncio",
  "imagem_url": "https://images.example.test/capa.jpg",
  "imagens": ["https://images.example.test/capa.jpg"],
  "destaque": false
}
```

Resposta 201 tem `{ "imovel": { ... } }`, com os campos do anúncio, `id` UUID
e `criado_em` ISO gerados pelo PostgreSQL, preço/área em texto e sem `user_id`.
GET individual/PATCH usam o mesmo envelope; listagem contém `{ "imoveis": [],
"limit": 20, "offset": 0 }` quando vazia. DELETE retorna corpo vazio.

Exemplo de resposta 201 (identificador e data ilustrativos):

```json
{
  "imovel": {
    "id": "fd9c4e42-63a2-4eac-a21e-f0cc45d3ff30",
    "titulo": "Casa de demonstração",
    "tipo": "Casa",
    "preco": "350000.90",
    "cidade": "Concórdia",
    "bairro": "Centro",
    "quartos": 3,
    "banheiros": 2,
    "vagas": 1,
    "area": "120.50",
    "descricao": "Descrição do anúncio",
    "imagem_url": "https://images.example.test/capa.jpg",
    "imagens": ["https://images.example.test/capa.jpg"],
    "criado_em": "2026-10-24T18:00:00.000Z",
    "destaque": false
  }
}
```

No exemplo PowerShell de login acima, execute até a consulta do perfil e deixe
o logout para depois destes passos. Mantenha `$sessao`, `$api` e `$headers` com
o CSRF devolvido pelo login. Execute mutações somente quando desejar criar ou
alterar anúncios de fato; os testes automatizados usam bancos isolados.

```powershell
$dados = @{ titulo='Anúncio de demonstração'; tipo='Casa'; preco='350000.90'; cidade='Concórdia'; bairro='Centro'; area='120.50' } | ConvertTo-Json
$novo = Invoke-RestMethod "$api/api/imoveis" -Method Post -Headers $headers -WebSession $sessao -ContentType 'application/json' -Body $dados
$id = $novo.imovel.id
Invoke-RestMethod "$api/api/imoveis/$id"
Invoke-RestMethod "$api/api/imoveis/gestao" -Headers $headers -WebSession $sessao
Invoke-RestMethod "$api/api/imoveis/$id" -Method Patch -Headers $headers -WebSession $sessao -ContentType 'application/json' -Body '{"destaque":true}'
# Opcional: excluir somente o anúncio de demonstração recém-criado.
Invoke-RestMethod "$api/api/imoveis/$id" -Method Delete -Headers $headers -WebSession $sessao -ContentType 'application/json' -Body '{}'
```

Use sessões distintas para admin e vendedor. Com vendedor, cadastre um anúncio,
consulte gestão e edite o próprio. Em outra conta vendedora, a edição/exclusão
deve retornar 404; com admin, o gerenciamento é permitido. Uma conta recém-criada
precisa concluir a troca obrigatória antes desses passos. Não use dados reais
para reproduzir testes de exclusão ou falha de auditoria.

### Migration de índices e integração React

`2026102402_imoveis_indices.sql` adiciona somente dois índices B-tree:
`imoveis_catalogo_idx` (destaque/data/UUID) e
`imoveis_proprietario_catalogo_idx` (proprietário seguido da mesma ordem).
Atendem à paginação pública e à consulta por proprietário sem alterar tabela,
colunas, tipos, FKs ou registros. É transacional, reaplicável e não roda no startup.
Foi executada duas vezes nas fixtures isoladas, **não em `db_credi_dev`**.
Para aplicar explicitamente no ambiente configurado, depois de conferir `.env`:

```powershell
npm.cmd run db:migrate -- 2026102402_imoveis_indices.sql
```

O módulo funciona com o esquema existente; a migration acrescenta os índices
de acesso. Em tabelas grandes, programar a criação dos índices considerando
o lock de escrita temporário do `CREATE INDEX` transacional.

O frontend continua integralmente no Supabase. A integração posterior precisa
trocar as chamadas por HTTP com cookies/CSRF, usar `/gestao` no painel, remover
`user_id` dos corpos e consumir os envelopes JSON. Ajustar o tipo `Imovel` e
os formulários para decimais em texto; área zero atualmente enviada pelo React
deve virar nula quando ausente ou um valor positivo. Galerias são arrays reais,
não JSON dentro de strings; valores opcionais nulos precisam de apresentação
adequada. Manter Supabase Storage enquanto a infraestrutura de imagens não for
decidida. UUIDs locais de `usuarios` não são associados automaticamente a
`auth.users`. Não houve migração de contas, anúncios ou imagens nesta etapa.

### Arquivos e resultado da entrega do módulo 02

Criados: os cinco arquivos de `src/modules/imoveis/`, a migration
`src/database/migrations/2026102402_imoveis_indices.sql` e `tests/imoveis.test.ts`.
Modificados: `src/app.ts`, `src/shared/audit.ts`,
`src/middlewares/request-security.ts`, `src/middlewares/error-handler.ts`,
`tests/support.ts` e este README. Nenhuma dependência ou variável de ambiente
de execução foi adicionada. O teste nativo de imóveis usa apenas a variável
opcional `DNB_TEST_IMOVEIS_DATABASE`.

**Módulo 02 concluído para desenvolvimento local:** CRUD, consultas, validação,
permissões e auditoria implementados e testes aplicáveis aprovados. O frontend
permanece no Supabase; integração React e infraestrutura definitiva de imagens
são etapas futuras. Aplicação dos índices em desenvolvimento continua explícita,
conforme o comando acima; nenhum registro comercial foi alterado nesta entrega.

## Módulo 03: consulta do histórico

Consulta administrativa da tabela `historico` existente. Os cinco arquivos em
`src/modules/historico/` seguem routes/controller/service/repository/schema.
Reutiliza autenticação, autorização, transação autorizada, SQL parametrizado,
Zod, CORS e erros centralizados; o mecanismo de gravação `shared/audit.ts` e
os eventos dos módulos 01/02 não foram modificados.

### Auditoria, acesso e integridade

A inspeção local em 26/10/2026 foi somente de leitura: `id BIGINT`,
`user_id UUID` anulável, nome/e-mail anuláveis, ação/entidade/identificador/
descrição em texto e `criado_em TIMESTAMPTZ`. Confirmados o CHECK de ações
`CREATE/UPDATE/DELETE`, a PK, a ausência de FKs comerciais no histórico e os
valores existentes de entidade `usuario` e `imovel`. Havia apenas o índice
da PK; por isso há uma migration aditiva de índices para as novas consultas.
Nenhum dado de desenvolvimento foi modificado ou copiado para os testes.

| Método | Endpoint | Resposta |
| --- | --- | --- |
| GET | `/api/historico` | `{ registros, limit, offset, temMais }` |
| GET | `/api/historico/:id` | `{ registro }` |

O detalhe permite localizar um evento pelo seu ID sem percorrer páginas e
continua funcionando após a exclusão do recurso associado. Retorna os mesmos
campos persistidos da listagem; não fabrica diferenças antes/depois.

Ambos exigem **administrador ativo, sessão válida e sem troca obrigatória
pendente**. Ausência, expiração ou revogação da sessão e conta inativa retornam
401; vendedor ou troca pendente retornam 403. A sessão, o papel e o indicador
de troca são revalidados dentro da transação, usando a proteção existente
contra autorizações antigas. Não são aceitas permissões enviadas pelo cliente.

GET não exige CSRF. Mantém cookies/sessão, allowlist de Origin, CORS com
credenciais sem wildcard e `Cache-Control: no-store`. Nome/e-mail e demais
dados do histórico só são devolvidos após a autorização administrativa.
Entradas inválidas usam 400, evento inexistente usa 404 e falhas internas usam
500 genérico. Não existem POST/PATCH/DELETE para histórico; para um admin
autorizado, essas rotas retornam 404 conforme o padrão geral da API.

As consultas do repositório são SELECT com lista explícita dos dez campos.
Não fazem JOIN com imóveis ou com responsáveis antigos. UUID, nome, e-mail e
descrição preservados na linha são a fonte do evento, mesmo após alterações
ou exclusões das entidades associadas. A consulta não chama `audit`, não
insere eventos de acesso nem modifica registros ou sequência do histórico.
A transação autorizada conserva o lock de usuários já adotado no backend;
nenhum fluxo de escrita dos módulos anteriores foi reconstruído.

### Filtros, datas e paginação

| Query | Validação / significado |
| --- | --- |
| `limit` | Inteiro; padrão 50, mínimo 1, máximo 100 |
| `offset` | Inteiro; padrão 0, máximo 1000000 |
| `acao` | `CREATE`, `UPDATE` ou `DELETE` |
| `entidade` | `usuario` ou `imovel`, os valores emitidos atualmente |
| `usuario_id` | UUID do responsável; filtra a coluna `user_id` preservada |
| `entidade_id` | Texto exato de 1 a 256 caracteres, sem controles/NUL; não exige UUID |
| `data_inicio` | ISO 8601 com fuso explícito; limite inclusivo |
| `data_fim` | ISO 8601 com fuso explícito; limite exclusivo |

Os filtros são opcionais e combináveis. Parâmetros desconhecidos, valores
vazios/inválidos e repetições que formem arrays são rejeitados. Paginação
aceita dígitos inteiros, sem decimais ou notação exponencial. `entidade_id`
preserva espaços significativos e identificadores legados; `%`, `_` e aspas
são literais, nunca operadores SQL. `usuario_id` não exige que a conta ainda
exista, pois não há JOIN para resolver o responsável.

Datas aceitam `Z` ou offset explícito, como `2026-10-26T00:00:00-03:00`.
Não aceitam data sem horário/fuso, datas inexistentes ou mais de três casas
fracionárias. Limites são normalizados para UTC com precisão de milissegundos,
compatível com `toISOString()` usado pelo React. Precisão maior é recusada
em vez de truncada silenciosamente. O instante UTC deve estar nos anos 1 a 9999.
Se ambos forem informados, início não pode ser posterior ao fim; limites iguais
representam período vazio. Apenas um limite define um período aberto.

O intervalo é **[data_inicio, data_fim)**. Para um dia local, calcule o início
desse dia e o início do dia seguinte no mesmo fuso do navegador e envie os dois
instantes. Não use `23:59:59.999` como fim, pois o PostgreSQL guarda precisão
maior. Use `URLSearchParams` para codificar offsets positivos, evitando que `+`
seja interpretado como espaço na query string.

A ordem é fixa por `criado_em DESC` e pelo **BIGINT numérico** `id DESC`.
Os nomes usados na ordenação não vêm do cliente. A consulta busca `limit + 1`
linhas, devolve até `limit` e calcula `temMais`, como o painel atual. Não executa
COUNT total: os controles Anterior/Próxima não precisam dele. Páginas com offset
podem se deslocar quando novos eventos entram entre requisições; a ordem é
determinística, mas não há snapshot compartilhado entre páginas HTTP.

### Formato e exemplos

Os campos retornados são `id`, `user_id`, `usuario_nome`, `usuario_email`,
`acao`, `entidade`, `entidade_id`, `descricao` e `criado_em`. `id` é **string
decimal**, preservando BIGINT acima de `Number.MAX_SAFE_INTEGER`; a ordenação
continua numérica no banco. No caminho `/:id`, aceita de 1 a 9223372036854775807,
sem sinal ou zeros iniciais. `entidade_id` continua texto. Datas de resposta
são ISO UTC, e os campos anuláveis permanecem nulos. A consulta individual
não aceita parâmetros de query. Não há colunas de senha,
hash ou token nas consultas. Outros valores legados de entidade, se existirem,
permanecem visíveis na consulta completa; novos filtros de entidade exigem
atualização explícita da lista permitida.

```http
GET /api/historico?limit=50&offset=0
GET /api/historico?acao=DELETE&entidade=imovel
GET /api/historico?usuario_id=cf32c2cc-bacc-4f76-8485-baa902eb84ce
GET /api/historico?entidade=imovel&entidade_id=legado%3A42
GET /api/historico?data_inicio=2026-10-26T03%3A00%3A00Z&data_fim=2026-10-27T03%3A00%3A00Z
GET /api/historico/123
```

Resposta ilustrativa, sem credenciais reais:

```json
{
  "registros": [
    {
      "id": "123",
      "user_id": null,
      "usuario_nome": "Responsável preservado",
      "usuario_email": "autor@example.test",
      "acao": "DELETE",
      "entidade": "imovel",
      "entidade_id": "legado:42",
      "descricao": "Excluiu o imóvel de demonstração.",
      "criado_em": "2026-10-26T12:00:00.000Z"
    }
  ],
  "limit": 50,
  "offset": 0,
  "temMais": false
}
```

`GET /api/historico/123` usa `{ "registro": { ... } }`. Lista vazia usa
`{ "registros": [], "limit": 50, "offset": 0, "temMais": false }`.

Para testar manualmente, use o login PowerShell documentado acima **antes do
logout**, com uma conta administrativa local e troca de senha concluída:

```powershell
$pagina = Invoke-RestMethod "$api/api/historico?limit=50&offset=0" -Headers $headers -WebSession $sessao
$pagina.registros
if ($pagina.registros.Count -gt 0) {
  $eventoId = $pagina.registros[0].id
  Invoke-RestMethod "$api/api/historico/$eventoId" -Headers $headers -WebSession $sessao
}
```

Nenhuma mutação é necessária para consultar registros existentes. Na API local,
vendedor deve receber 403 e uma sessão ausente deve receber 401. Use os testes
isolados para reproduzir exclusões, revogações e dados inválidos, preservando
contas e histórico reais.

### Migration de índices

`src/database/migrations/2026102601_historico_indices.sql` cria três índices:

- `historico_criado_em_id_idx`: data/ID decrescentes, para paginação e período.
- `historico_entidade_data_id_idx`: entidade/identificador seguidos de data/ID,
  para recuperar eventos de um recurso na mesma ordem da API.
- `historico_usuario_data_id_idx`: responsável seguido de data/ID, para seu filtro.

São aditivos, transacionais e reaplicáveis; não alteram colunas, FKs ou linhas.
Foram aplicados e reaplicados apenas nas fixtures PGlite e nos bancos nativos
isolados. **Não foram executados em `db_credi_dev`.** Não há execução no startup.
Depois de autorização explícita e conferência do ambiente de destino:

```powershell
npm.cmd run db:migrate -- 2026102601_historico_indices.sql
```

O módulo consulta o esquema já existente mesmo antes dos índices. Planeje a
aplicação em tabelas grandes considerando o lock de escrita do CREATE INDEX
transacional. Não foi criada outra tabela de logs nem alterada a restrição de ações.

### Compatibilidade e limitações da tela React

`src/admin/AdminHistorico.tsx` já usa o serviço Supabase `src/services/historico.ts`;
não foram encontrados mocks nesse fluxo. A tela mostra ação, entidade,
responsável, descrição, identificador e data/hora local em pt-BR. Filtra por
dia e usa páginas de 50 com Anterior/Próxima. Isso orientou `registros`/`temMais`
e o período com fim exclusivo. O detalhe por ID é uma consulta pontual da API;
a tela atual não possui visualização adicional de diferenças.

A integração posterior deverá trocar o serviço por fetch com
`credentials: 'include'`, gerar `limit=50` e `offset=pagina*50`, enviar limites
ISO do dia selecionado e alterar `RegistroHistorico.id` de number para string.
O retorno já mantém `registros` e `temMais`. Ajustar os rótulos de ação, hoje
fixados como operações de imóveis, para eventos de usuários também; o campo
"ID do imóvel" deverá considerar a entidade. A API só devolve a descrição
persistida, sem inventar valores antes/depois ou dados atuais do recurso.

As migrations Supabase do repositório permitem histórico para vendedores
autenticados; o estado remoto não foi inspecionado nesta entrega. A nova API
local é **exclusiva de admins**. Sua restrição não altera políticas remotas
nem o código atual da tela; na integração futura será necessário adaptar
menu, autorização e tratamento de 401/403. Frontend, Supabase, imagens e cartas
permanecem intactos. Não houve migração de dados nem edição de contas.

Criados os cinco arquivos do módulo, `tests/historico.test.ts` e a migration
acima. Modificados somente `src/app.ts`, `tests/support.ts` e este README para
registro da rota, fixtures/contrato dos testes e documentação. Não houve nova
dependência ou alteração do mecanismo de auditoria. **Módulo 03 concluído para
desenvolvimento local**, com a aplicação dos índices em desenvolvimento mantida
como procedimento explícito sujeito à autorização.

## Módulo 04: consulta segura de cartas contempladas

A Fraga & Bitello Consórcios continua sendo a fonte oficial. O backend consulta
diretamente `https://fragaebitelloconsorcios.com.br/api/json/contemplados` usando
o `fetch` nativo do Node.js 22. Não encadeia a função da Vercel, não grava cartas
no PostgreSQL e não oferece cadastro, edição, exclusão ou reserva.

**`GET /api/contemplados` é público**, sem sessão, cookies ou token CSRF. Não
aceita parâmetros de query; filtros continuam sendo responsabilidade da
vitrine. Reutiliza os cabeçalhos de segurança e a política Origin/CORS
existentes: requisições sem Origin são aceitas; uma Origin enviada deve estar
em `AUTH_ALLOWED_ORIGINS`. A rota não consulta o banco.

Para testar manualmente, com o backend iniciado e acesso ao fornecedor:

```powershell
curl.exe -i http://127.0.0.1:3000/api/contemplados
```

Use a `PORT` configurada se diferente de 3000. A consulta manual acessa o
fornecedor real; os testes automatizados usam exclusivamente respostas
simuladas. Não é necessário executar migration para este módulo.

O retorno de sucesso é um **array**, sem envelope, compatível com a tabela e
o modal de detalhes de `src/components/Cartas.tsx`:

```json
[
  {
    "id": 42,
    "categoria": "Veículo",
    "valor_credito_fmt": "R$ 26.829,00",
    "entrada_fmt": "R$ 14.700,00",
    "parcelas": 13,
    "valor_parcela_fmt": "R$ 960,00",
    "administradora": "Administradora de teste",
    "administradora_img": "https://images.example.test/logo.png",
    "reserva": "Reservar"
  }
]
```

O exemplo acima é ilustrativo. `[]` significa exclusivamente um array vazio
válido recebido do fornecedor; indisponibilidade ou resposta inválida não
é convertida em catálogo vazio.

Validações e limites:

| Informação | Regra |
| --- | --- |
| Transporte | Somente GET à URL fixa, sem credenciais, cookies ou headers do visitante; redirects são recusados |
| Prazo | 5 segundos para receber headers e corpo, com AbortController; sem tentativas automáticas adicionais |
| Resposta | HTTP 200, Content-Type application/json (charset permitido), UTF-8 válido e array JSON |
| Tamanho | Até 2 MiB efetivamente lidos, inclusive após descompressão; Content-Length excessivo é rejeitado antes da leitura |
| Quantidade | Até 5.000 registros; IDs repetidos invalidam o catálogo |
| `id` | Identificador externo numérico, inteiro positivo e seguro para JavaScript; não é UUID local |
| `parcelas` | Número inteiro não negativo e seguro; strings e frações são recusadas |
| `categoria` | Imóvel/Imovel ou Veículo/Veiculo, ignorando caixa e espaços externos; saída canônica Imóvel ou Veículo |
| `reserva` | Reservar → Reservar; Reservado → Reservado, ignorando caixa e espaços externos |
| Valores `*_fmt` | Strings BRL não negativas, até 64 caracteres, duas casas decimais; agrupamento brasileiro opcional e válido; espaço não separável é normalizado |
| Decimais externos | `valor_credito` e `valor_parcela`, se presentes, devem ser strings decimais não negativas, até 30 dígitos inteiros e 2 decimais, sem agrupamento ou expoente |
| Consistência financeira | Decimais opcionais devem concordar com o campo formatado; comparação exata com BigInt em centavos, sem conversão monetária para Number |
| `administradora` | Texto obrigatório, até 120 caracteres, sem caracteres de controle |
| `administradora_img` | Opcional; null ou vazio é omitido para permitir o fallback do frontend; se preenchido, URL absoluta HTTPS, até 2.048 caracteres, sem credenciais, espaços ou controles |

Todos os campos do contrato, exceto imagem, são obrigatórios. Somente esses
nove campos podem sair na resposta; strings decimais auxiliares e todos os
demais campos externos são descartados. A API não busca o conteúdo das imagens.

Um único registro inválido rejeita **todo o catálogo** com 502. Isso inclui
qualquer `reserva` desconhecida, como "Disponível" ou "Vendido": nunca é
convertida automaticamente em disponível. A decisão conservadora evita que a
vitrine atual, que trata valores diferentes de "Reservado" como disponíveis,
anuncie um status não confirmado. Mudanças de contrato do fornecedor exigem
revisão explícita dos schemas; podem suspender a consulta até essa revisão.

Erros usam o tratamento central da API e o contrato
`{"status":"error","message":"mensagem segura"}`:

| HTTP | Situação |
| --- | --- |
| 400 | Query parameters não suportados |
| 403 | Origin enviada não pertence à allowlist existente |
| 502 | Falha de rede/leitura, HTTP externo diferente de 200 (incluindo 404/429/5xx), HTML, JSON/schema inválido ou limite excedido |
| 504 | Fornecedor excede o prazo de resposta |

Corpos de erro, headers do fornecedor, Set-Cookie, detalhes de rede e issues
Zod externos não são enviados ao visitante nem registrados em logs. A API não
repassa o Retry-After externo nem confunde o 429 externo com o rate limit do
login. Não há resposta parcial ou fallback para catálogo antigo.

**Cache:** nenhuma persistência ou cache em memória foi adicionada. Cada GET
consulta o fornecedor; as respostas de sucesso e erro usam
`Cache-Control: no-store`. O fetch de saída também usa `cache: 'no-store'`.
A consulta representa o catálogo devolvido naquele momento, sem assegurar
reserva futura. A disponibilidade continua dependendo do fornecedor.

A integração antiga permanece intacta: `api/contemplados.ts` transmite a
resposta externa sem esta validação e mantém sua política anterior
`s-maxage=300, stale-while-revalidate=600`. **A Vercel continuará utilizando essa
função antiga até uma migração explícita.** A proteção nova vale apenas para
o endpoint do backend independente.

O React não foi redirecionado. Seu caminho relativo `/api/contemplados`
continua sendo resolvido na origem do frontend: no desenvolvimento, o proxy
atual do Vite consulta o fornecedor; na Vercel, a função antiga atende o mesmo
caminho. O endpoint de `http://127.0.0.1:3000` pertence a outra origem.

Na integração futura, escolher explicitamente a origem da API na configuração
do frontend ou um rewrite/proxy para o backend. Não encadear a função antiga e
o backend. Na Vercel, validar a precedência da função existente, do rewrite
planejado e do fallback da SPA: o nome igual do caminho não troca seu destino.
Testar em preview antes de migrar e só então alterar o roteamento legado.

Validar tabela e modal, categorias/filtros, fallback de imagem, badges
Reservar/Reservado, array vazio e mensagens para 502/504. Em acesso entre
origens, configurar a Origin exata em `AUTH_ALLOWED_ORIGINS`; a consulta
pública não precisa de `credentials: 'include'`. Não modificar o Supabase
Auth ou reativar `AdminCartas.tsx` para fazer essa integração.

Arquitetura: routes → controller → service → client HTTP, com schema Zod.
O client concentra transporte, timeout e leitura limitada; o service valida
o catálogo; o controller valida a query. Não há repository SQL neste módulo,
pois o fornecedor continua responsável pelos dados. `createApp` aceita um
client opcional somente para injeção nos testes, usando fetch real por padrão.
Nenhuma dependência nova ou variável sensível foi adicionada.

Arquivos criados: os cinco arquivos `contemplados.*.ts` em
`src/modules/contemplados/` e `tests/contemplados.test.ts`. Modificados apenas
`src/app.ts` (registro e injeção do client) e este README. Nenhuma migration,
deploy, alteração de dados ou commit faz parte desta entrega.

**Classificação: módulo 04 concluído para desenvolvimento local.** A validação
automatizada está descrita abaixo. A migração do React e da rota de produção
permanece como uma etapa posterior; esta entrega não valida deploy na Vercel.

## Arquitetura e segurança

Routes montam middlewares; controllers validam transporte e respondem;
services aplicam regras; repositories concentram SQL parametrizado; schemas
Zod validam/tipam entradas. `createApp` aceita `Database` para testes, usando
o Pool existente por padrão. Não há novo servidor ou conexão Supabase.

Senhas usam `argon2`/Argon2id com 19 MiB, duas iterações e paralelismo 1,
conforme a [referência OWASP de senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
Um hash fictício reduz diferenças de trabalho para conta ausente/hash inválido.
Senha incorreta, conta inexistente e inativa retornam a mesma mensagem 401.
Limites persistidos contam sucesso/falha; corpos inválidos consomem limite por
IP. Excesso retorna 429 com `Retry-After`.

Mutações e gerenciamento usam transação com lock
`usuarios IN SHARE ROW EXCLUSIVE MODE`. Para o volume atual, isso simplifica
a garantia do último admin e a revalidação de sessão/papel após esperar outro
processo. A autorização é refeita dentro da transação. Antes de ampliar o
volume, avaliar locks granulares preservando as garantias dos testes.

Criações, alterações, desativação, reset e revogação administrativa registram
`CREATE`/`UPDATE` no histórico, na mesma transação, com autor e descrição fixa,
sem segredos. Erros não serializam corpos, cookies ou credenciais. Diagnóstico
técnico sanitizado aparece só em desenvolvimento. JSON limitado a 16 KiB;
erros previstos usam 400/401/403/404/409/429; internos usam 500 genérico.

Dependências de segurança utilizadas: `argon2`, `zod`, `cookie`. Zod permite validação
estrita e tipos derivados do mesmo schema; cookie fornece parsing mantido.
Somente testes usam `@electric-sql/pglite` e `@types/emscripten`.

## Testes

```powershell
npm run build
npm run typecheck:test
npm test
```

Por padrão, PostgreSQL/WASM PGlite em memória, HTTP e Argon2id reais, sem
conectar ao banco de desenvolvimento. Fixtures são limpas só nessa instância.
Subprocessos com ambiente controlado verificam cookies e regras de produção.

Para PostgreSQL nativo, crie explicitamente um banco **vazio** com prefixo
`db_credi_test_`. O modo optativo lê as credenciais de `backend/.env`, substitui
só o nome do banco e recusa prefixo diferente ou `public.usuarios` preexistente.

```powershell
$env:DNB_TEST_DATABASE = 'db_credi_test_nome_novo'
try { npm test } finally { Remove-Item Env:\DNB_TEST_DATABASE }
```

Esse modo cria fixtures e limpa somente dados desse banco isolado entre testes.
Não o compartilhe com outros serviços. O banco não é removido no final. A suíte
HTTP usa esse PostgreSQL; os testes de CLI mantêm suas instâncias PGlite próprias.

Para executar também a suíte de imóveis no PostgreSQL nativo, crie um segundo
banco vazio e configure `DNB_TEST_IMOVEIS_DATABASE`. Ambos exigem o prefixo de
testes e recusam tabelas `usuarios` preexistentes. Não reutilize os bancos de
execuções anteriores. Os nomes distintos impedem que uma suíte limpe dados de outra.

```powershell
$env:DNB_TEST_DATABASE = 'db_credi_test_auth_novo'
$env:DNB_TEST_IMOVEIS_DATABASE = 'db_credi_test_imoveis_novo'
try { npm test } finally { Remove-Item Env:\DNB_TEST_DATABASE, Env:\DNB_TEST_IMOVEIS_DATABASE }
```

Para incluir a suíte do módulo 03, use também um terceiro banco vazio com
`DNB_TEST_HISTORICO_DATABASE`. As mesmas proteções se aplicam a ele. Cada suíte
cria e limpa apenas suas fixtures no banco isolado escolhido; o banco de
desenvolvimento nunca é aceito como destino de testes.

```powershell
$env:DNB_TEST_DATABASE = 'db_credi_test_auth_novo'
$env:DNB_TEST_IMOVEIS_DATABASE = 'db_credi_test_imoveis_novo'
$env:DNB_TEST_HISTORICO_DATABASE = 'db_credi_test_historico_novo'
try { npm test } finally {
  Remove-Item Env:\DNB_TEST_DATABASE, Env:\DNB_TEST_IMOVEIS_DATABASE, Env:\DNB_TEST_HISTORICO_DATABASE
}
```

Validação do módulo 04 em 26/10/2026:

| Verificação | Resultado executado |
| --- | --- |
| `npm run build` | Aprovado |
| `npm run typecheck:test` | Aprovado |
| `npm test`, modo padrão em memória | 174 aprovados, zero falhas, cancelados ou ignorados |
| Regressão | Todos os 139 testes anteriores continuam aprovados |
| Nova suíte de contemplados | 35 testes HTTP com fornecedor simulado, sem dependência de internet ou PostgreSQL |

`tests/contemplados.test.ts` exercita o contrato da vitrine/modal, array vazio,
campos excedentes/cookies, categorias/status conhecidos, precisão e divergência
de centavos, imagem opcional, timeout de headers e corpo, cancelamento tardio,
falhas de conexão/leitura, HTTP 404/429/500/503, redirecionamento/204/206,
HTML/JSON/UTF-8 inválidos, estrutura/campos/tipos inválidos, valores monetários,
status desconhecido, URLs/IDs, duplicatas, limites de registros/bytes (incluindo
Content-Length adulterado), ausência de cache/fallback, CORS, query inválida,
acesso público e ausência de CRUD. Um banco simulado que falha em qualquer
acesso garante que a nova rota não usa PostgreSQL. Loopback foi liberado pelo
ambiente para executar os testes HTTP.

As suítes anteriores usam PGlite/HTTP/Argon2id e subprocessos isolados, inclusive
o reinício real de `tsx watch`. Nesta entrega não houve execução em PostgreSQL
nativo, conexão ao banco de desenvolvimento ou consulta ao fornecedor real;
a validação nativa abaixo é o registro da entrega anterior do módulo 03.

Validação final do módulo 03 em 26/10/2026 (registro anterior):

| Verificação | Resultado executado |
| --- | --- |
| `npm run build` | Aprovado |
| `npm run typecheck:test` | Aprovado |
| `npm test`, modo padrão em memória | 139 aprovados, zero falhas ou testes ignorados |
| `npm test`, modo nativo com três bancos | 139 aprovados; 91 testes HTTP/SQL usaram PostgreSQL nativo |
| `npm audit --omit=dev`, verificação anterior de 24/10 | Zero vulnerabilidades reportadas; nenhuma dependência alterada nesta entrega |

A API compilada também foi exercitada por GETs somente de leitura: health,
health/db, CSRF e catálogo público responderam 200; perfil e gestão sem sessão
responderam 401. Não foram feitas mutações HTTP no banco de desenvolvimento.

Distribuição: 14 testes do bootstrap/CLI, 18 de recuperação, 33 de autenticação/
usuários via HTTP e SQL, 29 de imóveis, 29 de histórico, 2 de configuração/cookies
e 14 de inicialização/encerramento HTTP. Os 110 testes anteriores, incluindo
os 67 testes
do módulo 01 continuam aprovados. Inclui ciclo completo de
admin e vendedor, troca obrigatória, todos os endpoints administrativos com
CSRF, permissões, revogação, conta inativa, expiração, e-mail duplicado,
contextos de autorização antigos, disputa pelo último admin e rollback da
auditoria em cadastro, reset HTTP e recuperação CLI.

Imóveis: leitura pública, UUID, ausência, filtros combinados/SQL injection,
paginação/ordenação, cadastro admin/vendedor, campos imutáveis, validação,
precisão decimal, nulos/imagens, propriedade, órfãos, gestão, sessões inválidas,
CSRF/Origin, histórico CREATE/UPDATE/DELETE, rollback das três mutações, FKs,
ausência de mudanças e concorrência entre PATCH/PATCH e PATCH/DELETE. Migration
de índices aplicada e reaplicada somente nas fixtures. Em ambiente com sandbox,
as suítes HTTP exigiram liberação de loopback; foram efetivamente executadas.

`tests/server.test.ts` e os workers `http-server-worker.ts`/`http-watch-worker.ts`
cobrem início bem-sucedido, bind ocupado real, ausência de sucesso falso,
EACCES/erros genéricos simulados, sinal durante bind, sinais repetidos, drenagem
HTTP, falhas de fechamento, prazo máximo, PORT inválida e reinício real do
watcher. Pool e consulta lenta são instrumentados apenas nesses subprocessos,
sem conexão PostgreSQL; os demais 96 testes continuam usando seus ambientes
isolados na entrega HTTP. A correção HTTP não alterou `package.json`, ambiente,
módulos ou banco. A nova suíte de histórico também usa seu ambiente isolado.

`tests/historico.test.ts` cobre os dois endpoints, papéis/sessões/status/troca
pendente, autorização revalidada, filtros individuais e combinados, datas/fusos,
paginação/temMais, ordenação numérica de BIGINT, precisão dos IDs, validação,
SQL injection e políticas CORS. Exercita eventos reais dos módulos 01/02,
preservação de nomes/e-mails, consulta após exclusão do imóvel/autor, ausência
de escrita/avanço de sequência e recusa de endpoints de mutação. Um trigger
de teste impede qualquer escrita no histórico durante as leituras. A migration
de índices foi aplicada duas vezes em cada contexto isolado.

Os testes do CLI de recuperação simulam somente o banco/endereço retornados
pela inspeção de destino, pois PGlite não tem conexão TCP. Hashes, SQL,
transações, revogações e histórico são reais no banco isolado. A conta recuperada
não pode gerenciar usuários nem editar perfil até trocar a senha; após outro
login com a senha definitiva, o acesso administrativo é restabelecido.

O módulo 01 foi auditado no banco `db_credi_test_audit_1792879849667_a53f3e`.
Nesta entrega do módulo 02, os bancos novos foram:
`db_credi_test_auth_imoveis_1792880873523_6838a2` e
`db_credi_test_imoveis_1792880873523_6838a2`, mantidos sem exclusão automática.
Nenhuma conta ou senha de `db_credi_dev` foi modificada pelos testes.

Na entrega do módulo 03 foram criados exclusivamente para testes nativos:
`db_credi_test_auth_m03_1793021970608_c6d273`,
`db_credi_test_imoveis_m03_1793021970608_c6d273` e
`db_credi_test_historico_m03_1793021970608_c6d273`. Permanecem sem exclusão
automática. Nenhuma migration foi executada em desenvolvimento nesta entrega;
a inspeção de `db_credi_dev` foi somente de leitura.

## Auditoria do módulo 01 e organização

A arquitetura modular existente foi mantida. Routes/middlewares controlam
transporte e acesso; controllers usam schemas; services concentram regras e
transações; repositories executam SQL parametrizado. A auditoria do módulo 01
não adicionou dependências, camadas ou migrations. O módulo 02 mantém essa
arquitetura, estende a auditoria com a entidade `imovel` e ação `DELETE`, e
adiciona a migration de índices. Não há dependência nova.

```text
src/
  cli/                  # Bootstrap e recuperação local; entrada oculta e erros seguros
  config/               # Ambiente e opções de autenticação
  database/             # Pool, transações e migration explícita
  middlewares/          # Autenticação, papel, Origin/CSRF e erros
  modules/auth/         # Sessões, login, perfil e troca de senha
  modules/usuarios/     # Gerenciamento administrativo e bootstrap
  modules/imoveis/      # Catálogo, gestão autenticada e CRUD com propriedade
  modules/historico/    # Consulta administrativa da auditoria existente
  modules/contemplados/ # Consulta pública ao fornecedor, validação e transporte limitado
  modules/health/       # Health checks preservados
  shared/               # Argon2id, cookies, validação, auditoria e transação autorizada
tests/                  # HTTP/SQL, CLI, recuperação e configuração
```

Login/logout, perfis, papéis, senhas, sessões, CSRF, rate limit, auditoria,
migration e CLIs já existiam e foram reutilizados. Foram corrigidos dois
problemas reproduzidos por testes antes das correções:

- E-mail antigo gravado em maiúsculas era encontrado por `lower(email)`, mas
  rejeitado pela comparação posterior. A revalidação agora também ignora caixa,
  preservando o e-mail cadastrado e a verificação de alterações concorrentes.
- Sessões vencidas durante uma transação podiam passar pela revalidação com
  `now()`, que representa o início do `BEGIN`. A consulta agora usa o relógio
  atual, inclusive após espera por lock. Veja a [documentação do PostgreSQL](https://www.postgresql.org/docs/18/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).

Também foram ampliados os testes de ciclo completo, autorização antiga, CSRF
e rollback; o fluxo da recuperação passou a verificar o bloqueio administrativo
e o retorno do acesso somente depois da troca obrigatória e novo login.

Arquivos alterados nesta auditoria: `README.md`,
`src/modules/auth/auth.service.ts`, `src/modules/auth/auth.repository.ts`,
`tests/auth.test.ts` e `tests/admin-reset.test.ts`.

O esquema real de `usuarios`, `sessoes`, `auth_login_limites` e `historico` foi
inspecionado em transação somente de leitura. Índices/FKs necessários às
consultas atuais estão presentes. O frontend continua usando Supabase Auth e
`app_metadata.role`; ele não foi conectado à autenticação local nesta etapa.

**Classificação: concluído para desenvolvimento local.** Os fluxos críticos
implementados passaram nas verificações descritas. Não há pendência bloqueadora
identificada nesses fluxos. Isso não representa validação de uma implantação
HTTPS ou de cookies entre sites em navegadores reais.

## Integração futura com React e produção

No React, implementar um adaptador para login, perfil e logout com
`credentials: 'include'`, obter CSRF antes das mutações e atualizar o valor
após login. Usar o perfil retornado pelo servidor, tratar 401/403/429 e
encaminhar contas com troca pendente à mudança de senha. Não armazenar token
de sessão em localStorage. A substituição do Supabase e qualquer migração de
usuários exigem uma etapa própria; a integração comercial permanece preservada.

Para Vercel e API em outro domínio: HTTPS em ambos, origem exata na allowlist,
`credentials: include` e `SameSite=None; Secure` quando os sites forem distintos.
Domínios diferentes podem continuar pertencendo ao mesmo site; `Lax` atende
esse caso quando o restante da topologia permitir. Cookies de terceiros podem
ser bloqueados: definir domínios próprios sob o mesmo site ou um proxy/BFF na
origem do frontend. Manter CSRF e Origin, sem wildcard com credenciais.

Antes da produção, preparar e validar no ambiente de hospedagem:

- TLS/HSTS no proxy; ajustar bind de `127.0.0.1` se a hospedagem exigir e
  restringir acesso direto à API. Definir `TRUST_PROXY_HOPS` conforme a topologia
  real, evitando confiar em IP fornecido por conexões não confiáveis.
- Conta PostgreSQL de execução com privilégios mínimos, conta de migrations
  separada, segredos gerenciados, backups e TLS verificado se o banco for remoto.
  A configuração atual do Pool atende ao PostgreSQL local; acesso remoto exige
  configurar TLS no driver conforme o provedor.
- Rotina explícita de retenção/limpeza de sessões e contadores vencidos,
  monitoramento, capacidade dos limites e dos locks administrativos. Não há
  manutenção automática de registros nesta etapa.
- Testes reais de navegador, HTTPS, cookies/CORS e proxy na topologia escolhida.
  Os testes atuais verificam atributos de cookies em ambiente controlado.

O CLI `admin:reset-password` permanece proibido em produção. Recuperação HTTP
exige outro administrador autenticado; definir procedimento operacional de
recuperação de emergência para produção. Não há recuperação pública por e-mail
nem envio automático de credenciais.
