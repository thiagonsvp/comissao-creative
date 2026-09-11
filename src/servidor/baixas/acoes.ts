'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/dominio/dinheiro';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import { tratarErroFormulario, type EstadoFormulario } from '@/servidor/formularios';
import { registrarBaixaCliente } from './servico';

export async function registrarBaixaAction(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const osId = String(formData.get('osId') ?? '');
  try {
    const sessao = await exigirPapel('admin');
    await comTransacaoFinanceira((tx) =>
      registrarBaixaCliente(
        tx,
        {
          osId,
          data: String(formData.get('data') ?? ''),
          valor: parseDecimal(String(formData.get('valor') ?? '')),
          observacao: String(formData.get('observacao') ?? '').trim() || null,
        },
        sessao.userId,
      ),
    );
  } catch (erro) {
    return tratarErroFormulario(erro);
  }

  // Fora do try: redirect() sinaliza por exceção e não pode ser capturado aqui.
  revalidatePath('/os');
  revalidatePath(`/os/${osId}`);
  redirect(`/os/${osId}`);
}
