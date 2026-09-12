'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/dominio/dinheiro';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import {
  ESTADO_INICIAL_FORMULARIO,
  tratarErroFormulario,
  type EstadoFormulario,
} from '@/servidor/formularios';
import { estornarBaixaCliente, registrarBaixaCliente } from './servico';

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

export async function estornarBaixaAction(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const osId = String(formData.get('osId') ?? '');
  try {
    const sessao = await exigirPapel('admin');
    await comTransacaoFinanceira((tx) =>
      estornarBaixaCliente(
        tx,
        {
          baixaId: String(formData.get('baixaId') ?? ''),
          valor: parseDecimal(String(formData.get('valor') ?? '')),
          data: String(formData.get('data') ?? ''),
          motivo: String(formData.get('motivo') ?? ''),
        },
        sessao.userId,
      ),
    );
  } catch (erro) {
    return tratarErroFormulario(erro);
  }

  revalidatePath('/os');
  revalidatePath(`/os/${osId}`);
  revalidatePath('/');
  return ESTADO_INICIAL_FORMULARIO;
}
