'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { CampoTexto } from '@/componentes/Campo';
import { entrarAction } from '@/servidor/auth-acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

export function FormularioLogin() {
  const [estado, acao, emAndamento] = useActionState(
    entrarAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  return (
    <form action={acao} className="flex w-full flex-col gap-4">
      <CampoTexto
        nome="email"
        id="email"
        rotulo="E-mail"
        type="email"
        autoComplete="username"
        required
        erro={estado.errosPorCampo.email}
      />
      <CampoTexto
        nome="senha"
        id="senha"
        rotulo="Senha"
        type="password"
        autoComplete="current-password"
        required
        erro={estado.errosPorCampo.senha}
      />
      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal>
        Entrar
      </Botao>
      <p className="text-xs text-texto-2">
        Esqueceu a senha? Peça para o responsável pelo sistema redefinir no Supabase.
      </p>
    </form>
  );
}
