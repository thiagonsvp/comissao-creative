import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import {
  paraDecimalDb,
  paraPercentualDb,
  type Centavos,
  type Percentual,
} from '@/dominio/dinheiro';
import { normalizarNumeroOs } from '@/dominio/os';
import { validarPesos, type PorPessoa } from '@/dominio/rateio';
import { registrarAuditoria } from '@/servidor/auditoria';

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

export async function cadastrarOs(
  tx: postgres.TransactionSql,
  dados: DadosOs,
  usuarioId: string,
): Promise<{ osId: string }> {
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
