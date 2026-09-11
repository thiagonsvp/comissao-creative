import type postgres from 'postgres';
import { hojeNegocio } from '@/dominio/datas';
import {
  paraDecimalDb,
  paraPercentualDb,
  parseDecimal,
  parsePercentual,
  type Centavos,
} from '@/dominio/dinheiro';
import { ErroValidacao } from '@/dominio/erros';
import {
  calcularItensLote,
  totalItens,
  VERSAO_CALCULO,
  type ItemLoteCalculado,
  type OsParaLote,
} from '@/dominio/lote';
import { registrarAuditoria } from '@/servidor/auditoria';

export interface DadosGerarLote {
  osIds: string[];
  observacao: string | null;
}

export interface ResultadoLote {
  loteId: string;
  numero: number;
  valorTotal: Centavos;
}

/**
 * Carrega tudo que o cálculo de lote precisa, com `for update` nas linhas de
 * `os` para que dois envios concorrentes não reservem o mesmo trecho. As
 * reservas ativas vêm como texto para não passar por número de ponto
 * flutuante no caminho do JSON.
 */
export async function carregarOsParaLote(
  tx: postgres.TransactionSql,
  osIds: string[],
): Promise<OsParaLote[]> {
  if (osIds.length === 0) return [];

  const linhas = await tx`
    select
      o.id, o.numero_os, o.numero_os_normalizado, o.cliente, o.produto,
      o.valor, o.percentual_comissao,
      r.rateio_thiago, r.rateio_geice, r.rateio_gabrielle,
      (
        select coalesce(sum(case when b.tipo = 'estorno' then -b.valor else b.valor end), 0)
        from public.baixa_cliente b
        where b.os_id = o.id
      ) as total_pago,
      coalesce((
        select json_agg(json_build_object(
          'inicio', li.inicio_centavo::text,
          'fim', li.fim_centavo::text
        ))
        from public.lote_item li
        join public.lote_financeiro lf on lf.id = li.lote_id
        where li.os_id = o.id and lf.estado_conferencia <> 'cancelado'
      ), '[]') as reservas
    from public.os o
    join interno.os_rateio r on r.os_id = o.id
    where o.id in ${tx(osIds)}
    for update of o
  `;

  return linhas.map((l) => ({
    osId: l.id,
    numeroOs: l.numero_os,
    numeroOsNormalizado: l.numero_os_normalizado,
    cliente: l.cliente,
    produto: l.produto,
    valorOs: parseDecimal(l.valor),
    percentualComissao: parsePercentual(l.percentual_comissao),
    totalPagoCliente: parseDecimal(l.total_pago),
    reservasAtivas: (l.reservas as { inicio: string; fim: string }[]).map((r) => ({
      inicio: BigInt(r.inicio),
      fim: BigInt(r.fim),
    })),
    pesos: {
      thiago: parsePercentual(l.rateio_thiago),
      geice: parsePercentual(l.rateio_geice),
      gabrielle: parsePercentual(l.rateio_gabrielle),
    },
  }));
}

async function inserirItem(
  tx: postgres.TransactionSql,
  loteId: string,
  item: ItemLoteCalculado,
  pesos: OsParaLote['pesos'],
): Promise<void> {
  const [linhaItem] = await tx`
    insert into public.lote_item
      (lote_id, os_id, ordem, inicio_centavo, fim_centavo, valor_comissao,
       numero_os_snapshot, cliente_snapshot, produto_snapshot, valor_os_snapshot,
       percentual_comissao_snapshot, total_pago_cliente_snapshot,
       comissao_liberada_snapshot, comissao_comprometida_anterior_snapshot, versao_calculo)
    values (
      ${loteId}, ${item.osId}, ${item.ordem}, ${item.inicio.toString()}, ${item.fim.toString()},
      ${paraDecimalDb(item.valorComissao)},
      ${item.snapshot.numeroOs}, ${item.snapshot.cliente}, ${item.snapshot.produto},
      ${paraDecimalDb(item.snapshot.valorOs)},
      ${paraPercentualDb(item.snapshot.percentualComissao)},
      ${paraDecimalDb(item.snapshot.totalPagoCliente)},
      ${paraDecimalDb(item.snapshot.comissaoLiberada)},
      ${paraDecimalDb(item.snapshot.comissaoComprometidaAnterior)},
      ${VERSAO_CALCULO}
    )
    returning id
  `;

  await tx`
    insert into interno.lote_item_rateio
      (lote_item_id, valor_thiago, valor_geice, valor_gabrielle,
       rateio_thiago, rateio_geice, rateio_gabrielle)
    values (
      ${linhaItem.id},
      ${paraDecimalDb(item.rateio.thiago)},
      ${paraDecimalDb(item.rateio.geice)},
      ${paraDecimalDb(item.rateio.gabrielle)},
      ${paraPercentualDb(pesos.thiago)},
      ${paraPercentualDb(pesos.geice)},
      ${paraPercentualDb(pesos.gabrielle)}
    )
  `;
}

export async function gerarLote(
  tx: postgres.TransactionSql,
  dados: DadosGerarLote,
  usuarioId: string,
): Promise<ResultadoLote> {
  if (dados.osIds.length === 0) {
    throw new ErroValidacao('Selecione ao menos uma OS');
  }

  const oss = await carregarOsParaLote(tx, dados.osIds);
  if (oss.length !== new Set(dados.osIds).size) {
    throw new ErroValidacao('Alguma OS selecionada não foi encontrada');
  }

  const itens = calcularItensLote(oss);
  const valorTotal = totalItens(itens);
  const dataEnvio = hojeNegocio();
  const pesosPorOs = new Map(oss.map((os) => [os.osId, os.pesos]));

  const [lote] = await tx`
    insert into public.lote_financeiro
      (estado_conferencia, data_envio, enviado_em, enviado_por,
       valor_total_original, observacao, criado_por, atualizado_por)
    values (
      'enviado', ${dataEnvio}, now(), ${usuarioId},
      ${paraDecimalDb(valorTotal)}, ${dados.observacao}, ${usuarioId}, ${usuarioId}
    )
    returning id, numero
  `;

  for (const item of itens) {
    await inserirItem(tx, lote.id, item, pesosPorOs.get(item.osId)!);
  }

  await tx`
    update public.os
    set primeiro_envio_em = coalesce(primeiro_envio_em, now())
    where id in ${tx(dados.osIds)}
  `;

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro',
    entidadeId: lote.id,
    acao: 'gerar',
    responsavelId: usuarioId,
    dataEfetiva: dataEnvio,
    valoresNovos: {
      osIds: dados.osIds,
      valorTotal,
      quantidadeItens: itens.length,
    },
  });

  return { loteId: lote.id, numero: Number(lote.numero), valorTotal };
}

export async function aprovarLote(
  tx: postgres.TransactionSql,
  loteId: string,
  usuarioId: string,
): Promise<void> {
  const [lote] = await tx`
    select estado_conferencia from public.lote_financeiro
    where id = ${loteId} for update
  `;
  if (!lote) throw new ErroValidacao('Lote não encontrado');
  if (lote.estado_conferencia !== 'enviado') {
    throw new ErroValidacao('Só é possível aprovar um lote que está enviado');
  }

  await tx`
    update public.lote_financeiro
    set estado_conferencia = 'aprovado',
        aprovado_em = now(),
        aprovado_por = ${usuarioId},
        atualizado_por = ${usuarioId}
    where id = ${loteId}
  `;

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro',
    entidadeId: loteId,
    acao: 'aprovar',
    responsavelId: usuarioId,
  });
}
