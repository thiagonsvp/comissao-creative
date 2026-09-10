-- Controle de Comissão — Fase 1 — Schemas, tabelas e índices
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute (Run).

create extension if not exists pgcrypto;

create schema if not exists interno;
revoke all on schema interno from public;

-- ─────────────────────────────────────────────────────────────
-- Trigger utilitária: atualiza atualizado_em automaticamente
-- ─────────────────────────────────────────────────────────────
create or replace function interno.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Linha de controle financeiro global (bloqueio por transação)
-- ─────────────────────────────────────────────────────────────
create table public.controle_financeiro (
  id smallint primary key default 1,
  atualizado_em timestamptz not null default now(),
  constraint controle_financeiro_unica_linha check (id = 1)
);
insert into public.controle_financeiro (id) values (1);

-- ─────────────────────────────────────────────────────────────
-- Configuração comercial (padrões) e rateio padrão (privado)
-- ─────────────────────────────────────────────────────────────
create table public.configuracao_comercial (
  id smallint primary key default 1,
  percentual_comissao_padrao numeric(5,2) not null
    check (percentual_comissao_padrao between 0 and 100),
  fuso_negocio text not null default 'America/Sao_Paulo',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id),
  constraint configuracao_comercial_unica_linha check (id = 1)
);

create table interno.configuracao_rateio (
  configuracao_id smallint primary key references public.configuracao_comercial (id),
  rateio_thiago_padrao numeric(5,2) not null check (rateio_thiago_padrao between 0 and 100),
  rateio_geice_padrao numeric(5,2) not null check (rateio_geice_padrao between 0 and 100),
  rateio_gabrielle_padrao numeric(5,2) not null check (rateio_gabrielle_padrao between 0 and 100),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id)
);

insert into public.configuracao_comercial (id, percentual_comissao_padrao) values (1, 7.00);
insert into interno.configuracao_rateio (configuracao_id, rateio_thiago_padrao, rateio_geice_padrao, rateio_gabrielle_padrao)
values (1, 5.00, 1.00, 1.00);

-- ─────────────────────────────────────────────────────────────
-- OS (ordens de serviço) e rateio da OS (privado)
-- ─────────────────────────────────────────────────────────────
create table public.os (
  id uuid primary key default gen_random_uuid(),
  numero_os text not null,
  numero_os_normalizado text not null,
  cliente text not null check (btrim(cliente) <> ''),
  produto text not null check (btrim(produto) <> ''),
  tipo_pagamento text not null default '',
  valor numeric(12,2) not null check (valor > 0),
  percentual_comissao numeric(5,2) not null check (percentual_comissao between 0 and 100),
  data_venda date not null,
  data_cadastro date not null default (now() at time zone 'America/Sao_Paulo')::date,
  primeiro_envio_em timestamptz,
  observacao text,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id),
  unique (numero_os_normalizado)
);

create trigger os_tocar_atualizado_em
  before update on public.os
  for each row execute function interno.tocar_atualizado_em();

create index os_data_venda_idx on public.os (data_venda);
create index os_cliente_idx on public.os (lower(cliente));
create index os_produto_idx on public.os (lower(produto));

create table interno.os_rateio (
  os_id uuid primary key references public.os (id) on delete restrict,
  rateio_thiago numeric(5,2) not null check (rateio_thiago between 0 and 100),
  rateio_geice numeric(5,2) not null check (rateio_geice between 0 and 100),
  rateio_gabrielle numeric(5,2) not null check (rateio_gabrielle between 0 and 100),
  algoritmo_rateio text not null default 'divisores_v1'
);

-- ─────────────────────────────────────────────────────────────
-- Baixas do cliente (recebimentos). Estorno (tipo) fica reservado
-- para uma fase futura; o serviço da Fase 1 só grava 'recebimento'.
-- ─────────────────────────────────────────────────────────────
create table public.baixa_cliente (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references public.os (id) on delete restrict,
  tipo text not null default 'recebimento' check (tipo in ('recebimento', 'estorno')),
  baixa_origem_id uuid references public.baixa_cliente (id),
  data_efetiva date not null,
  valor numeric(12,2) not null check (valor > 0),
  referencia_externa text,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id)
);

create index baixa_cliente_os_id_idx on public.baixa_cliente (os_id);
create index baixa_cliente_data_efetiva_idx on public.baixa_cliente (data_efetiva);

-- ─────────────────────────────────────────────────────────────
-- Lotes enviados ao financeiro
-- ─────────────────────────────────────────────────────────────
create table public.lote_financeiro (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  estado_conferencia text not null default 'rascunho'
    check (estado_conferencia in ('rascunho', 'enviado', 'aprovado', 'cancelado')),
  data_envio date,
  enviado_em timestamptz,
  enviado_por uuid references auth.users (id),
  aprovado_em timestamptz,
  aprovado_por uuid references auth.users (id),
  data_prevista_pagamento date,
  valor_total_original numeric(12,2) not null default 0 check (valor_total_original >= 0),
  motivo_divergencia text,
  motivo_cancelamento text,
  observacao text,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id)
);

create trigger lote_financeiro_tocar_atualizado_em
  before update on public.lote_financeiro
  for each row execute function interno.tocar_atualizado_em();

create index lote_financeiro_estado_idx on public.lote_financeiro (estado_conferencia);
create index lote_financeiro_data_envio_idx on public.lote_financeiro (data_envio);

create table public.lote_item (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lote_financeiro (id) on delete restrict,
  os_id uuid not null references public.os (id) on delete restrict,
  ordem integer not null check (ordem > 0),
  inicio_centavo bigint not null check (inicio_centavo >= 0),
  fim_centavo bigint not null check (fim_centavo > inicio_centavo),
  valor_comissao numeric(12,2) not null check (valor_comissao > 0),
  numero_os_snapshot text not null,
  cliente_snapshot text not null,
  produto_snapshot text not null,
  valor_os_snapshot numeric(12,2) not null,
  percentual_comissao_snapshot numeric(5,2) not null,
  total_pago_cliente_snapshot numeric(12,2) not null,
  comissao_liberada_snapshot numeric(12,2) not null,
  comissao_comprometida_anterior_snapshot numeric(12,2) not null,
  versao_calculo text not null,
  criado_em timestamptz not null default now(),
  unique (lote_id, ordem)
);

create index lote_item_lote_id_idx on public.lote_item (lote_id);
create index lote_item_os_id_idx on public.lote_item (os_id);

-- Nota: a garantia de não sobreposição de intervalos por OS é feita pelo
-- serviço transacional sob o bloqueio de controle_financeiro (ver §11.2 da
-- spec). Uma restrição de exclusão no banco pode ser adicionada depois se o
-- volume exigir uma segunda camada de proteção.

create table interno.lote_item_rateio (
  lote_item_id uuid primary key references public.lote_item (id) on delete restrict,
  valor_thiago numeric(12,2) not null check (valor_thiago >= 0),
  valor_geice numeric(12,2) not null check (valor_geice >= 0),
  valor_gabrielle numeric(12,2) not null check (valor_gabrielle >= 0),
  rateio_thiago numeric(5,2) not null,
  rateio_geice numeric(5,2) not null,
  rateio_gabrielle numeric(5,2) not null,
  algoritmo_rateio text not null default 'divisores_v1'
);

-- ─────────────────────────────────────────────────────────────
-- Auditoria e idempotência (privadas — nunca expostas ao financeiro)
-- ─────────────────────────────────────────────────────────────
create table interno.auditoria_evento (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,
  entidade_id uuid not null,
  acao text not null,
  responsavel_id uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  data_efetiva date,
  motivo text,
  valores_anteriores jsonb,
  valores_novos jsonb,
  operacao_id uuid
);

create index auditoria_evento_entidade_idx on interno.auditoria_evento (entidade, entidade_id);

create table interno.operacao_idempotente (
  chave text primary key,
  usuario_id uuid references auth.users (id),
  tipo_acao text not null,
  hash_conteudo text not null,
  resultado jsonb not null,
  concluido_em timestamptz not null default now()
);
