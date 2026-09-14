import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { aprovarLote, editarDatasLote, excluirLote, gerarLote } from '@/servidor/lotes/servico';
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

  it('calcula o pago referente a cada lote pela diferenca com o lote anterior da mesma OS', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId } = await cadastrarOs(
          tx,
          {
            numeroOs: numeroOsTeste('LOTEPAGO'),
            cliente: 'Cliente Pago',
            produto: 'Produto Pago',
            tipoPagamento: 'Pix',
            valor: 1_000_000n,
            percentualComissao: 700n,
            dataVenda: '2026-09-01',
            observacao: null,
            rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
          },
          usuario.id,
        );

        // Metade paga: primeiro lote desta OS. Sem lote anterior, o "pago
        // referente ao lote" é igual ao total pago (500_000n).
        await registrarBaixaCliente(
          tx,
          { osId, data: '2026-09-02', valor: 500_000n, observacao: null },
          usuario.id,
        );
        const primeiro = await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);

        const detalhePrimeiro = await obterLotePorId(primeiro.loteId, false, tx);
        expect(detalhePrimeiro?.itens[0]).toMatchObject({
          totalPagoClienteSnapshot: 500_000n,
          pagoReferenteAoLoteSnapshot: 500_000n,
          valorComissao: 35_000n,
        });

        // Resto pago: segundo lote da mesma OS. O total acumulado dobra
        // (1_000_000n), mas o "pago referente a este lote" é só a fatia
        // nova (500_000n), não o acumulado.
        await registrarBaixaCliente(
          tx,
          { osId, data: '2026-09-06', valor: 500_000n, observacao: null },
          usuario.id,
        );
        const segundo = await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);

        const detalheSegundo = await obterLotePorId(segundo.loteId, false, tx);
        expect(detalheSegundo?.itens[0]).toMatchObject({
          totalPagoClienteSnapshot: 1_000_000n,
          pagoReferenteAoLoteSnapshot: 500_000n,
          valorComissao: 35_000n,
        });

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

        await expect(
          aprovarLote(tx, loteId, usuario.id, '2099-01-01'),
        ).rejects.toThrow(/futura/i);

        await aprovarLote(tx, loteId, usuario.id, '2026-09-04');
        const [lote] = await tx`
          select estado_conferencia, aprovado_em, aprovado_por,
            to_char(aprovado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data_aprovacao
          from public.lote_financeiro where id = ${loteId}
        `;
        expect(lote.estado_conferencia).toBe('aprovado');
        expect(lote.aprovado_em).not.toBeNull();
        expect(lote.aprovado_por).toBe(usuario.id);
        expect(lote.data_aprovacao).toBe('2026-09-04');

        const [auditoria] = await tx`
          select acao, to_char(data_efetiva, 'YYYY-MM-DD') as data_efetiva
          from interno.auditoria_evento
          where entidade = 'lote_financeiro' and entidade_id = ${loteId} and acao = 'aprovar'
        `;
        expect(auditoria).toBeTruthy();
        expect(auditoria.data_efetiva).toBe('2026-09-04');

        await editarDatasLote(
          tx,
          loteId,
          { dataEnvio: '2026-08-30', dataAprovacao: '2026-09-01' },
          usuario.id,
        );
        const [datasEditadas] = await tx`
          select to_char(data_envio, 'YYYY-MM-DD') as data_envio,
            to_char(aprovado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data_aprovacao
          from public.lote_financeiro where id = ${loteId}
        `;
        expect(datasEditadas).toMatchObject({
          data_envio: '2026-08-30',
          data_aprovacao: '2026-09-01',
        });

        await expect(
          editarDatasLote(
            tx,
            loteId,
            { dataEnvio: '2099-01-01', dataAprovacao: '2026-09-01' },
            usuario.id,
          ),
        ).rejects.toThrow(/futura/i);
        await expect(excluirLote(tx, loteId, usuario.id)).rejects.toThrow(/aprovação/i);

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
