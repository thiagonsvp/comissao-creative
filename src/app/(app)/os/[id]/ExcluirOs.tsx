'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/Botao';
import { excluirOsAction } from '@/servidor/os/acoes';

export function ExcluirOs({ osId }: { osId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  if (!confirmando) {
    return (
      <Botao type="button" variante="destrutivo" onClick={() => setConfirmando(true)}>
        Excluir OS
      </Botao>
    );
  }

  return (
    <div className="w-full rounded-xl border border-erro bg-erro-suave p-3.5 md:max-w-md">
      <p className="text-[13px]">
        A exclusão é permanente e só será permitida se a OS não tiver pagamentos,
        estornos ou lotes vinculados.
      </p>
      {erro && <p role="alert" className="mt-2 text-[13px] text-erro">{erro}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao
          type="button"
          variante="destrutivo"
          carregando={pendente}
          onClick={() => iniciarTransicao(async () => {
            const resultado = await excluirOsAction(osId);
            if (resultado.erro) {
              setErro(resultado.erro);
              return;
            }
            router.replace('/os');
            router.refresh();
          })}
        >
          Confirmar exclusão
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => { setConfirmando(false); setErro(null); }}>
          Voltar
        </Botao>
      </div>
    </div>
  );
}
