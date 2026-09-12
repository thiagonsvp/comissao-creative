'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { CampoPercentual } from '@/componentes/CampoMoeda';
import { formatarPercentual, type Percentual } from '@/dominio/dinheiro';
import { salvarConfiguracaoAction } from '@/servidor/configuracao/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

function paraTexto(percentual: Percentual): string {
  return formatarPercentual(percentual).replace('%', '');
}

export function FormularioConfiguracao({
  configuracaoAtual,
}: {
  configuracaoAtual: {
    percentualComissaoPadrao: Percentual;
    rateioThiagoPadrao: Percentual;
    rateioGeicePadrao: Percentual;
    rateioGabriellePadrao: Percentual;
  };
}) {
  const [estado, acao, emAndamento] = useActionState(
    salvarConfiguracaoAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  return (
    <form action={acao} className="flex max-w-md flex-col gap-4">
      <CampoPercentual
        nome="percentualComissaoPadrao"
        id="percentualComissaoPadrao"
        rotulo="% de comissão padrão"
        valorInicial={paraTexto(configuracaoAtual.percentualComissaoPadrao)}
        obrigatorio
        erro={estado.errosPorCampo.percentualComissaoPadrao}
      />

      <fieldset className="rounded-xl border border-borda bg-superficie p-4">
        <legend className="rotulo px-1">Rateio padrão · precisa somar o percentual acima</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoPercentual
            nome="rateioThiagoPadrao"
            id="rateioThiagoPadrao"
            rotulo="Thiago"
            valorInicial={paraTexto(configuracaoAtual.rateioThiagoPadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateioThiagoPadrao}
          />
          <CampoPercentual
            nome="rateioGeicePadrao"
            id="rateioGeicePadrao"
            rotulo="Geice"
            valorInicial={paraTexto(configuracaoAtual.rateioGeicePadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateioGeicePadrao}
          />
          <CampoPercentual
            nome="rateioGabriellePadrao"
            id="rateioGabriellePadrao"
            rotulo="Gabrielle"
            valorInicial={paraTexto(configuracaoAtual.rateioGabriellePadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateioGabriellePadrao}
          />
        </div>
      </fieldset>

      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal className="sm:w-fit">
        Salvar
      </Botao>
    </form>
  );
}
