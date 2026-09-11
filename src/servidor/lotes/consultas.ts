import { parseDecimal, type Centavos } from '@/dominio/dinheiro';
import type { PorPessoa } from '@/dominio/rateio';
import { sql, type Executor } from '@/servidor/db';

export interface LoteListado {
  id: string;
  numero: number;
  estadoConferencia: string;
  dataEnvio: string | null;
  valorTotal: Centavos;
}

export interface ItemLote {
  id: string;
  ordem: number;
  numeroOsSnapshot: string;
  clienteSnapshot: string;
  produtoSnapshot: string;
  valorComissao: Centavos;
  valorOsSnapshot: Centavos;
  totalPagoClienteSnapshot: Centavos;
  comissaoComprometidaAnteriorSnapshot: Centavos;
  rateio: PorPessoa | null;
}

export interface LoteDetalhe extends LoteListado {
  observacao: string | null;
  itens: ItemLote[];
}

export async function listarLotes(exec: Executor = sql): Promise<LoteListado[]> {
  const linhas = await exec`
    select id, numero, estado_conferencia,
      to_char(data_envio, 'YYYY-MM-DD') as data_envio,
      valor_total_original
    from public.lote_financeiro
    order by numero desc
  `;
  return linhas.map((l) => ({
    id: l.id,
    numero: Number(l.numero),
    estadoConferencia: l.estado_conferencia,
    dataEnvio: l.data_envio,
    valorTotal: parseDecimal(l.valor_total_original),
  }));
}

export async function obterLotePorId(
  loteId: string,
  incluirRateio: boolean,
  exec: Executor = sql,
): Promise<LoteDetalhe | null> {
  const [lote] = await exec`
    select id, numero, estado_conferencia,
      to_char(data_envio, 'YYYY-MM-DD') as data_envio,
      valor_total_original, observacao
    from public.lote_financeiro
    where id = ${loteId}
  `;
  if (!lote) return null;

  // A consulta sem rateio nem toca interno.lote_item_rateio: o papel
  // `financeiro` nunca deve ver rateio, nem por acidente de projeção.
  const itensBrutos = incluirRateio
    ? await exec`
        select li.id, li.ordem, li.numero_os_snapshot, li.cliente_snapshot,
          li.produto_snapshot, li.valor_comissao, li.valor_os_snapshot,
          li.total_pago_cliente_snapshot, li.comissao_comprometida_anterior_snapshot,
          r.valor_thiago, r.valor_geice, r.valor_gabrielle
        from public.lote_item li
        join interno.lote_item_rateio r on r.lote_item_id = li.id
        where li.lote_id = ${loteId}
        order by li.ordem
      `
    : await exec`
        select id, ordem, numero_os_snapshot, cliente_snapshot,
          produto_snapshot, valor_comissao, valor_os_snapshot,
          total_pago_cliente_snapshot, comissao_comprometida_anterior_snapshot
        from public.lote_item
        where lote_id = ${loteId}
        order by ordem
      `;

  return {
    id: lote.id,
    numero: Number(lote.numero),
    estadoConferencia: lote.estado_conferencia,
    dataEnvio: lote.data_envio,
    valorTotal: parseDecimal(lote.valor_total_original),
    observacao: lote.observacao,
    itens: itensBrutos.map((i) => ({
      id: i.id,
      ordem: i.ordem,
      numeroOsSnapshot: i.numero_os_snapshot,
      clienteSnapshot: i.cliente_snapshot,
      produtoSnapshot: i.produto_snapshot,
      valorComissao: parseDecimal(i.valor_comissao),
      valorOsSnapshot: parseDecimal(i.valor_os_snapshot),
      totalPagoClienteSnapshot: parseDecimal(i.total_pago_cliente_snapshot),
      comissaoComprometidaAnteriorSnapshot: parseDecimal(
        i.comissao_comprometida_anterior_snapshot,
      ),
      rateio: incluirRateio
        ? {
            thiago: parseDecimal(i.valor_thiago),
            geice: parseDecimal(i.valor_geice),
            gabrielle: parseDecimal(i.valor_gabrielle),
          }
        : null,
    })),
  };
}
