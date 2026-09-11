'use client';

import { useActionState } from 'react';
import { Campo } from '@/componentes/Campo';
import { registrarBaixaAction } from '@/servidor/baixas/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

const CLASSE_CAMPO = 'rounded border px-3 py-2';

export function FormularioBaixa({ osId, dataPadrao }: { osId: string; dataPadrao: string }) {
  const [estado, acao, emAndamento] = useActionState(
    registrarBaixaAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  return (
    <form action={acao} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="osId" value={osId} />
      <Campo rotulo="Data do pagamento" htmlFor="data" erro={estado.errosPorCampo.data}>
        <input
          type="date"
          name="data"
          id="data"
          defaultValue={dataPadrao}
          required
          className={CLASSE_CAMPO}
        />
      </Campo>
      <Campo rotulo="Valor pago (R$)" htmlFor="valor" erro={estado.errosPorCampo.valor}>
        <input
          name="valor"
          id="valor"
          inputMode="decimal"
          placeholder="0,00"
          required
          className={CLASSE_CAMPO}
        />
      </Campo>
      <Campo rotulo="Observação" htmlFor="observacao">
        <input name="observacao" id="observacao" className={CLASSE_CAMPO} />
      </Campo>
      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button
        type="submit"
        disabled={emAndamento}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Registrar pagamento
      </button>
    </form>
  );
}
