-- Controle de Comissão — Fase 1 — Papel de aplicação, grants e RLS
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute (Run),
-- DEPOIS de aplicar 20260910000100_base.sql com sucesso.
--
-- Este arquivo é versionado no git e por isso NÃO contém senha nenhuma.
-- O papel é criado sem senha (login bloqueado até você definir uma).
-- Depois de rodar este arquivo, rode em uma aba separada do SQL Editor,
-- SEM salvar/commitar esse comando em nenhum arquivo do projeto:
--
--   alter role app_writer with password 'escolha-uma-senha-forte-aqui';
--
-- e cole a mesma senha em DATABASE_URL no seu .env.local (que não vai pro git).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_writer') then
    create role app_writer with login password null;
  end if;
end
$$;

-- app_writer só precisa conectar e usar os schemas de dados; nada de criar
-- objetos, nada de bypass de RLS, nada de privilégios de superusuário.
grant usage on schema public to app_writer;
grant usage on schema interno to app_writer;

grant select, insert, update on public.controle_financeiro to app_writer;
grant select, insert, update on public.configuracao_comercial to app_writer;
grant select, insert, update on interno.configuracao_rateio to app_writer;
grant select, insert, update on public.os to app_writer;
grant select, insert, update on interno.os_rateio to app_writer;
grant select, insert on public.baixa_cliente to app_writer;
grant select, insert, update on public.lote_financeiro to app_writer;
grant select, insert on public.lote_item to app_writer;
grant select, insert on interno.lote_item_rateio to app_writer;
grant select, insert on interno.auditoria_evento to app_writer;
grant select, insert on interno.operacao_idempotente to app_writer;

-- Nenhuma exclusão física é concedida à aplicação: cancelamento/correção é
-- sempre feito por novo registro, nunca por DELETE de movimento financeiro.
-- (public.os e público.lote_financeiro em rascunho são a única exceção,
-- tratada por UPDATE de estado na Fase 1; DELETE físico fica para uma
-- rotina administrativa manual, fora da aplicação.)

-- ─────────────────────────────────────────────────────────────
-- RLS: nega tudo por padrão; libera explicitamente só para app_writer.
-- anon/authenticated (usados pelo Supabase Auth) nunca leem estas tabelas
-- diretamente — a aplicação nunca consulta dados financeiros pela Data API,
-- só pela conexão direta do servidor com app_writer.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  t record;
begin
  for t in
    select schemaname, tablename from pg_tables
    where schemaname in ('public', 'interno')
      and tablename not like 'pg_%'
  loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
    execute format(
      'create policy app_writer_acesso_total on %I.%I for all to app_writer using (true) with check (true)',
      t.schemaname, t.tablename
    );
  end loop;
end
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema interno from anon, authenticated;
