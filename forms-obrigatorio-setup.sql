-- ================================================================
-- BuzzUp — Formulário obrigatório ou opcional
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Obrigatório (padrão): a pessoa só pode marcar que preencheu.
-- Opcional: aparece também o botão "Não vou preencher".

ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------
-- Conferência: deve aparecer uma linha
-- ---------------------------------------------------------------
SELECT column_name AS coluna_criada
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspace_forms' AND column_name = 'required';
