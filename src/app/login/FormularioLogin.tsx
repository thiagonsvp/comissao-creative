'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Botao } from '@/componentes/Botao';
import { CampoTexto } from '@/componentes/Campo';
import { criarClienteNavegador } from '@/servidor/supabase/navegador';

export function FormularioLogin() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [emAndamento, setEmAndamento] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEmAndamento(true);

    const dados = new FormData(evento.currentTarget);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(dados.get('email') ?? ''),
      password: String(dados.get('senha') ?? ''),
    });

    setEmAndamento(false);

    if (error) {
      setErro(
        error.code === 'invalid_credentials'
          ? 'E-mail ou senha inválidos'
          : `Não foi possível entrar: ${error.message}`,
      );
      return;
    }

    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="flex w-full flex-col gap-4">
      <CampoTexto
        nome="email"
        id="email"
        rotulo="E-mail"
        type="email"
        autoComplete="username"
        required
      />
      <CampoTexto
        nome="senha"
        id="senha"
        rotulo="Senha"
        type="password"
        autoComplete="current-password"
        required
      />
      {erro && (
        <p role="alert" className="text-[13px] text-erro">
          {erro}
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
