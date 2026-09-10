import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { registrarAuditoria } from '@/servidor/auditoria';

describe('registrarAuditoria', () => {
  const entidadeId = randomUUID();

  it('grava entidade, ação, motivo e valores', async () => {
    await comTransacaoFinanceira((tx) =>
      registrarAuditoria(tx, {
        entidade: 'os',
        entidadeId,
        acao: 'criar',
        responsavelId: randomUUID(),
        motivo: 'cadastro inicial',
        valoresNovos: { valor: 100_000n, numeroOs: 'TESTE-AUD-1' },
      }),
    );
    const [linha] =
      await sql`select * from interno.auditoria_evento where entidade_id = ${entidadeId}`;
    expect(linha.entidade).toBe('os');
    expect(linha.acao).toBe('criar');
    expect(linha.motivo).toBe('cadastro inicial');
    expect(linha.valores_novos).toEqual({ valor: '100000', numeroOs: 'TESTE-AUD-1' });
  });

  afterAll(async () => {
    await sql`delete from interno.auditoria_evento where entidade_id = ${entidadeId}`;
    await sql.end();
  });
});
