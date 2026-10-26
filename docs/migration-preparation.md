# Etapa 05.3 — Inventário e simulação de migração

Esta entrega contém ferramentas isoladas de **leitura e validação**. Não existe
importador, flag apply, upload, exclusão, alteração de usuário ou migration SQL.
O frontend e o backend de execução permanecem intactos. Não foi configurado
nenhum armazenamento novo.

## Resultado do escopo acessível

O inventário e o dry-run executados nesta etapa, somente por leitura, encontraram:

| Verificação | Resultado |
| --- | --- |
| Imóveis visíveis pela API pública Supabase | 1 |
| Proprietários visíveis | 1 |
| Imóveis no PostgreSQL local | 0 |
| Contas locais consultadas, sem nome/e-mail/senha | 2 |
| UUIDs de proprietários visíveis iguais a UUIDs locais | 0 |
| Mapeamentos reais confirmados | 0 |
| Candidatos no dry-run real | 0, bloqueado por proprietário sem mapa |
| Referências únicas de fotos | 2 |
| Verificação pública por HEAD | 2 respostas 200, image/jpeg |
| Colunas locais inspecionadas | 16 |

As duas respostas HEAD informaram 10.310 bytes cada. Mesmo tamanho **não prova
conteúdo duplicado**; não foram baixados nem comparados os binários. A capa
também consta da galeria, o que é normal e não representa uma terceira foto.

O registro acessível passou nas verificações de campos/imagens e no confronto
com o esquema local; o bloqueio identificado foi o proprietário sem mapeamento.
Dinheiro foi recebido como texto. O inventário detalhado contém os UUIDs,
proprietário, título, valores, demais campos, data e referências das imagens,
somente nos relatórios privados locais.

Arquivos gerados explicitamente em `.dnb-migration/`:

- `inventario-20261026-053.json`
- `simulacao-20261026-053.json`

A pasta está ignorada pelo Git. Nenhum dado real foi colocado nas fixtures ou
na documentação versionada. O terminal mostra contagens e códigos de problema,
sem campos comerciais, UUIDs, URLs, chaves ou credenciais. Relatórios não são
criptografados: proteger seu acesso e não publicar esses arquivos.

## Limitações que impedem a transição real

A paginação foi concluída **para o conteúdo visível pela chave pública**.
Isso não comprova acesso a todos os imóveis, usuários, objetos do bucket ou
políticas RLS. Requisições REST separadas não constituem um snapshot transacional;
contagem estável também não prova ausência de edições durante a coleta.

O inventário não consultou auth.users nem utilizou service_role, chave secreta,
conexão PostgreSQL remota ou DATABASE_URL implicitamente. Políticas de upload,
limites do bucket, todos os objetos, órfãos e dados ocultos continuam pendentes
de inspeção por um responsável autorizado. Leitura pública das fotos não prova
permissão de escrita ou exclusão.

Não ligar a vitrine ao banco local vazio nem substituir o login comercial até
resolver essas pendências. Nenhuma conta foi associada automaticamente ao
administrador, a Bruno ou a qualquer outra pessoa.

## Ferramentas

| Arquivo | Função |
| --- | --- |
| `tools/migration/analysis.mjs` | Análise pura: campos, schema, mapa, conflitos e imagens |
| `tools/migration/io.mjs` | REST público GET, HEAD restrito e PostgreSQL read-only |
| `tools/migration/cli.mjs` | Argumentos, fixtures, execução e relatório privado |
| `tools/migration/fixtures/*.synthetic.json` | Somente exemplos artificiais |
| `tests/migration/dry-run.test.mjs` | Testes sintéticos e adaptadores simulados |

Requisitos: Node.js 22.14+, dependências da raiz e do backend já instaladas.
O validador reutiliza diretamente `createImovelSchema` do backend, sem copiar
suas regras e sem importar pool, ambiente ou servidor. Usa o pg já instalado
no backend somente quando a inspeção local é explicitamente solicitada.
Não há dependência nova. O aviso experimental de strip-types é o mesmo dos
testes anteriores.

Exemplo seguro, sem rede e sem escrita em bancos:

```powershell
npm run migration:dry-run -- --mapping tools/migration/fixtures/owners.synthetic.json
```

Esse exemplo encontrou um candidato artificial com precisão preservada e
nenhuma importação. Sem argumentos, os dois comandos usam fixtures e deixam
o mapa vazio: o bloqueio por proprietário não confirmado é intencional.

Para inventário real público/local, mediante execução explícita:

```powershell
npm run migration:inventory -- --source-env .env --target-env backend/.env --check-images --output inventario-novo.json
npm run migration:dry-run -- --source-env .env --target-env backend/.env --check-images --output simulacao-nova.json
```

Usar um nome novo a cada execução. `--output` aceita somente nome JSON simples,
grava exclusivamente em `.dnb-migration/` e recusa sobrescrita. Sem esse argumento,
nenhum relatório é salvo. Arquivos de ambiente são lidos, nunca modificados.
Não passar senhas ou connection strings na linha de comando.

Opções adicionais:

- `--source-file caminho.json`: snapshot com `properties`, `available` e
  `paginationComplete`. É marcado como snapshot e não prova acesso completo.
- `--target-file caminho.json`: snapshot no formato da fixture de destino,
  com users, properties, columns, constraints, indexes e triggers.
- `--mapping .dnb-migration/owners.json`: mapa humano confirmado, conforme abaixo.
- `--objects .dnb-migration/objetos.json`: manifesto fornecido separadamente como
  `{ "objects": ["imoveis/objeto.jpg"] }`. Não lista nem modifica o Storage.
- `--check-images`: HEAD apenas de URLs HTTPS públicas do bucket fotos-imoveis
  na mesma origem Supabase. Destinos arbitrários/privados não são requisitados.

Não combinar source-env/source-file ou target-env/target-file. Uma origem real
sem destino fornecido não é comparada implicitamente com um destino sintético.
Somente os campos conhecidos de imóveis são coletados; campos adicionais fora
desse contrato exigem inventário autorizado separado antes de uma migração completa.

A CLI usa código 0 quando não há bloqueios nos dados fornecidos, 2 quando a
simulação está bloqueada e 1 para erro de execução/configuração. O npm pode
apresentar saída não zero como falha do comando. Isso não significa que uma
importação foi tentada. `realMigrationAuthorized` é sempre false.

## Preservação e regras de validação

A origem pública usa somente chave publishable/anon configurada explicitamente;
chaves sb_secret e JWT service_role são recusados. O fetch tem prazo de cinco
segundos, limite de 4 MiB por resposta, até 100 páginas e 10 mil registros,
sem redirects ou credenciais do navegador. Falha de rede/permissão/JSON não é
convertida em inventário vazio válido. Cada paginação com contagem inconsistente
é interrompida.

O select REST usa `preco::text` e `area::text` antes de gerar JSON. Se o provedor
não aceitar esses casts, a consulta falha, sem fallback para Number.
[PostgREST: casting](https://docs.postgrest.org/en/v13/references/api/tables_views.html#casting-columns).
Snapshots devem trazer decimais em strings, sem moeda formatada ou expoente.
Números JSON são bloqueados porque a precisão original pode já ter sido perdida.

Datas precisam de calendário válido e offset explícito, com até seis casas
fracionárias. O texto original é preservado; não há normalização que descarte
microssegundos. IDs e criado_em ficam fora do payload público de cadastro e
seriam preservados por um importador futuro próprio, nunca por atribuição
arbitrária de user_id no React.

O destino aceita apenas banco local `db_credi_dev` ou `db_credi_test_*` e ambiente
development/test. A conexão inicia com default_transaction_read_only=on, abre
REPEATABLE READ READ ONLY, confirma o modo com SELECT e executa SQL fixo.
Ao finalizar faz ROLLBACK e fecha a conexão. Não há INSERT/UPDATE/DELETE ou DDL.
São lidos metadados, UUID/papel/ativo das contas e imóveis existentes.

Além do schema de entrada, são avaliados tipos/nulls, tamanhos e precisão das
colunas locais, PK, FK do proprietário, índices únicos e triggers/checks que
necessitem revisão. A API é mais restritiva que NUMERIC sem escala no banco:
até 15 dígitos inteiros e duas casas; área deve ser positiva ou nula; até 20
imagens em array. O frontend atual usa Number e aceita galeria JSON em string;
esses formatos não são corrigidos silenciosamente pelo dry-run.

UUID repetido na origem ou existente no destino bloqueia, mesmo se os registros
parecerem iguais. Não há upsert. Possíveis duplicações por conteúdo comercial
geram revisão, sem deduplicação automática. URLs HTTP, temporárias, com query,
fragmentos ou credenciais exigem revisão; informações de autenticação da URL
são removidas do relatório. Imagens repetidas dentro da galeria são apontadas;
a capa repetida na galeria é permitida. Referências compartilhadas são contadas.

Propostas só aparecem quando os dados, o mapa e o esquema fornecidos passam
nos bloqueios. Advertências ainda exigem revisão. Elegibilidade de um registro
não comprova completude da origem nem autoriza importação. Órfãos só podem ser
considerados candidatos com manifesto separado; sem todos os imóveis e objetos,
a avaliação permanece inconclusiva e nenhuma exclusão é segura.

## Mapeamento de proprietários

Um responsável precisa verificar a identidade do proprietário remoto por fonte
autorizada e confrontá-la com a conta local. Mesmo nome ou UUID coincidente não
substitui confirmação. Não criar, promover, reativar ou redefinir contas como
efeito colateral do inventário.

Modelo de arquivo privado, inicialmente bloqueado:

```json
{
  "mappings": [{
    "supabase_user_id": "SUBSTITUIR_PELO_UUID_REMOTO",
    "postgres_user_id": "SUBSTITUIR_PELO_UUID_LOCAL",
    "confirmed": false,
    "confirmedBy": "",
    "confirmedAt": ""
  }]
}
```

Depois da revisão, registrar responsável, data ISO com offset e confirmed=true.
Isso é uma atestação humana, não uma autenticação nova. O alvo precisa existir;
conflitos um-para-muitos, muitos-para-um e confirmações ausentes bloqueiam a
proposta. Conta inativa é advertida, sem ativação automática. Preservar UUIDs
locais existentes e IDs dos imóveis. Históricos e contas não são migrados por
essas ferramentas; precisam de plano próprio para preservar autoria e evitar
duplicação de auditoria na importação futura.

## Imagens atuais e escolha de armazenamento

O formulário envia diretamente ao Supabase Storage, bucket fotos-imoveis,
caminho `imoveis/<timestamp>_<UUID>.<extensão original>`, e salva URLs públicas.
O SDK utiliza a sessão Supabase disponível; o cookie local não a substitui.
`accept="image/*"` não valida tipo real ou tamanho. Não há limite explícito de
fotos no formulário. Uploads ocorrem antes de salvar; cancelamento/falha pode
deixar objetos abandonados. Remover foto ou excluir imóvel remove apenas a
referência/linha, sem apagar o objeto. Erros retornados no upload permitem
continuar os outros arquivos, sem rollback do lote.

| Critério | A: Supabase temporário | B: R2 Standard para novos uploads |
| --- | --- | --- |
| Franquia pública | Free: 1 GB de arquivos; 5 GB de egress e 5 GB cached | 10 GB-mês; 1 milhão operações A e 10 milhões B/mês |
| Excedentes | Storage US$ 0,0213/GB-mês conforme plano; tráfego separado | US$ 0,015/GB-mês; A US$ 4,50/milhão e B US$ 0,36/milhão; egress direto gratuito |
| Implantação | Reutiliza bucket/URLs; exige autorização de uploads pelo backend | Nova conta/bucket e credencial restrita; preserva URLs antigas enquanto transita |
| Segurança | Credencial privilegiada somente no servidor; revisar RLS e escopo | Credencial restrita ao bucket; autorização local e upload assinado |
| Recuperação | Backup de objetos separado do backup PostgreSQL | Cópias/manifestos e retenção; não presumir suporte a versionamento S3 |
| Dependência | Continua dependente do projeto Supabase | Troca para outro provedor e permite retirar Supabase gradualmente |

Fontes: [planos Supabase](https://supabase.com/pricing),
[Storage Supabase](https://supabase.com/docs/guides/storage/pricing) e
[R2](https://developers.cloudflare.com/r2/pricing/). Franquias e tarifas não
garantem custo zero. O plano contratado e o tráfego real não foram verificados.
O Pro Supabase parte de US$ 25/mês; se o projeto já estiver em Free, não há
economia de assinatura comprovada. Free também tem política de pausa por inatividade.

**Recomendação: B para novos uploads, mantendo as URLs atuais durante a
transição.** Atende melhor ao objetivo de retirar Supabase e controlar custos
de tráfego. Isso é uma proposta, pendente de aprovação; nenhum bucket, chave,
endpoint, DNS ou upload foi criado. A é uma ponte viável se a decisão de R2
precisar aguardar, sem manter duas autenticações no navegador.

No R2, usar domínio próprio para URLs estáveis de leitura em produção, sem
gravar URLs temporárias de upload nos imóveis. O domínio r2.dev é voltado a
desenvolvimento. [Buckets públicos](https://developers.cloudflare.com/r2/buckets/public-buckets/).
Copiar imagens antigas só em etapa autorizada, com checksum/manifesto e rollback;
não remover Supabase enquanto alguma referência necessária depender dele.

## Contrato proposto de upload — não implementado

Planejar três operações autenticadas por sessão local e CSRF:

1. Solicitar intenção de upload com imóvel opcional e metadados declarados.
   Para imóvel existente, admin ou vendedor proprietário; para cadastro novo,
   intenção temporária vinculada exclusivamente ao usuário da sessão.
2. Upload a chave nova em quarentena e conclusão pelo backend. Retornar assetId
   e URL estável somente após validar o objeto. Não aceitar user_id ou chave
   arbitrária do navegador. Vincular o asset ao imóvel autorizado em transação.
3. Desvincular imagem autorizada; só eliminar fisicamente após verificar todas
   as referências e a janela de recuperação. Banco e Storage não compartilham
   transação atômica: prever reconciliação e operações idempotentes.

Limites propostos para aprovação: JPEG/PNG/WebP, 5 MiB por arquivo, até 20 fotos
por imóvel, limite de dimensões/pixels e remoção de metadados na normalização.
Validar assinatura real e decodificação, não somente extensão/MIME declarado.
SVG e executáveis não entram nesse fluxo. Nomes/chaves gerados no servidor,
sem sobrescrita. Nunca servir quarentena publicamente.

Publicar os bytes validados em outra chave final imutável, que nunca tenha sido
autorizada pela URL de upload. Assim, reutilizar uma URL ainda válida não permite
sobrescrever a imagem já publicada. O upload direto não envia cookies da API ao
Storage; sessão e CSRF protegem emissão, conclusão e desvinculação no backend.
Configurar CORS do bucket para as origens/métodos necessários, com credencial
restrita no servidor e assinatura por SDK mantido. Processamento, domínio,
backups e eventual proxy têm custos próprios além da tabela de armazenamento.

Para upload assinado, limitar chave, método e prazo; a URL por si só não prova
que o conteúdo é imagem nem que seu tamanho é permitido. A conclusão precisa
verificar bytes/tamanho reais antes da publicação. No R2 pode-se definir prazo
curto; a API assinada padrão do Supabase tem validade de duas horas.
[R2: URLs assinadas](https://developers.cloudflare.com/r2/api/s3/presigned-urls/),
[Supabase: upload assinado](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).
Uma alternativa é upload intermediado, com streaming limitado no servidor.

Intenções abandonadas precisam de expiração e limpeza futura, com registro de
propriedade e referências compartilhadas. Não apagar objetos antigos com base
apenas no prefixo imoveis/. Nenhuma rotina de limpeza foi ativada nesta etapa.
Backups devem guardar bytes, chaves, metadados e referências, com teste de restauração.

## Validação e condições para avançar

`npm test` inclui os 90 testes anteriores e 32 novos: 122 aprovados, sem falhas
ou ignorados. Cobertura sintética inclui propriedade, confirmação de mapa,
conflitos UUID/identidade, decimais, datas, campos/schema incompatíveis, imagens,
duplicações, falha de origem, leitura protegida e não sobrescrita de relatórios.
Nenhum teste automatizado consulta dados reais. O modo de fixture válido e a
inspeção/dry-run reais foram executados separadamente; o real ficou bloqueado
intencionalmente e nenhum registro foi importado.

TypeScript e build do frontend passaram. O lint do escopo passou; o lint global
mantém os cinco erros preexistentes, sem edição desses arquivos. O aviso de
Browserslist desatualizado também permanece sem impedir o build.

Antes do novo login: inventário autorizado completo e manifesto do bucket;
mapa de identidades aprovado; decisão de armazenamento; contrato de upload
implementado/testado em ambiente isolado; backups de dados e objetos; ensaio
de importação e rollback com reconciliação. Só depois integrar telas e planejar
a mudança de produção. Esta entrega não autoriza nem executa essas operações.
