import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

// app_writer não tem privilégio de DELETE: cada caso monta o cenário dentro da
// transação e desfaz com rollback. Como tudo roda na mesma transação, um
// segundo gerarLote já enxerga as reservas do primeiro.
const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('gerarLote', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  async function osComPagamento(
    tx: postgres.TransactionSql,
    fracaoPaga: number,
  ): Promise<string> {
    const { osId } = await cadastrarOs(
      tx,
      {
        numeroOs: numeroOsTeste('LOTE'),
        cliente: 'Cliente Lote',
        produto: 'Produto Lote',
        tipoPagamento: 'Pix',
        valor: 1_000_000n,
        percentualComissao: 700n,
        dataVenda: '2026-09-01',
        observacao: null,
        rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
      },
      usuario.id,
    );
    if (fracaoPaga > 0) {
      await registrarBaixaCliente(
        tx,
        {
          osId,
          data: '2026-09-05',
          valor: BigInt(Math.round(1_000_000 * fracaoPaga)),
          observacao: null,
        },
        usuario.id,
      );
    }
    return osId;
  }

  it('gera lote do trecho liberado com snapshots e rateio 250/50/50', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComPagamento(tx, 0.5);
        const resultado = await gerarLote(
          tx,
          { osIds: [osId], observacao: 'Primeiro envio' },
          usuario.id,
        );
        expect(resultado.valorTotal).toBe(35_000n);
        expect(resultado.numero).toBeGreaterThan(0);

        const [lote] = await tx`
          select estado_conferencia, data_envio, valor_total_original, enviado_por
          from public.lote_financeiro where id = ${resultado.loteId}
        `;
        expect(lote.estado_conferencia).toBe('enviado');
        expect(lote.data_envio).not.toBeNull();
        expect(lote.valor_total_original).toBe('350.00');
        expect(lote.enviado_por).toBe(usuario.id);

        const itens = await tx`
          select * from public.lote_item where lote_id = ${resultado.loteId} order by ordem
        `;
        expect(itens).toHaveLength(1);
        const [item] = itens;
        expect(item.valor_comissao).toBe('350.00');
        expect(item.inicio_centavo).toBe('0');
        expect(item.fim_centavo).toBe('35000');
        expect(item.total_pago_cliente_snapshot).toBe('5000.00');
        expect(item.comissao_liberada_snapshot).toBe('350.00');
        expect(item.comissao_comprometida_anterior_snapshot).toBe('0.00');
        expect(item.versao_calculo).toBe('comissao_v2/divisores_v1');

        const [rateio] = await tx`
          select * from interno.lote_item_rateio where lote_item_id = ${item.id}
        `;
        expect(rateio.valor_thiago).toBe('250.00');
        expect(rateio.valor_geice).toBe('50.00');
        expect(rateio.valor_gabrielle).toBe('50.00');
        expect(rateio.rateio_thiago).toBe('5.00');

        const [os] = await tx`select primeiro_envio_em from public.os where id = ${osId}`;
        expect(os.primeiro_envio_em).not.toBeNull();

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('um segundo envio da mesma OS só reserva o trecho novo', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComPagamento(tx, 0.5);
        await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);

        await registrarBaixaCliente(
          tx,
          { osId, data: '2026-09-10', valor: 500_000n, observacao: null },
          usuario.id,
        );
        const segundo = await gerarLote(
          tx,
          { osIds: [osId], observacao: null },
          usuario.id,
        );
        expect(segundo.valorTotal).toBe(35_000n);

        const [item] = await tx`
          select inicio_centavo, fim_centavo, comissao_comprometida_anterior_snapshot
          from public.lote_item where lote_id = ${segundo.loteId}
        `;
        expect(item.inicio_centavo).toBe('35000');
        expect(item.fim_centavo).toBe('70000');
        expect(item.comissao_comprometida_anterior_snapshot).toBe('350.00');

        // Um terceiro envio não tem mais nada a reservar.
        await expect(
          gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id),
        ).rejects.toThrow(ErroValidacao);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('rejeita OS sem comissão disponível, lista vazia e OS inexistente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComPagamento(tx, 0);

        await expect(
          gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id),
        ).rejects.toThrow(ErroValidacao);

        await expect(
          gerarLote(tx, { osIds: [], observacao: null }, usuario.id),
        ).rejects.toThrow(ErroValidacao);

        await expect(
          gerarLote(
            tx,
            { osIds: ['11111111-1111-1111-1111-111111111111'], observacao: null },
            usuario.id,
          ),
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
