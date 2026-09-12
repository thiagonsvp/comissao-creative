import type postgres from 'postgres';
import { dataNaoFutura } from '@/dominio/datas';
import { paraDecimalDb, parseDecimal, type Centavos } from '@/dominio/dinheiro';
import { ErroValidacao } from '@/dominio/erros';
import { comissaoLiberada, comissaoTotal } from '@/dominio/comissao';
import { motivoDeRecusaPorComissao } from '@/dominio/travas';
import { registrarAuditoria } from '@/servidor/auditoria';
import { situacaoDaOs } from '@/servidor/os/travas';

export interface DadosBaixaCliente {
  osId: string;
  data: string;
  valor: Centavos;
  observacao: string | null;
}

export async function registrarBaixaCliente(
  tx: postgres.TransactionSql,
  dados: DadosBaixaCliente,
  usuarioId: string,
): Promise<{ baixaId: string }> {
  if (dados.valor <= 0n) {
    throw new ErroValidacao('O valor deve ser maior que zero', 'valor');
  }
  const dataEfetiva = dataNaoFutura(dados.data, 'data');

  // A transação já roda sob o bloqueio global de controle_financeiro; o
  // `for update` aqui documenta a intenção e protege a soma abaixo mesmo se
  // esse bloqueio for relaxado no futuro.
  const [os] = await tx`
    select valor from public.os where id = ${dados.osId} for update
  `;
  if (!os) throw new ErroValidacao('OS não encontrada', 'osId');
  const valorOs = parseDecimal(os.valor);

  const [{ total }] = await tx`
    select coalesce(sum(case when tipo = 'estorno' then -valor else valor end), 0) as total
    from public.baixa_cliente
    where os_id = ${dados.osId}
  `;
  const totalPago = parseDecimal(total);

  if (totalPago + dados.valor > valorOs) {
    throw new ErroValidacao('O pagamento ultrapassa o valor da OS', 'valor');
  }

  const [linha] = await tx`
    insert into public.baixa_cliente
      (os_id, data_efetiva, valor, observacao, criado_por)
    values (
      ${dados.osId}, ${dataEfetiva}, ${paraDecimalDb(dados.valor)},
      ${dados.observacao}, ${usuarioId}
    )
    returning id
  `;

  await registrarAuditoria(tx, {
    entidade: 'baixa_cliente',
    entidadeId: linha.id,
    acao: 'registrar',
    responsavelId: usuarioId,
    dataEfetiva,
    valoresNovos: { osId: dados.osId, valor: dados.valor, observacao: dados.observacao },
  });

  return { baixaId: linha.id };
}

export interface DadosEstorno {
  baixaId: string;
  valor: Centavos;
  data: string;
  motivo: string;
}

/**
 * Recebimento não se edita nem se apaga — o banco só aceita insert nesta
 * tabela. Corrigir é estornar e lançar de novo, o que deixa na história que
 * houve um erro e quando ele foi percebido.
 */
export async function estornarBaixaCliente(
  tx: postgres.TransactionSql,
  dados: DadosEstorno,
  usuarioId: string,
): Promise<{ estornoId: string }> {
  if (dados.valor <= 0n) {
    throw new ErroValidacao('O valor do estorno deve ser maior que zero', 'valor');
  }
  const motivo = dados.motivo.trim();
  if (motivo === '') {
    throw new ErroValidacao('O motivo do estorno é obrigatório', 'motivo');
  }
  const dataEfetiva = dataNaoFutura(dados.data, 'data');

  // Sem "for update": app_writer só tem select/insert em baixa_cliente (a
  // tabela não aceita update físico). A serialização já vem do bloqueio
  // global de controle_financeiro que comTransacaoFinanceira adquire.
  const [original] = await tx`
    select id, os_id, tipo, valor from public.baixa_cliente
    where id = ${dados.baixaId}
  `;
  if (!original) throw new ErroValidacao('Pagamento não encontrado', 'baixaId');
  if (original.tipo !== 'recebimento') {
    throw new ErroValidacao('Só é possível estornar um recebimento', 'baixaId');
  }

  const [{ estornado }] = await tx`
    select coalesce(sum(valor), 0) as estornado
    from public.baixa_cliente
    where baixa_origem_id = ${dados.baixaId} and tipo = 'estorno'
  `;
  const jaEstornado = parseDecimal(estornado);
  if (jaEstornado + dados.valor > parseDecimal(original.valor)) {
    throw new ErroValidacao(
      'O estorno ultrapassa o valor do recebimento original',
      'valor',
    );
  }

  const situacao = await situacaoDaOs(original.os_id, tx);
  if (!situacao) throw new ErroValidacao('OS não encontrada', 'baixaId');

  const liberadaNova = comissaoLiberada(
    comissaoTotal(situacao.valorOs, situacao.percentualComissao),
    situacao.totalPago - dados.valor,
    situacao.valorOs,
  );
  const recusa = motivoDeRecusaPorComissao(
    liberadaNova,
    situacao.comprometido,
    situacao.lotes,
  );
  if (recusa) throw new ErroValidacao(recusa, 'valor');

  const [linha] = await tx`
    insert into public.baixa_cliente
      (os_id, tipo, baixa_origem_id, data_efetiva, valor, observacao, criado_por)
    values (
      ${original.os_id}, 'estorno', ${dados.baixaId}, ${dataEfetiva},
      ${paraDecimalDb(dados.valor)}, ${motivo}, ${usuarioId}
    )
    returning id
  `;

  await registrarAuditoria(tx, {
    entidade: 'baixa_cliente',
    entidadeId: linha.id,
    acao: 'estornar',
    responsavelId: usuarioId,
    dataEfetiva,
    motivo,
    valoresAnteriores: {
      baixaOrigemId: dados.baixaId,
      valorOriginal: parseDecimal(original.valor),
      jaEstornado,
    },
    valoresNovos: { osId: original.os_id, valor: dados.valor },
  });

  return { estornoId: linha.id };
}
