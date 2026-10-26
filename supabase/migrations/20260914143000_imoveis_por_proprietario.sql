-- Cada imóvel pertence ao usuário do Supabase que o cadastrou.
-- Registros antigos ficam sem proprietário até serem atribuídos manualmente.
alter table public.imoveis
  add column if not exists user_id uuid references auth.users(id) on delete restrict;

create index if not exists imoveis_user_id_idx on public.imoveis (user_id);

alter table public.imoveis enable row level security;

drop policy if exists "Imoveis publicamente visiveis" on public.imoveis;
drop policy if exists "Usuarios criam os proprios imoveis" on public.imoveis;
drop policy if exists "Usuarios atualizam os proprios imoveis" on public.imoveis;
drop policy if exists "Usuarios excluem os proprios imoveis" on public.imoveis;

-- Mantém os anúncios disponíveis para a vitrine pública.
create policy "Imoveis publicamente visiveis"
  on public.imoveis for select
  using (true);

create policy "Usuarios criam os proprios imoveis"
  on public.imoveis for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Usuarios atualizam os proprios imoveis"
  on public.imoveis for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuarios excluem os proprios imoveis"
  on public.imoveis for delete
  to authenticated
  using (auth.uid() = user_id);

-- Para atribuir anúncios já existentes, execute uma vez para cada proprietário:
-- update public.imoveis set user_id = '<uuid-do-usuario>' where id = '<uuid-do-imovel>';
