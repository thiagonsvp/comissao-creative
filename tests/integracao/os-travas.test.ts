import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { situacaoDaOs } from '@/servidor/os/travas';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('situacaoDaOs', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  async function osComMetadePaga(tx: postgres.TransactionSql): Promise<string> {
    const { osId } = await cadastrarOs(
      tx,
      {
        numeroOs: numeroOsTeste('TRAVA'),
        cliente: 'Cliente Trava',
        produto: 'Produto Trava',
        tipoPagamento: 'Pix',
        valor: 1_000_000n,
        percentualComissao: 700n,
        dataVenda: '2026-09-01',
        observacao: null,
        rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
      },
      usuario.id,
    );
    await registrarBaixaCliente(
      tx,
      { osId, data: '2026-09-05', valor: 500_000n, observacao: null },
      usuario.id,
    );
    return osId;
  }

  it('sem lote, nada comprometido', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);
        const situacao = await situacaoDaOs(osId, tx);
        expect(situacao).toMatchObject({
          comprometido: 0n,
          totalPago: 500_000n,
          valorOs: 1_000_000n,
          percentualComissao: 700n,
        });
        expect(situacao?.lotes).toEqual([]);
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('com lote enviado, traz o comprometido e o lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);
        const { numero } = await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);

        const situacao = await situacaoDaOs(osId, tx);
        expect(situacao?.comprometido).toBe(35_000n);
        expect(situacao?.lotes).toHaveLength(1);
        expect(situacao?.lotes[0]).toMatchObject({
          numero,
          estadoConferencia: 'enviado',
          valorReservado: 35_000n,
        });
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('OS inexistente devolve null', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        expect(await situacaoDaOs('11111111-1111-1111-1111-111111111111', tx)).toBeNull();
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
