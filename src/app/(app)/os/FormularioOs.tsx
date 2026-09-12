'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { Campo, CampoTexto, CLASSE_ENTRADA } from '@/componentes/Campo';
import { CampoMoeda, CampoPercentual } from '@/componentes/CampoMoeda';
import { formatarPercentual, type Percentual } from '@/dominio/dinheiro';
import { cadastrarOsAction } from '@/servidor/os/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

function paraTexto(percentual: Percentual): string {
  return formatarPercentual(percentual).replace('%', '');
}

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
      <CampoTexto
        nome="numeroOs"
        id="numeroOs"
        rotulo="Número da OS"
        required
        erro={estado.errosPorCampo.numeroOs}
      />
      <CampoTexto
        nome="cliente"
        id="cliente"
        rotulo="Cliente"
        required
        erro={estado.errosPorCampo.cliente}
      />
      <CampoTexto
        nome="produto"
        id="produto"
        rotulo="Produto"
        required
        erro={estado.errosPorCampo.produto}
      />
      <CampoTexto
        nome="tipoPagamento"
        id="tipoPagamento"
        rotulo="Tipo de pagamento"
        required
        erro={estado.errosPorCampo.tipoPagamento}
      />
      <CampoMoeda
        nome="valor"
        id="valor"
        rotulo="Valor da OS"
        obrigatorio
        erro={estado.errosPorCampo.valor}
      />
      <Campo rotulo="Data da venda" htmlFor="dataVenda" erro={estado.errosPorCampo.dataVenda}>
        <input
          type="date"
          name="dataVenda"
          id="dataVenda"
          defaultValue={dataPadrao}
          required
          className={`num ${CLASSE_ENTRADA}`}
        />
      </Campo>
      <CampoPercentual
        nome="percentualComissao"
        id="percentualComissao"
        rotulo="% de comissão total"
        valorInicial={paraTexto(configuracaoAtual.percentualComissaoPadrao)}
        obrigatorio
        erro={estado.errosPorCampo.percentualComissao}
      />

      <fieldset className="rounded-xl border border-borda bg-superficie p-4">
        <legend className="rotulo px-1">Rateio · precisa somar o percentual total</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoPercentual
            nome="rateioThiago"
            id="rateioThiago"
            rotulo="Thiago"
            valorInicial={paraTexto(configuracaoAtual.rateioThiagoPadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_thiago}
          />
          <CampoPercentual
            nome="rateioGeice"
            id="rateioGeice"
            rotulo="Geice"
            valorInicial={paraTexto(configuracaoAtual.rateioGeicePadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_geice}
          />
          <CampoPercentual
            nome="rateioGabrielle"
            id="rateioGabrielle"
            rotulo="Gabrielle"
            valorInicial={paraTexto(configuracaoAtual.rateioGabriellePadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_gabrielle}
          />
        </div>
      </fieldset>

      <Campo rotulo="Observação" htmlFor="observacao">
        <textarea name="observacao" id="observacao" rows={3} className={CLASSE_ENTRADA} />
      </Campo>

      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal className="sm:w-fit">
        Cadastrar OS
      </Botao>
    </form>
  );
}
