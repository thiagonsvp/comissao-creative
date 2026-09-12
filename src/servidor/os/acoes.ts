'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { validarDataIso } from '@/dominio/datas';
import { parseDecimal, parsePercentual } from '@/dominio/dinheiro';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import { tratarErroFormulario, type EstadoFormulario } from '@/servidor/formularios';
import { cadastrarOs, editarOs } from './servico';

export async function cadastrarOsAction(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let osId: string;
  try {
    const sessao = await exigirPapel('admin');
    const dados = {
      numeroOs: String(formData.get('numeroOs') ?? ''),
      cliente: String(formData.get('cliente') ?? ''),
      produto: String(formData.get('produto') ?? ''),
      tipoPagamento: String(formData.get('tipoPagamento') ?? ''),
      valor: parseDecimal(String(formData.get('valor') ?? '')),
      percentualComissao: parsePercentual(String(formData.get('percentualComissao') ?? '')),
      dataVenda: validarDataIso(String(formData.get('dataVenda') ?? ''), 'dataVenda'),
      observacao: String(formData.get('observacao') ?? '').trim() || null,
      rateio: {
        thiago: parsePercentual(String(formData.get('rateioThiago') ?? '')),
        geice: parsePercentual(String(formData.get('rateioGeice') ?? '')),
        gabrielle: parsePercentual(String(formData.get('rateioGabrielle') ?? '')),
      },
    };
    const resultado = await comTransacaoFinanceira((tx) =>
      cadastrarOs(tx, dados, sessao.userId),
    );
    osId = resultado.osId;
  } catch (erro) {
    return tratarErroFormulario(erro);
  }

  // Fora do try: redirect() sinaliza por exceção e não pode ser capturado aqui.
  revalidatePath('/os');
  redirect(`/os/${osId}`);
}

export async function editarOsAction(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const osId = String(formData.get('osId') ?? '');
  try {
    const sessao = await exigirPapel('admin');
    const dados = {
      numeroOs: String(formData.get('numeroOs') ?? ''),
      cliente: String(formData.get('cliente') ?? ''),
      produto: String(formData.get('produto') ?? ''),
      tipoPagamento: String(formData.get('tipoPagamento') ?? ''),
      valor: parseDecimal(String(formData.get('valor') ?? '')),
      percentualComissao: parsePercentual(String(formData.get('percentualComissao') ?? '')),
      dataVenda: validarDataIso(String(formData.get('dataVenda') ?? ''), 'dataVenda'),
      observacao: String(formData.get('observacao') ?? '').trim() || null,
      rateio: {
        thiago: parsePercentual(String(formData.get('rateioThiago') ?? '')),
        geice: parsePercentual(String(formData.get('rateioGeice') ?? '')),
        gabrielle: parsePercentual(String(formData.get('rateioGabrielle') ?? '')),
      },
    };
    await comTransacaoFinanceira((tx) => editarOs(tx, osId, dados, sessao.userId));
  } catch (erro) {
    return tratarErroFormulario(erro);
  }

  // Fora do try: redirect() sinaliza por exceção e não pode ser capturado aqui.
  revalidatePath('/os');
  revalidatePath(`/os/${osId}`);
  revalidatePath('/');
  redirect(`/os/${osId}`);
}
