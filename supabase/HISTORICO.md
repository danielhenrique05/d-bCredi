# Ativar o Histórico existente

O painel continua usando as contas do Supabase Auth. Não foi criada outra tabela
de usuários. `app_metadata.role = "admin"` identifica o administrador; as demais
contas autenticadas têm as permissões de vendedor. `user_metadata` serve apenas
para nome de exibição, nunca para conceder privilégios.

Administradores e vendedores podem visualizar todos os registros do Histórico.
A aba aparece para qualquer usuário logado. Visitantes sem login não têm acesso.

## 1. Conferir o banco (somente leitura)

A conexão de inspeção expirou por timeout durante o desenvolvimento. Por isso,
o estado remoto e a execução da migration anterior não foram presumidos.
Antes de aplicar o SQL, confira no SQL Editor se já existe alguma estrutura de
auditoria fora do repositório, além das políticas e triggers atuais:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public';

select event_object_table, trigger_name, action_statement
from information_schema.triggers
where trigger_schema = 'public';
```

Se houver uma tabela/trigger equivalente de histórico que não esteja no código,
reaproveite essa estrutura antes de aplicar a migration, para não duplicar logs.
A migration interrompe a execução se `public.historico` já existir. Ela também
verifica que `imoveis.user_id` existe e é UUID; não cria nem altera essa coluna.

## 2. Aplicar o SQL

Se o Histórico ainda não foi instalado, execute o conteúdo integral de
[`migrations/20261007120000_historico_imoveis.sql`](migrations/20261007120000_historico_imoveis.sql)
no SQL Editor, como `postgres`, uma única vez. **Não é necessário executar a
migration antiga `20260914143000_imoveis_por_proprietario.sql`.**

Depois aplique
[`migrations/20261007130000_historico_usuarios_autenticados.sql`](migrations/20261007130000_historico_usuarios_autenticados.sql)
para liberar a leitura a todos os usuários autenticados. **Se a tabela e o
trigger do Histórico já foram instalados pela migration de 12:00, execute
somente esta migration de 13:00.** Ela substitui a política de leitura e não
altera dados, permissões de edição dos imóveis ou escrita no histórico.

A nova migration cria `historico`, funções, índices, trigger e políticas na
mesma transação. Não apaga dados nem políticas existentes. Políticas restritivas
novas impedem que permissões antigas amplas liberem edição/exclusão de imóveis
de terceiros. Caso existam políticas RESTRICTIVE adicionais, elas também serão
aplicadas pelo PostgreSQL e precisam ser conferidas na consulta acima.

O trigger registra CREATE/UPDATE/DELETE após operações bem-sucedidas, incluindo
alterações de destaque. Atualizações sem mudança de dados não geram registro.
Uma falha ao registrar o histórico reverte a operação inteira no imóvel.
O histórico registra o usuário que executou a operação, inclusive quando um
administrador altera o imóvel de outro vendedor, e conserva nome/e-mail e ID
do imóvel após exclusões. Não copia o formulário inteiro, senhas ou tokens.

Não há reconstrução de ações antigas: o registro começa após aplicar o SQL.
Imóveis antigos sem `user_id` podem ser gerenciados pelo administrador; não são
atribuídos automaticamente a um vendedor. Operações de manutenção executadas
diretamente no SQL Editor sem sessão de usuário aparecem como "Sistema".

## 3. Identificar o administrador existente

No SQL Editor, substitua o e-mail abaixo pelo de uma conta existente que deve
ser administradora e execute. Nenhuma conta é promovida automaticamente pela
migration. Não coloque chaves privilegiadas no frontend.
Esta etapa é necessária apenas para gerenciar imóveis de outros vendedores;
não é necessária para visualizar o Histórico.

```sql
update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'::jsonb,
  true
)
where email = 'SUBSTITUA_PELO_EMAIL_DO_ADMIN'
returning email, raw_app_meta_data->>'role' as papel;
```

O resultado deve retornar exatamente a conta escolhida. Depois saia e entre
novamente no painel para atualizar os privilégios da sessão.
Não é preciso alterar as demais contas para que sejam vendedores.

## 4. Testar

1. Como vendedor A, cadastre um imóvel, edite título/preço e exclua-o.
2. Como vendedor ou administrador, abra a aba **Histórico** já existente. Confira CREATE,
   UPDATE e DELETE, usuário legível, descrição, ID do imóvel e data/hora.
   O evento DELETE deve permanecer mesmo sem o imóvel na listagem.
3. Use o filtro por data, **Todas as datas** e **Atualizar**. A consulta é
   paginada em 50 registros; o filtro alcança todas as páginas. As datas usam
   o fuso do navegador; o banco armazena `timestamptz`.
4. Cadastre outro imóvel como vendedor A. Entre como vendedor B: ele não deve
   conseguir gerenciá-lo, mas deve acessar `/admin/historico` e visualizar também
   as ações de A. As políticas do banco continuam bloqueando a tentativa de
   alterar/excluir o ID de A pela API.
5. Como administrador, edite/exclua esse imóvel de A. Confira que o Histórico
   identifica o administrador como autor e que o proprietário não foi trocado.
6. Sem login, confira que a vitrine pública continua listando os imóveis e que
   `/admin/historico` exige login.

## Portabilidade e validação

`src/services/usuarios.ts` adapta a identidade atual; `src/services/historico.ts`
isola a consulta, que poderá ser substituída por HTTP na futura API. A tabela e
o trigger usam PostgreSQL comum. A integração de identidade está concentrada
em `credi_usuario_atual`; ao migrar, a API deverá fornecer essa identidade de
forma confiável e substituir também as referências a `auth.uid()` nas políticas.
O cadastro, login e armazenamento de fotos atuais não foram migrados.

Validação local: TypeScript e build aprovados; 77 verificações de auditoria e
autorização executadas em PostgreSQL/PGlite isolado, simulando contas, políticas
ausentes, antigas permissivas e antigas por proprietário. Incluiu tentativa de
falsificar proprietário/privilégio, bloqueio de escrita no histórico, leitura
pública, autoria do administrador, preservação após exclusão e rollback em falha.
Incluiu leitura compartilhada por vendedores e administradores e reaplicação
da migration de leitura sem duplicar políticas.
Isso não substitui a aplicação e o teste com as contas reais no Supabase.
O lint global ainda encontra o erro preexistente de `any` em
`src/admin/AdminCartas.tsx:54`; os arquivos desta alteração passam no lint.
