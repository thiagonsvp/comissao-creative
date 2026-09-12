import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { aprovarLote, gerarLote } from '@/servidor/lotes/servico';
import { listarLotes, obterLotePorId } from '@/servidor/lotes/consultas';
import { criarUsuarioTeste, espiaoSql, numeroOsTeste } from './ajuda';

// app_writer não tem privilégio de DELETE: cada caso monta o cenário dentro da
// transação e desfaz com rollback.
const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('consultas e conferência de lote', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  async function loteQuitado(tx: postgres.TransactionSql) {
    const { osId } = await cadastrarOs(
      tx,
      {
        numeroOs: numeroOsTeste('LOTECONS'),
        cliente: 'Cliente X',
        produto: 'Produto Y',
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
      { osId, data: '2026-09-05', valor: 1_000_000n, observacao: null },
      usuario.id,
    );
    return gerarLote(tx, { osIds: [osId], observacao: 'lote de teste' }, usuario.id);
  }

  it('lista o lote enviado e detalha com e sem rateio', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { loteId, numero } = await loteQuitado(tx);

        const lista = await listarLotes(tx);
        expect(lista.find((l) => l.id === loteId)).toMatchObject({
          numero,
          estadoConferencia: 'enviado',
          valorTotal: 70_000n,
        });
        expect(lista[0].dataEnvio).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        const semRateio = await obterLotePorId(loteId, false, tx);
        expect(semRateio?.observacao).toBe('lote de teste');
        expect(semRateio).toMatchObject({
          motivoCancelamento: null,
          loteOrigem: null,
          loteSubstituto: null,
        });
        expect(semRateio?.itens).toHaveLength(1);
        expect(semRateio?.itens[0]).toMatchObject({
          valorOsSnapshot: 1_000_000n,
          totalPagoClienteSnapshot: 1_000_000n,
          comissaoComprometidaAnteriorSnapshot: 0n,
        });
        expect(semRateio?.itens[0]).toMatchObject({
          ordem: 1,
          clienteSnapshot: 'Cliente X',
          produtoSnapshot: 'Produto Y',
          valorComissao: 70_000n,
          rateio: null,
        });

        const comRateio = await obterLotePorId(loteId, true, tx);
        expect(comRateio?.itens[0].rateio).toEqual({
          thiago: 50_000n,
          geice: 10_000n,
          gabrielle: 10_000n,
        });

        expect(await obterLotePorId('11111111-1111-1111-1111-111111111111', false, tx)).toBeNull();

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('sem rateio, nenhum SQL emitido menciona a tabela de rateio do item de lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { loteId } = await loteQuitado(tx);

        const { exec, consultas } = espiaoSql(tx);
        await obterLotePorId(loteId, false, exec);

        expect(consultas.length).toBeGreaterThan(0);
        const sqlEmitido = consultas.join('\n');
        expect(sqlEmitido).not.toMatch(/lote_item_rateio|rateio_thiago|rateio_geice|rateio_gabrielle/i);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('aprova um lote enviado e rejeita aprovar de novo', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { loteId } = await loteQuitado(tx);

        await aprovarLote(tx, loteId, usuario.id);
        const [lote] = await tx`
          select estado_conferencia, aprovado_em, aprovado_por
          from public.lote_financeiro where id = ${loteId}
        `;
        expect(lote.estado_conferencia).toBe('aprovado');
        expect(lote.aprovado_em).not.toBeNull();
        expect(lote.aprovado_por).toBe(usuario.id);

        const [auditoria] = await tx`
          select acao from interno.auditoria_evento
          where entidade = 'lote_financeiro' and entidade_id = ${loteId} and acao = 'aprovar'
        `;
        expect(auditoria).toBeTruthy();

        await expect(aprovarLote(tx, loteId, usuario.id)).rejects.toThrow(ErroValidacao);

        await expect(
          aprovarLote(tx, '11111111-1111-1111-1111-111111111111', usuario.id),
        ).rejects.toThrow(ErroValidacao);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
