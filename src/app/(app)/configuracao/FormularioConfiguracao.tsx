'use client';

import { useActionState } from 'react';
import { Campo } from '@/componentes/Campo';
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
    <form action={acao} className="flex max-w-sm flex-col gap-4">
      <p className="text-sm text-gray-600">
        Estes valores só valem para OS novas; OS já cadastradas mantêm seus próprios
        percentuais.
      </p>
      <Campo
        label="% de comissão padrão"
        htmlFor="percentualComissaoPadrao"
        erro={estado.errosPorCampo.percentualComissaoPadrao}
      >
        <input
          name="percentualComissaoPadrao"
          id="percentualComissaoPadrao"
          defaultValue={paraTexto(configuracaoAtual.percentualComissaoPadrao)}
          className="rounded border px-3 py-2"
        />
      </Campo>
      <Campo
        label="% Thiago"
        htmlFor="rateioThiagoPadrao"
        erro={estado.errosPorCampo.rateioThiagoPadrao}
      >
        <input
          name="rateioThiagoPadrao"
          id="rateioThiagoPadrao"
          defaultValue={paraTexto(configuracaoAtual.rateioThiagoPadrao)}
          className="rounded border px-3 py-2"
        />
      </Campo>
      <Campo
        label="% Geice"
        htmlFor="rateioGeicePadrao"
        erro={estado.errosPorCampo.rateioGeicePadrao}
      >
        <input
          name="rateioGeicePadrao"
          id="rateioGeicePadrao"
          defaultValue={paraTexto(configuracaoAtual.rateioGeicePadrao)}
          className="rounded border px-3 py-2"
        />
      </Campo>
      <Campo
        label="% Gabrielle"
        htmlFor="rateioGabriellePadrao"
        erro={estado.errosPorCampo.rateioGabriellePadrao}
      >
        <input
          name="rateioGabriellePadrao"
          id="rateioGabriellePadrao"
          defaultValue={paraTexto(configuracaoAtual.rateioGabriellePadrao)}
          className="rounded border px-3 py-2"
        />
      </Campo>
      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button
        type="submit"
        disabled={emAndamento}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Salvar
      </button>
    </form>
  );
}
