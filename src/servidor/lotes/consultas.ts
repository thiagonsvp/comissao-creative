import { parseDecimal, type Centavos } from '@/dominio/dinheiro';
import type { PorPessoa } from '@/dominio/rateio';
import { sql, type Executor } from '@/servidor/db';

export interface LoteListado {
  id: string;
  numero: number;
  estadoConferencia: string;
  dataEnvio: string | null;
  dataAprovacao: string | null;
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
  /**
   * Quanto o cliente pagou desde o lote anterior desta mesma OS até este —
   * a base que, multiplicada pelo percentual, gera `valorComissao`. Igual ao
   * total pago quando é a primeira vez que a OS aparece num lote.
   */
  pagoReferenteAoLoteSnapshot: Centavos;
  rateio: PorPessoa | null;
}

export interface LoteDetalhe extends LoteListado {
  observacao: string | null;
  motivoCancelamento: string | null;
  loteOrigem: { id: string; numero: number } | null;
  loteSubstituto: { id: string; numero: number } | null;
  itens: ItemLote[];
}

export async function listarLotes(exec: Executor = sql): Promise<LoteListado[]> {
  const linhas = await exec`
    select id, numero, estado_conferencia,
      to_char(data_envio, 'YYYY-MM-DD') as data_envio,
      to_char(aprovado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data_aprovacao,
      valor_total_original
    from public.lote_financeiro
    order by numero desc
  `;
  return linhas.map((l) => ({
    id: l.id,
    numero: Number(l.numero),
    estadoConferencia: l.estado_conferencia,
    dataEnvio: l.data_envio,
    dataAprovacao: l.data_aprovacao,
    valorTotal: parseDecimal(l.valor_total_original),
  }));
}

export async function obterLotePorId(
  loteId: string,
  incluirRateio: boolean,
  exec: Executor = sql,
): Promise<LoteDetalhe | null> {
  const [lote] = await exec`
    select lf.id, lf.numero, lf.estado_conferencia,
      to_char(lf.data_envio, 'YYYY-MM-DD') as data_envio,
      to_char(lf.aprovado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data_aprovacao,
      lf.valor_total_original, lf.observacao, lf.motivo_cancelamento,
      origem.id as origem_id, origem.numero as origem_numero,
      substituto.id as substituto_id, substituto.numero as substituto_numero
    from public.lote_financeiro lf
    left join public.lote_financeiro origem on origem.id = lf.lote_origem_id
    left join public.lote_financeiro substituto on substituto.lote_origem_id = lf.id
    where lf.id = ${loteId}
  `;
  if (!lote) return null;

  // O pago referente a cada item é a diferença para o item anterior da
  // mesma OS — comparando (número do lote, ordem do item), não a data,
  // porque duas linhas do mesmo lote têm o mesmo instante de criação e um
  // lote cancelado no meio pode deixar mais de um item da mesma OS num
  // único lote novo. `0` quando é a primeira vez que a OS aparece.
  const pagoAnteriorFragmento = exec`
    coalesce((
      select li2.total_pago_cliente_snapshot
      from public.lote_item li2
      join public.lote_financeiro lf2 on lf2.id = li2.lote_id
      where li2.os_id = li.os_id
        and lf2.estado_conferencia <> 'cancelado'
        and (lf2.numero, li2.ordem) < (${lote.numero}, li.ordem)
      order by lf2.numero desc, li2.ordem desc
      limit 1
    ), 0) as pago_anterior
  `;

  // A consulta sem rateio nem toca interno.lote_item_rateio: o papel
  // `financeiro` nunca deve ver rateio, nem por acidente de projeção.
  const itensBrutos = incluirRateio
    ? await exec`
        select li.id, li.ordem, li.numero_os_snapshot, li.cliente_snapshot,
          li.produto_snapshot, li.valor_comissao, li.valor_os_snapshot,
          li.total_pago_cliente_snapshot, li.comissao_comprometida_anterior_snapshot,
          ${pagoAnteriorFragmento},
          r.valor_thiago, r.valor_geice, r.valor_gabrielle
        from public.lote_item li
        join interno.lote_item_rateio r on r.lote_item_id = li.id
        where li.lote_id = ${loteId}
        order by li.ordem
      `
    : await exec`
        select li.id, li.ordem, li.numero_os_snapshot, li.cliente_snapshot,
          li.produto_snapshot, li.valor_comissao, li.valor_os_snapshot,
          li.total_pago_cliente_snapshot, li.comissao_comprometida_anterior_snapshot,
          ${pagoAnteriorFragmento}
        from public.lote_item li
        where li.lote_id = ${loteId}
        order by li.ordem
      `;

  return {
    id: lote.id,
    numero: Number(lote.numero),
    estadoConferencia: lote.estado_conferencia,
    dataEnvio: lote.data_envio,
    dataAprovacao: lote.data_aprovacao,
    valorTotal: parseDecimal(lote.valor_total_original),
    observacao: lote.observacao,
    motivoCancelamento: lote.motivo_cancelamento,
    loteOrigem: lote.origem_id
      ? { id: lote.origem_id, numero: Number(lote.origem_numero) }
      : null,
    loteSubstituto: lote.substituto_id
      ? { id: lote.substituto_id, numero: Number(lote.substituto_numero) }
      : null,
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
      pagoReferenteAoLoteSnapshot:
        parseDecimal(i.total_pago_cliente_snapshot) - parseDecimal(i.pago_anterior),
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
