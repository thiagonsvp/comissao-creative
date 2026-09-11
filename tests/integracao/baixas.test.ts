import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

// app_writer não tem privilégio de DELETE: cada caso monta o cenário dentro da
// transação e desfaz com rollback.
const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('registrarBaixaCliente', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  function criarOs(tx: postgres.TransactionSql, valor = 1_000_000n) {
    return cadastrarOs(
      tx,
      {
        numeroOs: numeroOsTeste('BAIXA'),
        cliente: 'Cliente Baixa',
        produto: 'Produto Baixa',
        tipoPagamento: 'Pix',
        valor,
        percentualComissao: 700n,
        dataVenda: '2026-09-01',
        observacao: null,
        rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
      },
      usuario.id,
    );
  }

  it('registra um pagamento parcial e audita', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId } = await criarOs(tx);
        const { baixaId } = await registrarBaixaCliente(
          tx,
          { osId, data: '2026-09-05', valor: 500_000n, observacao: 'Parcial' },
          usuario.id,
        );

        const [linha] = await tx`
          select valor, tipo, observacao, criado_por
          from public.baixa_cliente where id = ${baixaId}
        `;
        expect(linha.valor).toBe('5000.00');
        expect(linha.tipo).toBe('recebimento');
        expect(linha.observacao).toBe('Parcial');
        expect(linha.criado_por).toBe(usuario.id);

        const [auditoria] = await tx`
          select acao from interno.auditoria_evento
          where entidade = 'baixa_cliente' and entidade_id = ${baixaId}
        `;
        expect(auditoria.acao).toBe('registrar');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('rejeita pagamento que ultrapassa o valor da OS', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId } = await criarOs(tx, 100_000n);
        await registrarBaixaCliente(
          tx,
          { osId, data: '2026-09-05', valor: 60_000n, observacao: null },
          usuario.id,
        );
        await expect(
          registrarBaixaCliente(
            tx,
            { osId, data: '2026-09-06', valor: 50_000n, observacao: null },
            usuario.id,
          ),
        ).rejects.toThrow(ErroValidacao);

        // Quitar o saldo exato continua valendo.
        await registrarBaixaCliente(
          tx,
          { osId, data: '2026-09-06', valor: 40_000n, observacao: null },
          usuario.id,
        );

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('rejeita valor não positivo, data futura e OS inexistente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId } = await criarOs(tx);

        await expect(
          registrarBaixaCliente(
            tx,
            { osId, data: '2026-09-05', valor: 0n, observacao: null },
            usuario.id,
          ),
        ).rejects.toThrow(ErroValidacao);

        await expect(
          registrarBaixaCliente(
            tx,
            { osId, data: '2999-01-01', valor: 1_000n, observacao: null },
            usuario.id,
          ),
        ).rejects.toThrow(ErroValidacao);

        await expect(
          registrarBaixaCliente(
            tx,
            {
              osId: '11111111-1111-1111-1111-111111111111',
              data: '2026-09-05',
              valor: 1_000n,
              observacao: null,
            },
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
