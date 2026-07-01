-- Registra quem CLICOU para concluir a demanda (pode ser diferente do responsável
-- atribuído ao card). Usado no drill-down de "Tarefas Concluídas" nos Relatórios.

ALTER TABLE parking_items
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id);
