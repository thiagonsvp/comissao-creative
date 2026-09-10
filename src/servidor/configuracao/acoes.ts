'use server';

import { revalidatePath } from 'next/cache';
import { parsePercentual } from '@/dominio/dinheiro';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import {
  ESTADO_INICIAL_FORMULARIO,
  tratarErroFormulario,
  type EstadoFormulario,
} from '@/servidor/formularios';
import { atualizarConfiguracao } from './servico';

export async function salvarConfiguracaoAction(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const sessao = await exigirPapel('admin');
    const dados = {
      percentualComissaoPadrao: parsePercentual(
        String(formData.get('percentualComissaoPadrao')),
      ),
      rateioThiagoPadrao: parsePercentual(String(formData.get('rateioThiagoPadrao'))),
      rateioGeicePadrao: parsePercentual(String(formData.get('rateioGeicePadrao'))),
      rateioGabriellePadrao: parsePercentual(
        String(formData.get('rateioGabriellePadrao')),
      ),
    };
    await comTransacaoFinanceira((tx) =>
      atualizarConfiguracao(tx, dados, sessao.userId),
    );
    revalidatePath('/configuracao');
    return ESTADO_INICIAL_FORMULARIO;
  } catch (erro) {
    return tratarErroFormulario(erro);
  }
}
