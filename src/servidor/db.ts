import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada em .env.local');
}

export const sql = postgres(process.env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  onnotice: () => {},
});

/**
 * Leituras podem rodar na conexão normal ou dentro de uma transação
 * financeira em andamento (a prévia de lote precisa enxergar o que a própria
 * transação já escreveu, sob o bloqueio global).
 */
export type Executor = postgres.Sql | postgres.TransactionSql;

export async function comTransacaoFinanceira<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const resultado = await sql.begin(async (tx) => {
    await tx`select id from public.controle_financeiro where id = 1 for update`;
    return fn(tx);
  });

  // postgres.js modela callbacks que retornam arrays com um tipo condicional
  // (UnwrapPromiseArray<T>), mesmo quando o callback já devolve Promise<T>.
  return resultado as T;
}
