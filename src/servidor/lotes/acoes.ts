'use server';

import { revalidatePath } from 'next/cache';
import { ErroPermissao, ErroValidacao } from '@/dominio/erros';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import { aprovarLote } from './servico';

export async function aprovarLoteAction(
  loteId: string,
): Promise<{ erro: string | null }> {
  try {
    const sessao = await exigirPapel('admin');
    await comTransacaoFinanceira((tx) => aprovarLote(tx, loteId, sessao.userId));
  } catch (erro) {
    if (erro instanceof ErroValidacao || erro instanceof ErroPermissao) {
      return { erro: erro.message };
    }
    console.error(erro);
    return { erro: 'Ocorreu um erro inesperado. Tente novamente.' };
  }

  revalidatePath('/lotes');
  revalidatePath(`/lotes/${loteId}`);
  return { erro: null };
}
