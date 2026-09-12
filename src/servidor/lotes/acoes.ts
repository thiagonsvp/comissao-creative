'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ErroPermissao, ErroValidacao } from '@/dominio/erros';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import {
  tratarErroFormulario,
  type EstadoFormulario,
} from '@/servidor/formularios';
import {
  aprovarLote,
  cancelarLote,
  desfazerAprovacaoLote,
  editarDatasLote,
  excluirLote,
  gerarLote,
} from './servico';

export async function aprovarLoteAction(
  loteId: string,
  dataAprovacao: string,
): Promise<{ erro: string | null }> {
  try {
    const sessao = await exigirPapel('admin');
    await comTransacaoFinanceira((tx) =>
      aprovarLote(tx, loteId, sessao.userId, dataAprovacao),
    );
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

export async function gerarLoteAction(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const osIds = formData.getAll('osIds').map(String);
  const observacao = String(formData.get('observacao') ?? '').trim() || null;
  const loteOrigemId = String(formData.get('loteOrigemId') ?? '') || undefined;

  let loteId: string;
  try {
    const sessao = await exigirPapel('admin');
    const resultado = await comTransacaoFinanceira((tx) =>
      gerarLote(tx, { osIds, observacao, loteOrigemId }, sessao.userId),
    );
    loteId = resultado.loteId;
  } catch (erro) {
    return tratarErroFormulario(erro);
  }

  // Fora do try: redirect() sinaliza por exceção e não pode ser capturado aqui.
  revalidatePath('/lotes');
  revalidatePath('/os');
  redirect(`/lotes/${loteId}`);
}

async function mudarEstadoDoLote(
  loteId: string,
  acao: (tx: Parameters<typeof cancelarLote>[0], usuarioId: string) => Promise<void>,
): Promise<{ erro: string | null }> {
  try {
    const sessao = await exigirPapel('admin');
    await comTransacaoFinanceira((tx) => acao(tx, sessao.userId));
  } catch (erro) {
    if (erro instanceof ErroValidacao || erro instanceof ErroPermissao) {
      return { erro: erro.message };
    }
    console.error(erro);
    return { erro: 'Ocorreu um erro inesperado. Tente novamente.' };
  }

  revalidatePath('/lotes');
  revalidatePath(`/lotes/${loteId}`);
  revalidatePath('/os');
  revalidatePath('/');
  return { erro: null };
}

export async function cancelarLoteAction(
  loteId: string,
  motivo: string,
): Promise<{ erro: string | null }> {
  return mudarEstadoDoLote(loteId, (tx, usuarioId) =>
    cancelarLote(tx, loteId, motivo, usuarioId),
  );
}

export async function desfazerAprovacaoAction(
  loteId: string,
  motivo: string,
): Promise<{ erro: string | null }> {
  return mudarEstadoDoLote(loteId, (tx, usuarioId) =>
    desfazerAprovacaoLote(tx, loteId, motivo, usuarioId),
  );
}

export async function editarDatasLoteAction(
  loteId: string,
  dataEnvio: string,
  dataAprovacao: string | null,
): Promise<{ erro: string | null }> {
  return mudarEstadoDoLote(loteId, (tx, usuarioId) =>
    editarDatasLote(tx, loteId, { dataEnvio, dataAprovacao }, usuarioId),
  );
}

export async function excluirLoteAction(
  loteId: string,
): Promise<{ erro: string | null }> {
  return mudarEstadoDoLote(loteId, (tx, usuarioId) =>
    excluirLote(tx, loteId, usuarioId),
  );
}
