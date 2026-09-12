import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import {
  paraDecimalDb,
  paraPercentualDb,
  parseDecimal,
  parsePercentual,
  type Centavos,
  type Percentual,
} from '@/dominio/dinheiro';
import { comissaoLiberada, comissaoTotal } from '@/dominio/comissao';
import { motivoDeRecusaPorComissao, motivoDeRecusaPorLoteAtivo } from '@/dominio/travas';
import { normalizarNumeroOs } from '@/dominio/os';
import { validarPesos, type PorPessoa } from '@/dominio/rateio';
import { registrarAuditoria } from '@/servidor/auditoria';
import { situacaoDaOs } from './travas';

export interface DadosOs {
  numeroOs: string;
  cliente: string;
  produto: string;
  tipoPagamento: string;
  valor: Centavos;
  percentualComissao: Percentual;
  dataVenda: string;
  observacao: string | null;
  rateio: PorPessoa;
}

function ehErroUnicidade(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code: string }).code === '23505'
  );
}

/** Regras de campo iguais no cadastro e na edição. */
function validarCamposOs(dados: DadosOs): void {
  if (dados.cliente.trim() === '') {
    throw new ErroValidacao('Cliente é obrigatório', 'cliente');
  }
  if (dados.produto.trim() === '') {
    throw new ErroValidacao('Produto é obrigatório', 'produto');
  }
  if (dados.tipoPagamento.trim() === '') {
    throw new ErroValidacao('Tipo de pagamento é obrigatório', 'tipoPagamento');
  }
  if (dados.valor <= 0n) {
    throw new ErroValidacao('Valor deve ser maior que zero', 'valor');
  }
  validarPesos(dados.rateio, dados.percentualComissao);
}

export async function cadastrarOs(
  tx: postgres.TransactionSql,
  dados: DadosOs,
  usuarioId: string,
): Promise<{ osId: string }> {
  validarCamposOs(dados);
  const numeroNormalizado = normalizarNumeroOs(dados.numeroOs);

  let osId: string;
  try {
    const [linha] = await tx`
      insert into public.os
        (numero_os, numero_os_normalizado, cliente, produto, tipo_pagamento, valor,
         percentual_comissao, data_venda, observacao, criado_por, atualizado_por)
      values
        (${dados.numeroOs.trim()}, ${numeroNormalizado}, ${dados.cliente.trim()},
         ${dados.produto.trim()}, ${dados.tipoPagamento.trim()}, ${paraDecimalDb(dados.valor)},
         ${paraPercentualDb(dados.percentualComissao)}, ${dados.dataVenda},
         ${dados.observacao}, ${usuarioId}, ${usuarioId})
      returning id
    `;
    osId = linha.id;
  } catch (erro) {
    if (ehErroUnicidade(erro)) {
      throw new ErroValidacao('Já existe uma OS com este número', 'numeroOs');
    }
    throw erro;
  }

  await tx`
    insert into interno.os_rateio
      (os_id, rateio_thiago, rateio_geice, rateio_gabrielle)
    values (
      ${osId}, ${paraPercentualDb(dados.rateio.thiago)},
      ${paraPercentualDb(dados.rateio.geice)},
      ${paraPercentualDb(dados.rateio.gabrielle)}
    )
  `;
  await registrarAuditoria(tx, {
    entidade: 'os',
    entidadeId: osId,
    acao: 'cadastrar',
    responsavelId: usuarioId,
    dataEfetiva: dados.dataVenda,
    valoresNovos: dados,
  });
  return { osId };
}

export type DadosEdicaoOs = DadosOs;

export async function editarOs(
  tx: postgres.TransactionSql,
  osId: string,
  dados: DadosEdicaoOs,
  usuarioId: string,
): Promise<void> {
  validarCamposOs(dados);
  const numeroNormalizado = normalizarNumeroOs(dados.numeroOs);

  const [atual] = await tx`
    select numero_os, cliente, produto, tipo_pagamento, valor, percentual_comissao,
      to_char(data_venda, 'YYYY-MM-DD') as data_venda, observacao
    from public.os where id = ${osId} for update
  `;
  if (!atual) throw new ErroValidacao('OS não encontrada', 'osId');

  const [rateioAtual] = await tx`
    select rateio_thiago, rateio_geice, rateio_gabrielle
    from interno.os_rateio where os_id = ${osId}
  `;

  const situacao = await situacaoDaOs(osId, tx);
  if (!situacao) throw new ErroValidacao('OS não encontrada', 'osId');

  const valorMudou = parseDecimal(atual.valor) !== dados.valor;
  const percentualMudou = parsePercentual(atual.percentual_comissao) !== dados.percentualComissao;

  if (valorMudou || percentualMudou) {
    const liberadaNova = comissaoLiberada(
      comissaoTotal(dados.valor, dados.percentualComissao),
      situacao.totalPago,
      dados.valor,
    );
    const pisoComissao =
      situacao.tetoReservado > situacao.comprometido
        ? situacao.tetoReservado
        : situacao.comprometido;
    const motivo = motivoDeRecusaPorComissao(
      liberadaNova,
      pisoComissao,
      situacao.lotes,
    );
    if (motivo) throw new ErroValidacao(motivo, 'valor');
  }

  const rateioMudou =
    parsePercentual(rateioAtual.rateio_thiago) !== dados.rateio.thiago ||
    parsePercentual(rateioAtual.rateio_geice) !== dados.rateio.geice ||
    parsePercentual(rateioAtual.rateio_gabrielle) !== dados.rateio.gabrielle;

  if (rateioMudou) {
    const motivo = motivoDeRecusaPorLoteAtivo(situacao.lotes);
    if (motivo) throw new ErroValidacao(motivo, 'rateio_thiago');
  }

  try {
    await tx`
      update public.os
      set numero_os = ${dados.numeroOs.trim()},
          numero_os_normalizado = ${numeroNormalizado},
          cliente = ${dados.cliente.trim()},
          produto = ${dados.produto.trim()},
          tipo_pagamento = ${dados.tipoPagamento.trim()},
          valor = ${paraDecimalDb(dados.valor)},
          percentual_comissao = ${paraPercentualDb(dados.percentualComissao)},
          data_venda = ${dados.dataVenda},
          observacao = ${dados.observacao},
          versao = versao + 1,
          atualizado_por = ${usuarioId}
      where id = ${osId}
    `;
  } catch (erro) {
    if (ehErroUnicidade(erro)) {
      throw new ErroValidacao('Já existe uma OS com este número', 'numeroOs');
    }
    throw erro;
  }

  await tx`
    update interno.os_rateio
    set rateio_thiago = ${paraPercentualDb(dados.rateio.thiago)},
        rateio_geice = ${paraPercentualDb(dados.rateio.geice)},
        rateio_gabrielle = ${paraPercentualDb(dados.rateio.gabrielle)}
    where os_id = ${osId}
  `;

  await registrarAuditoria(tx, {
    entidade: 'os',
    entidadeId: osId,
    acao: 'editar',
    responsavelId: usuarioId,
    dataEfetiva: dados.dataVenda,
    valoresAnteriores: {
      numeroOs: atual.numero_os,
      cliente: atual.cliente,
      produto: atual.produto,
      tipoPagamento: atual.tipo_pagamento,
      valor: parseDecimal(atual.valor),
      percentualComissao: parsePercentual(atual.percentual_comissao),
      dataVenda: atual.data_venda,
      observacao: atual.observacao,
      rateio: {
        thiago: parsePercentual(rateioAtual.rateio_thiago),
        geice: parsePercentual(rateioAtual.rateio_geice),
        gabrielle: parsePercentual(rateioAtual.rateio_gabrielle),
      },
    },
    valoresNovos: dados,
  });
}
