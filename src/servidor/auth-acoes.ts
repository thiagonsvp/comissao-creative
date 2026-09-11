'use server';

import { redirect } from 'next/navigation';
import { tratarErroFormulario, type EstadoFormulario } from './formularios';
import { criarClienteServidor } from './supabase/servidor';

export async function entrarAction(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('senha') ?? '');

  try {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { erroGeral: 'E-mail ou senha inválidos', errosPorCampo: {} };
    }
  } catch (erro) {
    return tratarErroFormulario(erro);
  }

  // Fora do try: redirect() sinaliza por exceção e não pode ser capturado aqui.
  redirect('/');
}

export async function sairAction(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect('/login');
}
