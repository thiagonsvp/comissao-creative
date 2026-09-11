import type postgres from 'postgres';
import { dataNaoFutura } from '@/dominio/datas';
import { paraDecimalDb, parseDecimal, type Centavos } from '@/dominio/dinheiro';
import { ErroValidacao } from '@/dominio/erros';
import { registrarAuditoria } from '@/servidor/auditoria';

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
