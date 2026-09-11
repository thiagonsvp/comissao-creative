import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { registrarAuditoria } from '@/servidor/auditoria';
import { criarUsuarioTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('registrarAuditoria', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  it('grava entidade, ação, motivo e valores', async () => {
    const entidadeId = randomUUID();
    await expect(
      comTransacaoFinanceira(async (tx) => {
        await registrarAuditoria(tx, {
          entidade: 'os',
          entidadeId,
          acao: 'criar',
          responsavelId: usuario.id,
          motivo: 'cadastro inicial',
          valoresNovos: { valor: 100_000n, numeroOs: 'TESTE-AUD-1' },
        });
        const [linha] =
          await tx`select * from interno.auditoria_evento where entidade_id = ${entidadeId}`;
        expect(linha.entidade).toBe('os');
        expect(linha.acao).toBe('criar');
        expect(linha.motivo).toBe('cadastro inicial');
        expect(linha.valores_novos).toEqual({
          valor: '100000',
          numeroOs: 'TESTE-AUD-1',
        });
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
