import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { estornarBaixaCliente, registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { obterOsPorId } from '@/servidor/os/consultas';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('estornarBaixaCliente', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  async function cenario(tx: postgres.TransactionSql) {
    const { osId } = await cadastrarOs(
      tx,
      {
        numeroOs: numeroOsTeste('ESTORNO'),
        cliente: 'Cliente Estorno',
        produto: 'Produto Estorno',
        tipoPagamento: 'Pix',
        valor: 1_000_000n,
        percentualComissao: 700n,
        dataVenda: '2026-09-01',
        observacao: null,
        rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
      },
      usuario.id,
    );
    const { baixaId } = await registrarBaixaCliente(
      tx,
      { osId, data: '2026-09-05', valor: 500_000n, observacao: null },
      usuario.id,
    );
    return { osId, baixaId };
  }

  it('estorno integral zera o pago e a comissão liberada', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, baixaId } = await cenario(tx);

        const { estornoId } = await estornarBaixaCliente(
          tx,
          { baixaId, valor: 500_000n, data: '2026-09-10', motivo: 'Lancei na OS errada' },
          usuario.id,
        );

        const [linha] = await tx`
          select tipo, valor, baixa_origem_id, observacao
          from public.baixa_cliente where id = ${estornoId}
        `;
        expect(linha.tipo).toBe('estorno');
        expect(linha.valor).toBe('5000.00');
        expect(linha.baixa_origem_id).toBe(baixaId);
        expect(linha.observacao).toBe('Lancei na OS errada');

        const detalhe = await obterOsPorId(osId, false, tx);
        expect(detalhe?.totalPagoCliente).toBe(0n);
        expect(detalhe?.comissaoLiberada).toBe(0n);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('estorno parcial reduz proporcionalmente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, baixaId } = await cenario(tx);

        await estornarBaixaCliente(
          tx,
          { baixaId, valor: 200_000n, data: '2026-09-10', motivo: 'Cheque voltou' },
          usuario.id,
        );

        const detalhe = await obterOsPorId(osId, false, tx);
        expect(detalhe?.totalPagoCliente).toBe(300_000n);
        // 7% de R$ 10.000 = R$ 700,00; 30% pago libera R$ 210,00
        expect(detalhe?.comissaoLiberada).toBe(21_000n);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa estorno acumulado acima do recebimento original', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { baixaId } = await cenario(tx);

        await estornarBaixaCliente(
          tx,
          { baixaId, valor: 300_000n, data: '2026-09-10', motivo: 'Parcial' },
          usuario.id,
        );
        await expect(
          estornarBaixaCliente(
            tx,
            { baixaId, valor: 300_000n, data: '2026-09-10', motivo: 'Passa do total' },
            usuario.id,
          ),
        ).rejects.toThrow(/ultrapassa|já estornado/i);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa valor não positivo, data futura, motivo vazio e estorno de estorno', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { baixaId } = await cenario(tx);

        await expect(
          estornarBaixaCliente(tx, { baixaId, valor: 0n, data: '2026-09-10', motivo: 'x' }, usuario.id),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          estornarBaixaCliente(tx, { baixaId, valor: 1_000n, data: '2999-01-01', motivo: 'x' }, usuario.id),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          estornarBaixaCliente(tx, { baixaId, valor: 1_000n, data: '2026-09-10', motivo: '   ' }, usuario.id),
        ).rejects.toThrow(/motivo/i);

        const { estornoId } = await estornarBaixaCliente(
          tx,
          { baixaId, valor: 1_000n, data: '2026-09-10', motivo: 'Primeiro' },
          usuario.id,
        );
        await expect(
          estornarBaixaCliente(
            tx,
            { baixaId: estornoId, valor: 500n, data: '2026-09-10', motivo: 'De estorno' },
            usuario.id,
          ),
        ).rejects.toThrow(/recebimento/i);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa estorno que derrubaria a comissão abaixo do lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, baixaId } = await cenario(tx);
        await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);

        await expect(
          estornarBaixaCliente(
            tx,
            { baixaId, valor: 100_000n, data: '2026-09-10', motivo: 'Tentativa' },
            usuario.id,
          ),
        ).rejects.toThrow(/Cancele esse lote/);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
