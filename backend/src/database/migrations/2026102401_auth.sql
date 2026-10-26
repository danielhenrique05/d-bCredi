-- Aplicação explícita: npm run db:migrate -- 2026102401_auth.sql
-- Não altera nomes, tipos, relacionamentos ou dados comerciais existentes.
BEGIN;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS troca_senha_obrigatoria boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  revogada_em timestamptz,
  CHECK (expira_em > criado_em)
);
CREATE INDEX IF NOT EXISTS sessoes_usuario_ativas_idx
  ON public.sessoes (usuario_id) WHERE revogada_em IS NULL;
CREATE INDEX IF NOT EXISTS sessoes_expira_em_idx ON public.sessoes (expira_em);

-- Uma linha por hash de IP/conta. O UPSERT é atômico entre processos da API.
CREATE TABLE IF NOT EXISTS public.auth_login_limites (
  chave_hash text PRIMARY KEY CHECK (chave_hash ~ '^[0-9a-f]{64}$'),
  tentativas integer NOT NULL CHECK (tentativas > 0),
  janela_inicio timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_login_limites_janela_idx
  ON public.auth_login_limites (janela_inicio);

REVOKE ALL ON public.sessoes, public.auth_login_limites FROM PUBLIC;
COMMIT;
