'use client';

import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/Botao';
import { aprovarLoteAction } from '@/servidor/lotes/acoes';

export function AcoesLote({
  loteId,
  estadoConferencia,
}: {
  loteId: string;
  estadoConferencia: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  if (estadoConferencia !== 'enviado') return null;

  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        carregando={pendente}
        onClick={() =>
          iniciarTransicao(async () => {
            const resultado = await aprovarLoteAction(loteId);
            setErro(resultado.erro);
          })
        }
      >
        Marcar como aprovado pelo financeiro
      </Botao>
      {erro && (
        <p role="alert" className="text-[13px] text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
