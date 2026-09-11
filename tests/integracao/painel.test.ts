import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { componentesPorOs, resumoLotes } from '@/servidor/painel/consultas';
import { ratearDisponivel, resumirComissoes } from '@/dominio/painel';
import { criarUsuarioTeste, espiaoSql, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('consultas do painel', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  async function osComMetadePaga(tx: postgres.TransactionSql) {
    const { osId } = await cadastrarOs(
      tx,
      {
        numeroOs: numeroOsTeste('PAINEL'),
        cliente: 'Cliente Painel',
        produto: 'Produto Painel',
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

  it('traz componentes crus e o rateio só quando pedido', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);

        const comRateio = await componentesPorOs(true, tx);
        const linha = comRateio.find((l) => l.osId === osId);
        expect(linha).toMatchObject({
          valorOs: 1_000_000n,
          percentualComissao: 700n,
          totalPagoCliente: 500_000n,
          comprometido: 0n,
          mesVenda: '2026-09',
          pesos: { thiago: 500n, geice: 100n, gabrielle: 100n },
        });

        // O resumo puro derivado dessas linhas bate com o esperado da OS.
        expect(resumirComissoes([linha!]).disponivel).toBe(35_000n);
        expect(ratearDisponivel([linha!])).toEqual({
          thiago: 25_000n,
          geice: 5_000n,
          gabrielle: 5_000n,
        });

        const semRateio = await componentesPorOs(false, tx);
        expect(semRateio.find((l) => l.osId === osId)?.pesos).toBeNull();
        expect(semRateio.every((l) => l.pesos === null)).toBe(true);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('sem rateio, nenhum SQL emitido menciona as tabelas ou colunas de rateio', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        await osComMetadePaga(tx);
        const { exec, consultas } = espiaoSql(tx);

        await componentesPorOs(false, exec);

        expect(consultas.length).toBeGreaterThan(0);
        const sqlEmitido = consultas.join('\n');
        expect(sqlEmitido).not.toMatch(
          /os_rateio|lote_item_rateio|rateio_thiago|rateio_geice|rateio_gabrielle/i,
        );

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('reflete o comprometido depois que a OS entra num lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);
        await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);

        const linha = (await componentesPorOs(true, tx)).find((l) => l.osId === osId);
        expect(linha?.comprometido).toBe(35_000n);
        expect(resumirComissoes([linha!]).disponivel).toBe(0n);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('resume lotes por estado e mede a idade do que está enviado', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);
        const { loteId, numero } = await gerarLote(
          tx,
          { osIds: [osId], observacao: null },
          usuario.id,
        );

        const resumo = await resumoLotes(tx);
        expect(resumo.aguardandoConferencia.quantidade).toBeGreaterThanOrEqual(1);
        expect(resumo.aguardandoConferencia.total).toBeGreaterThanOrEqual(35_000n);

        const pendente = resumo.pendentes.find((l) => l.id === loteId);
        expect(pendente).toMatchObject({ numero, valorTotal: 35_000n, dias: 0 });

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
