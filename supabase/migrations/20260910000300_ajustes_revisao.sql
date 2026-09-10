-- Controle de Comissão — Ajustes apontados na revisão de código
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute (Run),
-- DEPOIS de 20260910000100_base.sql e 20260910000200_privilegios.sql.
--
-- Só ALTER TABLE: nenhuma tabela nova, nenhum dado existente é afetado
-- (as tabelas ainda estão vazias, exceto a linha única de configuração).
-- Não mexe em GRANT/RLS: as políticas de public.controle_financeiro em
-- diante já cobrem colunas novas em tabelas existentes automaticamente.

-- ─────────────────────────────────────────────────────────────
-- os: situação (cancelamento) e vínculo de renegociação (spec §5.4).
-- A Fase 1 não implementa cancelamento/renegociação ainda, mas criar a
-- coluna agora custa uma linha; criar depois, com OS já cadastradas,
-- custaria uma migração de dados.
-- ─────────────────────────────────────────────────────────────
alter table public.os
  add column situacao text not null default 'ativa' check (situacao in ('ativa', 'cancelada')),
  add column os_origem_id uuid references public.os (id);

create index os_situacao_idx on public.os (situacao);

-- Número da OS não pode ser vazio/só espaços (antes só cliente/produto tinham essa checagem).
alter table public.os
  add constraint os_numero_os_nao_vazio check (btrim(numero_os) <> ''),
  add constraint os_numero_os_normalizado_nao_vazio check (numero_os_normalizado <> '');

-- ─────────────────────────────────────────────────────────────
-- baixa_cliente: vínculo com idempotência e regra de estorno (spec §5.6).
-- ─────────────────────────────────────────────────────────────
alter table public.baixa_cliente
  add column operacao_id text references interno.operacao_idempotente (chave),
  add constraint baixa_cliente_estorno_exige_origem_e_motivo check (
    tipo <> 'estorno' or (baixa_origem_id is not null and observacao is not null)
  );

-- ─────────────────────────────────────────────────────────────
-- lote_financeiro: vínculo de substituição (spec §5.7 "lote substituído").
-- ─────────────────────────────────────────────────────────────
alter table public.lote_financeiro
  add column lote_origem_id uuid references public.lote_financeiro (id);

-- ─────────────────────────────────────────────────────────────
-- configuração: auditoria/versão consistente com o resto do modelo
-- (spec §5.1 "toda entidade mutável tem criado_em, criado_por... e versão").
-- ─────────────────────────────────────────────────────────────
alter table public.configuracao_comercial
  add column criado_em timestamptz not null default now(),
  add column criado_por uuid references auth.users (id),
  add column versao integer not null default 1;

alter table interno.configuracao_rateio
  add column criado_em timestamptz not null default now(),
  add column criado_por uuid references auth.users (id),
  add column versao integer not null default 1;
