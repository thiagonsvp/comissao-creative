import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { editarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import {
  aprovarLote,
  cancelarLote,
  desfazerAprovacaoLote,
  gerarLote,
} from '@/servidor/lotes/servico';
import { obterOsPorId } from '@/servidor/os/consultas';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('ciclo de vida do lote', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  function dadosOs() {
    return {
      numeroOs: numeroOsTeste('CICLO'),
      cliente: 'Cliente Ciclo',
      produto: 'Produto Ciclo',
      tipoPagamento: 'Pix',
      valor: 1_000_000n,
      percentualComissao: 700n,
      dataVenda: '2026-09-01',
      observacao: null,
      rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
    };
  }

  async function osComLote(tx: postgres.TransactionSql) {
    const dados = dadosOs();
    const { osId } = await cadastrarOs(tx, dados, usuario.id);
    await registrarBaixaCliente(
      tx,
      { osId, data: '2026-09-05', valor: 500_000n, observacao: null },
      usuario.id,
    );
    const lote = await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);
    return { osId, dados, lote };
  }

  it('cancelar devolve a comissão para disponível sem apagar o lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, lote } = await osComLote(tx);

        const antes = await obterOsPorId(osId, false, tx);
        expect(antes?.comissaoDisponivel).toBe(0n);

        await cancelarLote(tx, lote.loteId, 'Faltou uma OS', usuario.id);

        const depois = await obterOsPorId(osId, false, tx);
        expect(depois?.comissaoDisponivel).toBe(35_000n);

        const [linha] = await tx`
          select estado_conferencia, motivo_cancelamento from public.lote_financeiro
          where id = ${lote.loteId}
        `;
        expect(linha.estado_conferencia).toBe('cancelado');
        expect(linha.motivo_cancelamento).toBe('Faltou uma OS');

        const itens = await tx`
          select count(*)::int as total from public.lote_item where lote_id = ${lote.loteId}
        `;
        expect(itens[0].total).toBe(1);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('cancelar exige motivo e só vale a partir de enviado', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { lote } = await osComLote(tx);

        await expect(
          cancelarLote(tx, lote.loteId, '   ', usuario.id),
        ).rejects.toThrow(/motivo/i);

        await aprovarLote(tx, lote.loteId, usuario.id);
        await expect(
          cancelarLote(tx, lote.loteId, 'Depois de aprovado', usuario.id),
        ).rejects.toThrow(ErroValidacao);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('desfazer aprovação volta para enviado e limpa quem aprovou', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { lote } = await osComLote(tx);
        await aprovarLote(tx, lote.loteId, usuario.id);

        await desfazerAprovacaoLote(tx, lote.loteId, 'Cliquei sem querer', usuario.id);

        const [linha] = await tx`
          select estado_conferencia, aprovado_em, aprovado_por
          from public.lote_financeiro where id = ${lote.loteId}
        `;
        expect(linha.estado_conferencia).toBe('enviado');
        expect(linha.aprovado_em).toBeNull();
        expect(linha.aprovado_por).toBeNull();

        await expect(
          desfazerAprovacaoLote(tx, lote.loteId, 'De novo', usuario.id),
        ).rejects.toThrow(ErroValidacao);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('ciclo completo: cancelar, corrigir a OS e gerar o substituto vinculado', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, dados, lote } = await osComLote(tx);

        await cancelarLote(tx, lote.loteId, 'Valor errado', usuario.id);
        await editarOs(tx, osId, { ...dados, valor: 600_000n }, usuario.id);

        const substituto = await gerarLote(
          tx,
          { osIds: [osId], observacao: null, loteOrigemId: lote.loteId },
          usuario.id,
        );

        // 7% de R$ 6.000 = R$ 420,00; metade paga (R$ 500 de R$ 600) libera
        // R$ 350,00 — o cliente já pagou mais de 80% do valor corrigido.
        const detalhe = await obterOsPorId(osId, false, tx);
        expect(detalhe?.comissaoTotal).toBe(42_000n);
        expect(substituto.valorTotal).toBe(detalhe!.comissaoLiberada);

        const [novo] = await tx`
          select lote_origem_id from public.lote_financeiro where id = ${substituto.loteId}
        `;
        expect(novo.lote_origem_id).toBe(lote.loteId);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
