import { describe, it, expect, afterAll } from 'vitest';
import { sql, comTransacaoFinanceira } from '@/servidor/db';

describe('comTransacaoFinanceira', () => {
  it('confirma a transação quando fn resolve', async () => {
    const linhas = await comTransacaoFinanceira(async (tx) => tx`select 1 as um`);
    expect(linhas[0].um).toBe(1);
  });

  it('reverte tudo quando fn lança', async () => {
    const numero = numeroOsTesteLocal();
    await expect(comTransacaoFinanceira(async (tx) => {
      await tx`insert into public.os (numero_os, numero_os_normalizado, cliente, produto, valor, percentual_comissao, data_venda)
                values (${numero}, ${numero}, 'Cliente Teste', 'Produto Teste', 100.00, 7.00, current_date)`;
      throw new Error('forçando rollback');
    })).rejects.toThrow('forçando rollback');
    const restante = await sql`select id from public.os where numero_os_normalizado = ${numero}`;
    expect(restante).toHaveLength(0);
  });

  it('serializa duas transações concorrentes pelo bloqueio global', async () => {
    const eventos: string[] = [];
    const lenta = comTransacaoFinanceira(async (tx) => {
      eventos.push('lenta:inicio');
      await tx`select pg_sleep(0.3)`;
      eventos.push('lenta:fim');
    });
    await new Promise((r) => setTimeout(r, 50)); // garante que "lenta" já pegou o lock primeiro
    const rapida = comTransacaoFinanceira(async () => {
      eventos.push('rapida:inicio');
    });
    await Promise.all([lenta, rapida]);
    expect(eventos).toEqual(['lenta:inicio', 'lenta:fim', 'rapida:inicio']);
  });

  function numeroOsTesteLocal() {
    return `TESTE-DB-${Math.random().toString(36).slice(2, 10)}`;
  }

  afterAll(async () => {
    await sql.end();
  });
});
