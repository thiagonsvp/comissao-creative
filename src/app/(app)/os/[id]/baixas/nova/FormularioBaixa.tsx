'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { Campo, CampoTexto, CLASSE_ENTRADA } from '@/componentes/Campo';
import { CampoMoeda } from '@/componentes/CampoMoeda';
import { registrarBaixaAction } from '@/servidor/baixas/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

export function FormularioBaixa({
  osId,
  dataPadrao,
}: {
  osId: string;
  dataPadrao: string;
}) {
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
          className={`num ${CLASSE_ENTRADA}`}
        />
      </Campo>
      <CampoMoeda
        nome="valor"
        id="valor"
        rotulo="Valor pago"
        obrigatorio
        erro={estado.errosPorCampo.valor}
      />
      <CampoTexto nome="observacao" id="observacao" rotulo="Observação" />
      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal className="sm:w-fit">
        Registrar pagamento
      </Botao>
    </form>
  );
}
