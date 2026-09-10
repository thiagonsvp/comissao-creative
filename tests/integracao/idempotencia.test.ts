import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { executarIdempotente } from '@/servidor/idempotencia';
import { ErroValidacao } from '@/dominio/erros';

describe('executarIdempotente', () => {
  const chave = randomUUID();
  const usuarioId = randomUUID();

  it('executa uma vez e repete o mesmo resultado para a mesma chave e conteúdo', async () => {
    let execucoes = 0;
    const executar = async () => {
      execucoes += 1;
      return { osId: randomUUID() };
    };
    const r1 = await comTransacaoFinanceira((tx) =>
      executarIdempotente(
        tx,
        {
          chave,
          usuarioId,
          tipoAcao: 'criar_os',
          conteudo: { numeroOs: 'TESTE-IDEM-1' },
        },
        executar,
      ),
    );
    const r2 = await comTransacaoFinanceira((tx) =>
      executarIdempotente(
        tx,
        {
          chave,
          usuarioId,
          tipoAcao: 'criar_os',
          conteudo: { numeroOs: 'TESTE-IDEM-1' },
        },
        executar,
      ),
    );
    expect(execucoes).toBe(1);
    expect(r2).toEqual(r1);
  });

  it('rejeita a mesma chave com conteúdo diferente', async () => {
    await expect(
      comTransacaoFinanceira((tx) =>
        executarIdempotente(
          tx,
          {
            chave,
            usuarioId,
            tipoAcao: 'criar_os',
            conteudo: { numeroOs: 'TESTE-IDEM-2' },
          },
          async () => ({ osId: randomUUID() }),
        ),
      ),
    ).rejects.toThrow(ErroValidacao);
  });

  afterAll(async () => {
    await sql`delete from interno.operacao_idempotente where chave = ${chave}`;
    await sql.end();
  });
});
