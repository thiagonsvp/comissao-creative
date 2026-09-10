import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import { paraJson } from '@/dominio/json';
import { ErroValidacao } from '@/dominio/erros';

function hashConteudo(conteudo: unknown): string {
  return createHash('sha256').update(paraJson(conteudo)).digest('hex');
}

export async function executarIdempotente<T extends Record<string, string>>(
  tx: postgres.TransactionSql,
  params: { chave: string; usuarioId: string; tipoAcao: string; conteudo: unknown },
  executar: () => Promise<T>,
): Promise<T> {
  const hash = hashConteudo(params.conteudo);
  const [existente] = await tx`
    select resultado, hash_conteudo
    from interno.operacao_idempotente
    where chave = ${params.chave}
  `;

  if (existente) {
    if (existente.hash_conteudo !== hash) {
      throw new ErroValidacao(
        'Esta operação já foi executada com dados diferentes. Recarregue a página.',
      );
    }
    return existente.resultado as T;
  }

  const resultado = await executar();
  await tx`
    insert into interno.operacao_idempotente
      (chave, usuario_id, tipo_acao, hash_conteudo, resultado)
    values (
      ${params.chave}, ${params.usuarioId}, ${params.tipoAcao}, ${hash}, ${tx.json(resultado)}
    )
  `;
  return resultado;
}
