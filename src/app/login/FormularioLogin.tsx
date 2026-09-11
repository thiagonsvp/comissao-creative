'use client';

import { useActionState } from 'react';
import { Campo } from '@/componentes/Campo';
import { entrarAction } from '@/servidor/auth-acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

const CLASSE_CAMPO = 'rounded border px-3 py-2';

export function FormularioLogin() {
  const [estado, acao, emAndamento] = useActionState(
    entrarAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  return (
    <form action={acao} className="flex w-full max-w-xs flex-col gap-4">
      <Campo rotulo="E-mail" htmlFor="email" erro={estado.errosPorCampo.email}>
        <input
          type="email"
          name="email"
          id="email"
          autoComplete="username"
          required
          className={CLASSE_CAMPO}
        />
      </Campo>
      <Campo rotulo="Senha" htmlFor="senha" erro={estado.errosPorCampo.senha}>
        <input
          type="password"
          name="senha"
          id="senha"
          autoComplete="current-password"
          required
          className={CLASSE_CAMPO}
        />
      </Campo>
      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button
        type="submit"
        disabled={emAndamento}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Entrar
      </button>
      <p className="text-xs text-gray-500">
        Esqueceu a senha? Peça para o responsável pelo sistema redefinir diretamente no
        Supabase.
      </p>
    </form>
  );
}
