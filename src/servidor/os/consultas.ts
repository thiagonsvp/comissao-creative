import {
  parseDecimal,
  parsePercentual,
  type Centavos,
  type Percentual,
} from '@/dominio/dinheiro';
import {
  comissaoLiberada as calcularComissaoLiberada,
  comissaoTotal as calcularComissaoTotal,
  statusRecebimento,
  type StatusRecebimento,
} from '@/dominio/comissao';
import type { PorPessoa } from '@/dominio/rateio';
import { sql, type Executor } from '@/servidor/db';

export type { Executor };

export interface OsListada {
  id: string;
  numeroOs: string;
  cliente: string;
  produto: string;
  valor: Centavos;
  status: StatusRecebimento;
  comissaoLiberada: Centavos;
  comissaoDisponivel: Centavos;
}

export interface OsDetalhe extends OsListada {
  percentualComissao: Percentual;
  tipoPagamento: string;
  dataVenda: string;
  observacao: string | null;
  totalPagoCliente: Centavos;
  comissaoTotal: Centavos;
  primeiroEnvioEm: string | null;
  rateio: PorPessoa | null;
  baixas: {
    id: string;
    data: string;
    valor: Centavos;
    tipo: 'recebimento' | 'estorno';
    motivo: string | null;
    estornado: Centavos;
  }[];
}

interface LinhaOs {
  id: string;
  numero_os: string;
  cliente: string;
  produto: string;
  valor: string;
  percentual_comissao: string;
  tipo_pagamento: string;
  data_venda: string;
  observacao: string | null;
  primeiro_envio_em: Date | null;
  total_pago: string;
  comprometido: string;
}

/**
 * Projeção comum da OS. Fragmento novo a cada chamada (um Query do
 * postgres.js não deve ser reaproveitado entre execuções) e sem rastro das
 * tabelas de rateio, que são privadas do papel `admin`.
 *
 * `total_pago` respeita o sinal do tipo da baixa, igual a `totalPagoCliente`
 * do domínio; `comprometido` é a comissão já reservada por lotes não
 * cancelados.
 */
function projecaoOs(exec: Executor) {
  return exec`
    o.id, o.numero_os, o.cliente, o.produto, o.valor, o.percentual_comissao,
    o.tipo_pagamento, to_char(o.data_venda, 'YYYY-MM-DD') as data_venda,
    o.observacao,
    o.primeiro_envio_em,
    (
      select coalesce(sum(case when b.tipo = 'estorno' then -b.valor else b.valor end), 0)
      from public.baixa_cliente b
      where b.os_id = o.id
    ) as total_pago,
    (
      select coalesce(sum(li.valor_comissao), 0)
      from public.lote_item li
      join public.lote_financeiro lf on lf.id = li.lote_id
      where li.os_id = o.id and lf.estado_conferencia <> 'cancelado'
    ) as comprometido
  `;
}

function paraListada(linha: LinhaOs): OsListada {
  const valor = parseDecimal(linha.valor);
  const percentual = parsePercentual(linha.percentual_comissao);
  const totalPago = parseDecimal(linha.total_pago);
  const comprometido = parseDecimal(linha.comprometido);
  const liberada = calcularComissaoLiberada(
    calcularComissaoTotal(valor, percentual),
    totalPago,
    valor,
  );
  return {
    id: linha.id,
    numeroOs: linha.numero_os,
    cliente: linha.cliente,
    produto: linha.produto,
    valor,
    status: statusRecebimento(totalPago, valor),
    comissaoLiberada: liberada,
    comissaoDisponivel: liberada > comprometido ? liberada - comprometido : 0n,
  };
}

export async function listarOs(
  filtros: { busca?: string } = {},
  exec: Executor = sql,
): Promise<OsListada[]> {
  const busca = filtros.busca?.trim();
  const linhas: LinhaOs[] = busca
    ? await exec`
        select ${projecaoOs(exec)}
        from public.os o
        where o.numero_os_normalizado like ${`%${busca.toUpperCase()}%`}
           or o.cliente ilike ${`%${busca}%`}
           or o.produto ilike ${`%${busca}%`}
        order by o.data_venda desc, o.numero_os_normalizado
      `
    : await exec`
        select ${projecaoOs(exec)}
        from public.os o
        order by o.data_venda desc, o.numero_os_normalizado
      `;
  return linhas.map(paraListada);
}

export async function obterOsPorId(
  osId: string,
  incluirRateio: boolean,
  exec: Executor = sql,
): Promise<OsDetalhe | null> {
  const [linha] = (await exec`
    select ${projecaoOs(exec)}
    from public.os o
    where o.id = ${osId}
  `) as unknown as LinhaOs[];
  if (!linha) return null;

  let rateio: PorPessoa | null = null;
  if (incluirRateio) {
    const [r] = await exec`
      select rateio_thiago, rateio_geice, rateio_gabrielle
      from interno.os_rateio
      where os_id = ${osId}
    `;
    if (r) {
      rateio = {
        thiago: parsePercentual(r.rateio_thiago),
        geice: parsePercentual(r.rateio_geice),
        gabrielle: parsePercentual(r.rateio_gabrielle),
      };
    }
  }

  const baixas = await exec`
    select b.id, to_char(b.data_efetiva, 'YYYY-MM-DD') as data_efetiva,
      b.valor, b.tipo, b.observacao,
      (
        select coalesce(sum(e.valor), 0)
        from public.baixa_cliente e
        where e.baixa_origem_id = b.id and e.tipo = 'estorno'
      ) as estornado
    from public.baixa_cliente b
    where b.os_id = ${osId}
    order by b.data_efetiva, b.criado_em
  `;

  const base = paraListada(linha);
  const percentual = parsePercentual(linha.percentual_comissao);
  return {
    ...base,
    percentualComissao: percentual,
    tipoPagamento: linha.tipo_pagamento,
    dataVenda: linha.data_venda,
    observacao: linha.observacao,
    totalPagoCliente: parseDecimal(linha.total_pago),
    comissaoTotal: calcularComissaoTotal(base.valor, percentual),
    primeiroEnvioEm: linha.primeiro_envio_em ? linha.primeiro_envio_em.toISOString() : null,
    rateio,
    baixas: baixas.map((b) => ({
      id: b.id,
      data: b.data_efetiva,
      valor: parseDecimal(b.valor),
      tipo: b.tipo as 'recebimento' | 'estorno',
      motivo: b.observacao,
      estornado: parseDecimal(b.estornado),
    })),
  };
}

export interface OsElegivelParaLote {
  id: string;
  numeroOs: string;
  cliente: string;
  comissaoDisponivel: Centavos;
}

export async function listarOsComComissaoDisponivel(
  exec: Executor = sql,
): Promise<OsElegivelParaLote[]> {
  const todas = await listarOs({}, exec);
  return todas
    .filter((os) => os.comissaoDisponivel > 0n)
    .map((os) => ({
      id: os.id,
      numeroOs: os.numeroOs,
      cliente: os.cliente,
      comissaoDisponivel: os.comissaoDisponivel,
    }));
}
