-- Aplicação explícita: npm.cmd run db:migrate -- 2026102402_imoveis_indices.sql
-- Apenas índices: não modifica colunas, relacionamentos nem registros existentes.
BEGIN;
CREATE INDEX IF NOT EXISTS imoveis_catalogo_idx
  ON public.imoveis (coalesce(destaque,false) DESC, criado_em DESC, id DESC);
CREATE INDEX IF NOT EXISTS imoveis_proprietario_catalogo_idx
  ON public.imoveis (user_id, coalesce(destaque,false) DESC, criado_em DESC, id DESC);
COMMIT;
