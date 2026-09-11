'use client';

import { useActionState } from 'react';
import { Campo } from '@/componentes/Campo';
import { formatarPercentual, type Percentual } from '@/dominio/dinheiro';
import { cadastrarOsAction } from '@/servidor/os/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

function paraTexto(percentual: Percentual): string {
  return formatarPercentual(percentual).replace('%', '');
}

const CLASSE_CAMPO = 'rounded border px-3 py-2';

export function FormularioOs({
  configuracaoAtual,
  dataPadrao,
}: {
  configuracaoAtual: {
    percentualComissaoPadrao: Percentual;
    rateioThiagoPadrao: Percentual;
    rateioGeicePadrao: Percentual;
    rateioGabriellePadrao: Percentual;
  };
  dataPadrao: string;
}) {
  const [estado, acao, emAndamento] = useActionState(
    cadastrarOsAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  return (
    <form action={acao} className="flex max-w-lg flex-col gap-4">
      <Campo label="Número da OS" htmlFor="numeroOs" erro={estado.errosPorCampo.numeroOs}>
        <input name="numeroOs" id="numeroOs" required className={CLASSE_CAMPO} />
      </Campo>
      <Campo label="Cliente" htmlFor="cliente" erro={estado.errosPorCampo.cliente}>
        <input name="cliente" id="cliente" required className={CLASSE_CAMPO} />
      </Campo>
      <Campo label="Produto" htmlFor="produto" erro={estado.errosPorCampo.produto}>
        <input name="produto" id="produto" required className={CLASSE_CAMPO} />
      </Campo>
      <Campo
        label="Tipo de pagamento"
        htmlFor="tipoPagamento"
        erro={estado.errosPorCampo.tipoPagamento}
      >
        <input name="tipoPagamento" id="tipoPagamento" required className={CLASSE_CAMPO} />
      </Campo>
      <Campo label="Valor (R$)" htmlFor="valor" erro={estado.errosPorCampo.valor}>
        <input
          name="valor"
          id="valor"
          inputMode="decimal"
          placeholder="0,00"
          required
          className={CLASSE_CAMPO}
        />
      </Campo>
      <Campo label="Data da venda" htmlFor="dataVenda" erro={estado.errosPorCampo.dataVenda}>
        <input
          type="date"
          name="dataVenda"
          id="dataVenda"
          defaultValue={dataPadrao}
          required
          className={CLASSE_CAMPO}
        />
      </Campo>
      <Campo
        label="% comissão total"
        htmlFor="percentualComissao"
        erro={estado.errosPorCampo.percentualComissao}
      >
        <input
          name="percentualComissao"
          id="percentualComissao"
          inputMode="decimal"
          defaultValue={paraTexto(configuracaoAtual.percentualComissaoPadrao)}
          required
          className={CLASSE_CAMPO}
        />
      </Campo>
      <div className="grid grid-cols-3 gap-2">
        <Campo label="% Thiago" htmlFor="rateioThiago" erro={estado.errosPorCampo.rateio_thiago}>
          <input
            name="rateioThiago"
            id="rateioThiago"
            inputMode="decimal"
            defaultValue={paraTexto(configuracaoAtual.rateioThiagoPadrao)}
            required
            className={CLASSE_CAMPO}
          />
        </Campo>
        <Campo label="% Geice" htmlFor="rateioGeice" erro={estado.errosPorCampo.rateio_geice}>
          <input
            name="rateioGeice"
            id="rateioGeice"
            inputMode="decimal"
            defaultValue={paraTexto(configuracaoAtual.rateioGeicePadrao)}
            required
            className={CLASSE_CAMPO}
          />
        </Campo>
        <Campo
          label="% Gabrielle"
          htmlFor="rateioGabrielle"
          erro={estado.errosPorCampo.rateio_gabrielle}
        >
          <input
            name="rateioGabrielle"
            id="rateioGabrielle"
            inputMode="decimal"
            defaultValue={paraTexto(configuracaoAtual.rateioGabriellePadrao)}
            required
            className={CLASSE_CAMPO}
          />
        </Campo>
      </div>
      <Campo label="Observação" htmlFor="observacao">
        <textarea name="observacao" id="observacao" rows={3} className={CLASSE_CAMPO} />
      </Campo>
      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button
        type="submit"
        disabled={emAndamento}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Cadastrar OS
      </button>
    </form>
  );
}
