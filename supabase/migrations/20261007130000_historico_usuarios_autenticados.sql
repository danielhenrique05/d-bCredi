-- Aplicar após 20261007120000_historico_imoveis.sql.
-- Libera apenas a leitura do histórico para administradores e vendedores.
-- Não altera registros, a escrita no histórico ou as permissões dos imóveis.
begin;

drop policy if exists credi_historico_admin on public.historico;
drop policy if exists credi_historico_autenticados on public.historico;

create policy credi_historico_autenticados on public.historico
  for select to authenticated using (true);

commit;
