import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { executarIdempotente } from '@/servidor/idempotencia';
import { ErroValidacao } from '@/dominio/erros';
import { criarUsuarioTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('executarIdempotente', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  it('executa uma vez, repete o resultado e rejeita conteúdo diferente', async () => {
    const chave = randomUUID();
    let execucoes = 0;
    const executar = async () => {
      execucoes += 1;
      return { osId: randomUUID() };
    };

    await expect(
      comTransacaoFinanceira(async (tx) => {
        const parametros = {
          chave,
          usuarioId: usuario.id,
          tipoAcao: 'criar_os',
          conteudo: { numeroOs: 'TESTE-IDEM-1' },
        };
        const r1 = await executarIdempotente(tx, parametros, executar);
        const r2 = await executarIdempotente(tx, parametros, executar);
        expect(execucoes).toBe(1);
        expect(r2).toEqual(r1);

        await expect(
          executarIdempotente(
            tx,
            { ...parametros, conteudo: { numeroOs: 'TESTE-IDEM-2' } },
            async () => ({ osId: randomUUID() }),
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
