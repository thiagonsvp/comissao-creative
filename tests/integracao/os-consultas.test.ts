import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { listarOs, obterOsPorId } from '@/servidor/os/consultas';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

// app_writer não tem privilégio de DELETE (ver 20260910000200_privilegios.sql),
// então o teste monta o cenário dentro da transação e desfaz tudo com rollback.
const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('consultas de OS', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  it('lista e detalha uma OS com pagamento parcial', async () => {
    const numero = numeroOsTeste('CONS');

    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId } = await cadastrarOs(
          tx,
          {
            numeroOs: numero,
            cliente: 'Cliente Consulta',
            produto: 'Produto Consulta',
            tipoPagamento: 'Pix',
            valor: 1_000_000n,
            percentualComissao: 700n,
            dataVenda: '2026-09-01',
            observacao: null,
            rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
          },
          usuario.id,
        );
        await tx`
          insert into public.baixa_cliente (os_id, data_efetiva, valor, criado_por)
          values (${osId}, '2026-09-05', '5000.00', ${usuario.id})
        `;

        const lista = await listarOs({ busca: numero }, tx);
        expect(lista).toHaveLength(1);
        expect(lista[0]).toMatchObject({
          numeroOs: numero,
          cliente: 'Cliente Consulta',
          valor: 1_000_000n,
          status: 'parcial',
          comissaoLiberada: 35_000n,
          comissaoDisponivel: 35_000n,
        });

        const semRateio = await obterOsPorId(osId, false, tx);
        expect(semRateio?.rateio).toBeNull();
        expect(semRateio?.dataVenda).toBe('2026-09-01');
        expect(semRateio?.tipoPagamento).toBe('Pix');
        expect(semRateio?.percentualComissao).toBe(700n);
        expect(semRateio?.comissaoTotal).toBe(70_000n);
        expect(semRateio?.totalPagoCliente).toBe(500_000n);
        expect(semRateio?.primeiroEnvioEm).toBeNull();
        expect(semRateio?.baixas).toHaveLength(1);
        expect(semRateio?.baixas[0]).toMatchObject({ data: '2026-09-05', valor: 500_000n });

        const comRateio = await obterOsPorId(osId, true, tx);
        expect(comRateio?.rateio).toEqual({ thiago: 500n, geice: 100n, gabrielle: 100n });

        expect(await obterOsPorId(randomUUID(), false, tx)).toBeNull();

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('lista sem filtro inclui a OS e a busca ignora caixa', async () => {
    const numero = numeroOsTeste('BUSCA');

    await expect(
      comTransacaoFinanceira(async (tx) => {
        await cadastrarOs(
          tx,
          {
            numeroOs: numero,
            cliente: 'Cliente Busca',
            produto: 'Produto Busca',
            tipoPagamento: 'Boleto',
            valor: 100_000n,
            percentualComissao: 700n,
            dataVenda: '2026-09-02',
            observacao: null,
            rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
          },
          usuario.id,
        );

        const porNumeroMinusculo = await listarOs({ busca: numero.toLowerCase() }, tx);
        expect(porNumeroMinusculo).toHaveLength(1);

        const porCliente = await listarOs({ busca: 'cliente busca' }, tx);
        expect(porCliente.map((o) => o.numeroOs)).toContain(numero);

        const semFiltro = await listarOs({}, tx);
        expect(semFiltro.map((o) => o.numeroOs)).toContain(numero);

        const semPagamento = porNumeroMinusculo[0];
        expect(semPagamento.status).toBe('aberta');
        expect(semPagamento.comissaoLiberada).toBe(0n);
        expect(semPagamento.comissaoDisponivel).toBe(0n);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
