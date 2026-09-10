import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErroValidacao } from '@/dominio/erros';
import { atualizarConfiguracao, obterConfiguracao } from '@/servidor/configuracao/servico';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { criarUsuarioTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('configuração comercial', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  it('lê os valores padrão (7,00% / 5/1/1)', async () => {
    expect(await obterConfiguracao()).toEqual({
      percentualComissaoPadrao: 700n,
      rateioThiagoPadrao: 500n,
      rateioGeicePadrao: 100n,
      rateioGabriellePadrao: 100n,
    });
  });

  it('atualiza as duas tabelas e registra auditoria atomicamente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        await atualizarConfiguracao(
          tx,
          {
            percentualComissaoPadrao: 800n,
            rateioThiagoPadrao: 600n,
            rateioGeicePadrao: 100n,
            rateioGabriellePadrao: 100n,
          },
          usuario.id,
        );
        const [linha] = await tx`
          select cc.percentual_comissao_padrao, cr.rateio_thiago_padrao
          from public.configuracao_comercial cc
          join interno.configuracao_rateio cr on cr.configuracao_id = cc.id
          where cc.id = 1
        `;
        expect(linha.percentual_comissao_padrao).toBe('8.00');
        expect(linha.rateio_thiago_padrao).toBe('6.00');
        const [auditoria] = await tx`
          select id from interno.auditoria_evento
          where entidade = 'configuracao_comercial' and responsavel_id = ${usuario.id}
        `;
        expect(auditoria).toBeTruthy();
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('rejeita rateio cuja soma não bate com o total', async () => {
    await expect(
      comTransacaoFinanceira((tx) =>
        atualizarConfiguracao(
          tx,
          {
            percentualComissaoPadrao: 700n,
            rateioThiagoPadrao: 500n,
            rateioGeicePadrao: 100n,
            rateioGabriellePadrao: 50n,
          },
          usuario.id,
        ),
      ),
    ).rejects.toThrow(ErroValidacao);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
