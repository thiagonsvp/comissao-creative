'use client';

import { useState, useTransition } from 'react';
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
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciarTransicao(async () => {
            const resultado = await aprovarLoteAction(loteId);
            setErro(resultado.erro);
          })
        }
        className="w-fit rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Marcar como aprovado pelo financeiro
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
