-- Exclusões físicas são validadas pelos serviços transacionais antes do DELETE.
-- O papel continua sem permissão de apagar baixas, estornos ou auditoria.
grant delete on public.os to app_writer;
grant delete on interno.os_rateio to app_writer;
grant delete on public.lote_financeiro to app_writer;
grant delete on public.lote_item to app_writer;
grant delete on interno.lote_item_rateio to app_writer;
