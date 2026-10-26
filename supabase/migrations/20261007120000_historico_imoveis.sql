-- Aplicar manualmente no SQL Editor do Supabase, como postgres.
-- Independente da migration anterior: imoveis.user_id já deve existir.
-- Não altera imóveis existentes nem recria user_id.
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'imoveis'
      and column_name = 'user_id' and data_type = 'uuid'
  ) then
    raise exception 'Pré-requisito: public.imoveis.user_id deve existir e ser UUID.';
  end if;
  if to_regclass('public.historico') is not null then
    raise exception 'public.historico já existe. Confira se esta migration já foi aplicada ou se há histórico a reaproveitar.';
  end if;
end;
$$;

-- Único adaptador SQL para a autenticação atual. Na futura VPS, substituir
-- esta função para obter a identidade validada pela API; não confiar em IDs
-- ou nomes enviados livremente pelo cliente. Não cria cadastro de usuários.
create function public.credi_usuario_atual()
returns table (user_id uuid, nome text, email text, administrador boolean)
language sql stable security definer
set search_path = ''
as $$
  select u.id,
    coalesce(nullif(btrim(u.raw_user_meta_data->>'nome'), ''),
             nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
             nullif(btrim(u.raw_user_meta_data->>'name'), '')),
    u.email::text,
    coalesce(u.raw_app_meta_data->>'role' = 'admin', false)
  from auth.users u
  where u.id = auth.uid();
$$;

revoke all on function public.credi_usuario_atual() from public, anon, authenticated;
grant execute on function public.credi_usuario_atual() to authenticated;

create function public.credi_e_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select administrador from public.credi_usuario_atual()), false);
$$;

revoke all on function public.credi_e_admin() from public, anon, authenticated;
grant execute on function public.credi_e_admin() to anon, authenticated;

-- Estrutura PostgreSQL comum. Sem FK para o imóvel ou para auth.users:
-- os registros precisam sobreviver à exclusão do imóvel/conta responsável.
create table public.historico (
  id bigint generated always as identity primary key,
  user_id uuid,
  usuario_nome text,
  usuario_email text,
  acao text not null check (acao in ('CREATE', 'UPDATE', 'DELETE')),
  entidade text not null,
  entidade_id text not null,
  descricao text not null,
  criado_em timestamptz not null default now()
);

create index historico_criado_em_id_idx on public.historico (criado_em desc, id desc);
create index historico_entidade_idx on public.historico (entidade, entidade_id);
create index if not exists imoveis_user_id_idx on public.imoveis (user_id);

alter table public.historico enable row level security;
revoke all on public.historico from public, anon, authenticated;
revoke all on sequence public.historico_id_seq from public, anon, authenticated;
grant select on public.historico to authenticated;

create policy credi_historico_admin on public.historico
  for select to authenticated using ((select public.credi_e_admin()));

-- Auditoria atômica: um erro aqui cancela também a alteração do imóvel.
-- Não copia descrição livre, fotos, senhas, tokens ou metadados completos.
create function public.credi_registrar_imovel()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  autor record;
  registro record;
  acao_historico text;
  verbo text;
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return new;
  end if;

  select * into autor from public.credi_usuario_atual();
  if tg_op = 'DELETE' then
    registro := old;
    acao_historico := 'DELETE';
    verbo := 'Excluiu';
  elsif tg_op = 'INSERT' then
    registro := new;
    acao_historico := 'CREATE';
    verbo := 'Criou';
  else
    registro := new;
    acao_historico := 'UPDATE';
    verbo := 'Editou';
  end if;

  insert into public.historico
    (user_id, usuario_nome, usuario_email, acao, entidade, entidade_id, descricao)
  values (
    autor.user_id, autor.nome, autor.email, acao_historico, 'imovel', registro.id::text,
    format('%s o imóvel "%s".', verbo, left(coalesce(registro.titulo, 'Sem título'), 160))
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.credi_registrar_imovel() from public, anon, authenticated;

create trigger credi_imoveis_historico
  after insert or update or delete on public.imoveis
  for each row execute function public.credi_registrar_imovel();

alter table public.imoveis enable row level security;
grant select on public.imoveis to anon, authenticated;
grant insert, update, delete on public.imoveis to authenticated;
revoke truncate on public.imoveis from public, anon, authenticated;

-- As permissões novas coexistem com as antigas. As políticas RESTRICTIVE
-- impedem que uma política permissiva antiga (OR) libere alterações indevidas.
-- Não removemos políticas desconhecidas nem presumimos a migration anterior.
create policy credi_imoveis_leitura on public.imoveis
  for select to anon, authenticated using (true);

create policy credi_imoveis_insert on public.imoveis
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy credi_imoveis_insert_limite on public.imoveis as restrictive
  for insert to public
  with check (user_id = (select auth.uid()));

create policy credi_imoveis_update on public.imoveis
  for update to authenticated
  using ((select public.credi_e_admin()) or user_id = (select auth.uid()))
  with check ((select public.credi_e_admin()) or user_id = (select auth.uid()));
create policy credi_imoveis_update_limite on public.imoveis as restrictive
  for update to public
  using ((select public.credi_e_admin()) or user_id = (select auth.uid()))
  with check ((select public.credi_e_admin()) or user_id = (select auth.uid()));

create policy credi_imoveis_delete on public.imoveis
  for delete to authenticated
  using ((select public.credi_e_admin()) or user_id = (select auth.uid()));
create policy credi_imoveis_delete_limite on public.imoveis as restrictive
  for delete to public
  using ((select public.credi_e_admin()) or user_id = (select auth.uid()));

commit;
