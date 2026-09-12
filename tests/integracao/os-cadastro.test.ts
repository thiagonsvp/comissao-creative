import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs, excluirOs, type DadosOs } from '@/servidor/os/servico';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

function dados(sobrescrever: Partial<DadosOs> = {}): DadosOs {
  return {
    numeroOs: numeroOsTeste('CAD'),
    cliente: 'Cliente Teste',
    produto: 'Produto Teste',
    tipoPagamento: 'Boleto',
    valor: 1_000_000n,
    percentualComissao: 700n,
    dataVenda: '2026-09-01',
    observacao: null,
    rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
    ...sobrescrever,
  };
}

describe('cadastrarOs', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  it('cadastra OS, rateio e auditoria atomicamente', async () => {
    const dadosOs = dados();
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId } = await cadastrarOs(tx, dadosOs, usuario.id);
        const [ordem] = await tx`select * from public.os where id = ${osId}`;
        const [rateio] = await tx`select * from interno.os_rateio where os_id = ${osId}`;
        const [auditoria] = await tx`
          select id from interno.auditoria_evento
          where entidade = 'os' and entidade_id = ${osId}
        `;
        expect(ordem.numero_os_normalizado).toBe(dadosOs.numeroOs.toUpperCase());
        expect(ordem.valor).toBe('10000.00');
        expect(rateio.rateio_geice).toBe('1.00');
        expect(auditoria).toBeTruthy();
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('rejeita número duplicado mesmo com espaços e caixa diferentes', async () => {
    const numero = numeroOsTeste('DUP');
    await expect(
      comTransacaoFinanceira(async (tx) => {
        await cadastrarOs(tx, dados({ numeroOs: numero }), usuario.id);
        await cadastrarOs(tx, dados({ numeroOs: `  ${numero.toLowerCase()} ` }), usuario.id);
      }),
    ).rejects.toThrow(ErroValidacao);
  });

  it('rejeita valor não positivo e rateio com soma incorreta', async () => {
    await expect(
      comTransacaoFinanceira((tx) =>
        cadastrarOs(tx, dados({ valor: 0n }), usuario.id),
      ),
    ).rejects.toThrow(ErroValidacao);
    await expect(
      comTransacaoFinanceira((tx) =>
        cadastrarOs(
          tx,
          dados({ rateio: { thiago: 500n, geice: 100n, gabrielle: 50n } }),
          usuario.id,
        ),
      ),
    ).rejects.toThrow(ErroValidacao);
  });

  it('exclui uma OS sem movimentos e preserva a auditoria', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId } = await cadastrarOs(tx, dados(), usuario.id);
        await excluirOs(tx, osId, usuario.id);

        expect(await tx`select id from public.os where id = ${osId}`).toHaveLength(0);
        expect(await tx`select os_id from interno.os_rateio where os_id = ${osId}`).toHaveLength(0);
        const [auditoria] = await tx`
          select acao from interno.auditoria_evento
          where entidade = 'os' and entidade_id = ${osId} and acao = 'excluir'
        `;
        expect(auditoria.acao).toBe('excluir');
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('não exclui OS que possui pagamento', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId } = await cadastrarOs(tx, dados(), usuario.id);
        await tx`
          insert into public.baixa_cliente (os_id, data_efetiva, valor, criado_por)
          values (${osId}, '2026-09-05', '100.00', ${usuario.id})
        `;
        await expect(excluirOs(tx, osId, usuario.id)).rejects.toThrow(/pagamentos/i);
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
