import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs, editarOs, type DadosOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('editarOs', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  function dados(sobrescrever: Partial<DadosOs> = {}): DadosOs {
    return {
      numeroOs: numeroOsTeste('EDIT'),
      cliente: 'Cliente Original',
      produto: 'Produto Original',
      tipoPagamento: 'Pix',
      valor: 1_000_000n,
      percentualComissao: 700n,
      dataVenda: '2026-09-01',
      observacao: null,
      rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
      ...sobrescrever,
    };
  }

  /** OS com metade paga e, opcionalmente, um lote gerado em cima dela. */
  async function cenario(tx: postgres.TransactionSql, comLote: boolean) {
    const originais = dados();
    const { osId } = await cadastrarOs(tx, originais, usuario.id);
    await registrarBaixaCliente(
      tx,
      { osId, data: '2026-09-05', valor: 500_000n, observacao: null },
      usuario.id,
    );
    if (comLote) {
      await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);
    }
    return { osId, originais };
  }

  it('edita campos livres mesmo com lote pendente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, true);

        await editarOs(
          tx,
          osId,
          { ...originais, cliente: 'Cliente Corrigido', dataVenda: '2026-08-20' },
          usuario.id,
        );

        const [os] = await tx`
          select cliente, to_char(data_venda, 'YYYY-MM-DD') as data_venda, valor
          from public.os where id = ${osId}
        `;
        expect(os.cliente).toBe('Cliente Corrigido');
        expect(os.data_venda).toBe('2026-08-20');
        expect(os.valor).toBe('10000.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('permite aumentar o valor mesmo com lote pendente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, true);

        await editarOs(tx, osId, { ...originais, valor: 2_000_000n }, usuario.id);

        const [os] = await tx`select valor from public.os where id = ${osId}`;
        expect(os.valor).toBe('20000.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa reduzir o valor abaixo do que o lote reservou, dizendo o que fazer', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, true);

        // Com R$ 4.000,00 a comissão total é R$ 280,00, toda liberada (o
        // cliente pagou mais que o valor corrigido), o que fica abaixo dos
        // R$ 350,00 reservados pelo lote e dispara a recusa.
        await expect(
          editarOs(tx, osId, { ...originais, valor: 400_000n }, usuario.id),
        ).rejects.toThrow(/Cancele esse lote/);

        const [os] = await tx`select valor from public.os where id = ${osId}`;
        expect(os.valor).toBe('10000.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('permite reduzir o valor quando não há lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, false);

        await editarOs(tx, osId, { ...originais, valor: 600_000n }, usuario.id);

        const [os] = await tx`select valor from public.os where id = ${osId}`;
        expect(os.valor).toBe('6000.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa mudar o rateio com lote pendente e permite sem lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const comLote = await cenario(tx, true);
        await expect(
          editarOs(
            tx,
            comLote.osId,
            { ...comLote.originais, rateio: { thiago: 600n, geice: 100n, gabrielle: 0n } },
            usuario.id,
          ),
        ).rejects.toThrow(/rateio|divisão/i);

        const semLote = await cenario(tx, false);
        await editarOs(
          tx,
          semLote.osId,
          { ...semLote.originais, rateio: { thiago: 600n, geice: 100n, gabrielle: 0n } },
          usuario.id,
        );
        const [r] = await tx`
          select rateio_thiago, rateio_gabrielle from interno.os_rateio
          where os_id = ${semLote.osId}
        `;
        expect(r.rateio_thiago).toBe('6.00');
        expect(r.rateio_gabrielle).toBe('0.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('aplica as mesmas validações do cadastro e a unicidade do número', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, false);
        const outra = await cadastrarOs(tx, dados(), usuario.id);
        const [outraLinha] = await tx`select numero_os from public.os where id = ${outra.osId}`;

        await expect(
          editarOs(tx, osId, { ...originais, cliente: '   ' }, usuario.id),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          editarOs(tx, osId, { ...originais, valor: 0n }, usuario.id),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          editarOs(
            tx,
            osId,
            { ...originais, rateio: { thiago: 500n, geice: 100n, gabrielle: 50n } },
            usuario.id,
          ),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          editarOs(tx, osId, { ...originais, numeroOs: outraLinha.numero_os }, usuario.id),
        ).rejects.toThrow(/já existe/i);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('registra na auditoria o antes e o depois', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, false);

        await editarOs(tx, osId, { ...originais, valor: 600_000n }, usuario.id);

        const [evento] = await tx`
          select acao, valores_anteriores, valores_novos
          from interno.auditoria_evento
          where entidade = 'os' and entidade_id = ${osId} and acao = 'editar'
        `;
        expect(evento).toBeTruthy();
        expect(evento.valores_anteriores.valor).toBe('1000000');
        expect(evento.valores_novos.valor).toBe('600000');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa OS inexistente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        await expect(
          editarOs(
            tx,
            '11111111-1111-1111-1111-111111111111',
            dados(),
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
