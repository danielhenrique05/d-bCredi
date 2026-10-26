-- Aplicação explícita: npm.cmd run db:migrate -- 2026102601_historico_indices.sql
-- Não executar em desenvolvimento sem autorização. Não altera registros ou FKs.
BEGIN;
CREATE INDEX IF NOT EXISTS historico_criado_em_id_idx
  ON public.historico (criado_em DESC, id DESC);
CREATE INDEX IF NOT EXISTS historico_entidade_data_id_idx
  ON public.historico (entidade, entidade_id, criado_em DESC, id DESC);
CREATE INDEX IF NOT EXISTS historico_usuario_data_id_idx
  ON public.historico (user_id, criado_em DESC, id DESC);
COMMIT;
