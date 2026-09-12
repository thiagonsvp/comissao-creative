'use client';

import { useActionState, useState } from 'react';
import { Botao } from '@/componentes/Botao';
import { Campo, CampoTexto, CLASSE_ENTRADA } from '@/componentes/Campo';
import { CampoMoeda } from '@/componentes/CampoMoeda';
import { estornarBaixaAction } from '@/servidor/baixas/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

export function EstornarBaixa({
  osId,
  baixaId,
  saldoEstornavel,
  dataPadrao,
}: {
  osId: string;
  baixaId: string;
  /** Já formatado para o campo, ex.: "5000,00". */
  saldoEstornavel: string;
  dataPadrao: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, emAndamento] = useActionState(
    estornarBaixaAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="min-h-11 px-1 text-[12.5px] text-texto-2 underline"
      >
        Estornar
      </button>
    );
  }

  return (
    <form action={acao} className="mt-3 flex flex-col gap-3 rounded-xl border border-borda bg-superficie-2 p-3.5">
      <input type="hidden" name="osId" value={osId} />
      <input type="hidden" name="baixaId" value={baixaId} />
      <p className="text-[12.5px] text-texto-2">
        O recebimento não é apagado: o estorno entra como um lançamento de sinal
        contrário, vinculado a ele.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoMoeda
          nome="valor"
          id={`valor-${baixaId}`}
          rotulo="Valor a estornar"
          valorInicial={saldoEstornavel}
          obrigatorio
          erro={estado.errosPorCampo.valor}
        />
        <Campo rotulo="Data" htmlFor={`data-${baixaId}`} erro={estado.errosPorCampo.data}>
          <input
            type="date"
            name="data"
            id={`data-${baixaId}`}
            defaultValue={dataPadrao}
            required
            className={`num ${CLASSE_ENTRADA}`}
          />
        </Campo>
      </div>
      <CampoTexto
        nome="motivo"
        id={`motivo-${baixaId}`}
        rotulo="Motivo"
        required
        erro={estado.errosPorCampo.motivo}
      />
      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={emAndamento}>
          Confirmar estorno
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
