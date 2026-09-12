import type postgres from 'postgres';
import { dataNaoFutura, hojeNegocio } from '@/dominio/datas';
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
  /** Preenchido quando este lote substitui um lote cancelado. */
  loteOrigemId?: string;
}

export interface ResultadoLote {
  loteId: string;
  numero: number;
  valorTotal: Centavos;
}

export interface DatasLote {
  dataEnvio: string;
  dataAprovacao: string | null;
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
       valor_total_original, observacao, lote_origem_id, criado_por, atualizado_por)
    values (
      'enviado', ${dataEnvio}, now(), ${usuarioId},
      ${paraDecimalDb(valorTotal)}, ${dados.observacao},
      ${dados.loteOrigemId ?? null}, ${usuarioId}, ${usuarioId}
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
  data: string = hojeNegocio(),
): Promise<void> {
  const dataAprovacao = dataNaoFutura(data, 'dataAprovacao');
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
        aprovado_em = (
          (${dataAprovacao}::date + time '12:00') at time zone 'America/Sao_Paulo'
        ),
        aprovado_por = ${usuarioId},
        atualizado_por = ${usuarioId}
    where id = ${loteId}
  `;

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro',
    entidadeId: loteId,
    acao: 'aprovar',
    responsavelId: usuarioId,
    dataEfetiva: dataAprovacao,
    valoresNovos: { estadoConferencia: 'aprovado', dataAprovacao },
  });
}

/**
 * Cancelar não apaga nada: o lote continua existindo, marcado como cancelado,
 * e os itens permanecem. A liberação das reservas é automática — todo cálculo
 * de comissão comprometida já ignora lotes cancelados.
 */
export async function cancelarLote(
  tx: postgres.TransactionSql,
  loteId: string,
  motivo: string,
  usuarioId: string,
): Promise<void> {
  const motivoLimpo = motivo.trim();
  if (motivoLimpo === '') {
    throw new ErroValidacao('O motivo do cancelamento é obrigatório', 'motivo');
  }

  const [lote] = await tx`
    select estado_conferencia from public.lote_financeiro
    where id = ${loteId} for update
  `;
  if (!lote) throw new ErroValidacao('Lote não encontrado');
  if (lote.estado_conferencia !== 'enviado') {
    throw new ErroValidacao(
      lote.estado_conferencia === 'aprovado'
        ? 'Este lote já foi aprovado. Desfaça a aprovação antes de cancelar.'
        : 'Só é possível cancelar um lote que está aguardando conferência.',
    );
  }

  await tx`
    update public.lote_financeiro
    set estado_conferencia = 'cancelado',
        motivo_cancelamento = ${motivoLimpo},
        versao = versao + 1,
        atualizado_por = ${usuarioId}
    where id = ${loteId}
  `;

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro',
    entidadeId: loteId,
    acao: 'cancelar',
    responsavelId: usuarioId,
    motivo: motivoLimpo,
    valoresAnteriores: { estadoConferencia: lote.estado_conferencia },
    valoresNovos: { estadoConferencia: 'cancelado' },
  });
}

/**
 * Aprovar é, no fluxo do usuário, o registro de que o dinheiro entrou. Desfazer
 * existe para que um clique errado não vire um beco sem saída.
 */
export async function desfazerAprovacaoLote(
  tx: postgres.TransactionSql,
  loteId: string,
  motivo: string,
  usuarioId: string,
): Promise<void> {
  const motivoLimpo = motivo.trim();
  if (motivoLimpo === '') {
    throw new ErroValidacao('O motivo é obrigatório', 'motivo');
  }

  const [lote] = await tx`
    select estado_conferencia, aprovado_em,
      to_char(aprovado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data_aprovacao
    from public.lote_financeiro
    where id = ${loteId} for update
  `;
  if (!lote) throw new ErroValidacao('Lote não encontrado');
  if (lote.estado_conferencia !== 'aprovado') {
    throw new ErroValidacao('Só é possível desfazer a aprovação de um lote aprovado.');
  }

  await tx`
    update public.lote_financeiro
    set estado_conferencia = 'enviado',
        aprovado_em = null,
        aprovado_por = null,
        versao = versao + 1,
        atualizado_por = ${usuarioId}
    where id = ${loteId}
  `;

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro',
    entidadeId: loteId,
    acao: 'desfazer_aprovacao',
    responsavelId: usuarioId,
    motivo: motivoLimpo,
    valoresAnteriores: {
      estadoConferencia: 'aprovado',
      aprovadoEm: lote.aprovado_em,
      dataAprovacao: lote.data_aprovacao,
    },
    valoresNovos: { estadoConferencia: 'enviado' },
  });
}

export async function editarDatasLote(
  tx: postgres.TransactionSql,
  loteId: string,
  datas: DatasLote,
  usuarioId: string,
): Promise<void> {
  const dataEnvio = dataNaoFutura(datas.dataEnvio, 'dataEnvio');
  const [lote] = await tx`
    select estado_conferencia,
      to_char(data_envio, 'YYYY-MM-DD') as data_envio,
      to_char(aprovado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data_aprovacao
    from public.lote_financeiro
    where id = ${loteId}
    for update
  `;
  if (!lote) throw new ErroValidacao('Lote não encontrado', 'loteId');

  let dataAprovacao: string | null = null;
  if (lote.estado_conferencia === 'aprovado') {
    if (!datas.dataAprovacao) {
      throw new ErroValidacao('A data de aprovação é obrigatória', 'dataAprovacao');
    }
    dataAprovacao = dataNaoFutura(datas.dataAprovacao, 'dataAprovacao');
  }

  await tx`
    update public.lote_financeiro
    set data_envio = ${dataEnvio},
        aprovado_em = case
          when estado_conferencia = 'aprovado' then
            ((${dataAprovacao}::date + time '12:00') at time zone 'America/Sao_Paulo')
          else aprovado_em
        end,
        versao = versao + 1,
        atualizado_por = ${usuarioId}
    where id = ${loteId}
  `;

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro',
    entidadeId: loteId,
    acao: 'editar_datas',
    responsavelId: usuarioId,
    dataEfetiva: dataAprovacao ?? dataEnvio,
    valoresAnteriores: {
      dataEnvio: lote.data_envio,
      dataAprovacao: lote.data_aprovacao,
    },
    valoresNovos: { dataEnvio, dataAprovacao },
  });
}

/** Remove um lote ainda sem aprovação e todos os seus snapshots internos. */
export async function excluirLote(
  tx: postgres.TransactionSql,
  loteId: string,
  usuarioId: string,
): Promise<void> {
  const [lote] = await tx`
    select numero, estado_conferencia, valor_total_original,
      to_char(data_envio, 'YYYY-MM-DD') as data_envio
    from public.lote_financeiro
    where id = ${loteId}
    for update
  `;
  if (!lote) throw new ErroValidacao('Lote não encontrado', 'loteId');
  if (lote.estado_conferencia === 'aprovado') {
    throw new ErroValidacao(
      'Desfaça a aprovação antes de excluir este lote.',
      'loteId',
    );
  }

  const [vinculo] = await tx`
    select exists(
      select 1 from public.lote_financeiro where lote_origem_id = ${loteId}
    ) as tem_substituto
  `;
  if (vinculo.tem_substituto) {
    throw new ErroValidacao(
      'Este lote possui um lote substituto e não pode ser excluído.',
      'loteId',
    );
  }

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro',
    entidadeId: loteId,
    acao: 'excluir',
    responsavelId: usuarioId,
    dataEfetiva: lote.data_envio,
    valoresAnteriores: {
      numero: Number(lote.numero),
      estadoConferencia: lote.estado_conferencia,
      valorTotal: parseDecimal(lote.valor_total_original),
      dataEnvio: lote.data_envio,
    },
  });

  await tx`
    delete from interno.lote_item_rateio r
    using public.lote_item li
    where r.lote_item_id = li.id and li.lote_id = ${loteId}
  `;
  await tx`delete from public.lote_item where lote_id = ${loteId}`;
  await tx`delete from public.lote_financeiro where id = ${loteId}`;
}
