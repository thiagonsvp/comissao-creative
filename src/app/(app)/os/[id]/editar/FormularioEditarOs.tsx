'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { Campo, CampoTexto, CLASSE_ENTRADA } from '@/componentes/Campo';
import { CampoMoeda, CampoPercentual } from '@/componentes/CampoMoeda';
import { Moeda } from '@/componentes/Moeda';
import { formatarPercentual, type Centavos, type Percentual } from '@/dominio/dinheiro';
import { editarOsAction } from '@/servidor/os/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

function paraTexto(percentual: Percentual): string {
  return formatarPercentual(percentual).replace('%', '');
}

export interface ValoresIniciaisOs {
  numeroOs: string;
  cliente: string;
  produto: string;
  tipoPagamento: string;
  dataVenda: string;
  observacao: string;
  valor: string;
  percentualComissao: Percentual;
  rateio: { thiago: Percentual; geice: Percentual; gabrielle: Percentual };
}

export function FormularioEditarOs({
  osId,
  iniciais,
  comprometido,
  numerosDeLote,
}: {
  osId: string;
  iniciais: ValoresIniciaisOs;
  comprometido: Centavos;
  numerosDeLote: number[];
}) {
  const [estado, acao, emAndamento] = useActionState(
    editarOsAction,
    ESTADO_INICIAL_FORMULARIO,
  );
  const travado = comprometido > 0n;

  return (
    <form action={acao} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="osId" value={osId} />

      {travado && (
        <p className="rounded-xl border border-destaque bg-destaque-suave p-3.5 text-[13px] text-texto">
          <strong>
            <Moeda valor={comprometido} />
          </strong>{' '}
          desta OS já estão reservados{' '}
          {numerosDeLote.length === 1
            ? `no lote ${numerosDeLote[0]}`
            : `nos lotes ${numerosDeLote.join(', ')}`}
          . Você pode aumentar o valor, mas não reduzi-lo abaixo do necessário para
          cobrir essa reserva — o percentual de comissão e o rateio só mudam depois
          de cancelar o lote.
        </p>
      )}

      <CampoTexto
        nome="numeroOs"
        id="numeroOs"
        rotulo="Número da OS"
        defaultValue={iniciais.numeroOs}
        required
        erro={estado.errosPorCampo.numeroOs}
      />
      <CampoTexto
        nome="cliente"
        id="cliente"
        rotulo="Cliente"
        defaultValue={iniciais.cliente}
        required
        erro={estado.errosPorCampo.cliente}
      />
      <CampoTexto
        nome="produto"
        id="produto"
        rotulo="Produto"
        defaultValue={iniciais.produto}
        required
        erro={estado.errosPorCampo.produto}
      />
      <CampoTexto
        nome="tipoPagamento"
        id="tipoPagamento"
        rotulo="Tipo de pagamento"
        defaultValue={iniciais.tipoPagamento}
        required
        erro={estado.errosPorCampo.tipoPagamento}
      />
      <CampoMoeda
        nome="valor"
        id="valor"
        rotulo="Valor da OS"
        valorInicial={iniciais.valor}
        obrigatorio
        erro={estado.errosPorCampo.valor}
      />
      <Campo rotulo="Data da venda" htmlFor="dataVenda" erro={estado.errosPorCampo.dataVenda}>
        <input
          type="date"
          name="dataVenda"
          id="dataVenda"
          defaultValue={iniciais.dataVenda}
          required
          className={`num ${CLASSE_ENTRADA}`}
        />
      </Campo>
      {travado && (
        <>
          <input
            type="hidden"
            name="percentualComissao"
            value={paraTexto(iniciais.percentualComissao)}
          />
          <input type="hidden" name="rateioThiago" value={paraTexto(iniciais.rateio.thiago)} />
          <input type="hidden" name="rateioGeice" value={paraTexto(iniciais.rateio.geice)} />
          <input
            type="hidden"
            name="rateioGabrielle"
            value={paraTexto(iniciais.rateio.gabrielle)}
          />
        </>
      )}

      <fieldset
        disabled={travado}
        className={`rounded-xl border border-borda bg-superficie p-4 ${
          travado ? 'opacity-60' : ''
        }`}
      >
        <legend className="rotulo px-1">
          Percentual e rateio{' '}
          {travado
            ? '· travados por lote pendente'
            : '· o rateio precisa somar o percentual total'}
        </legend>
        <div className="mb-3">
          <CampoPercentual
            nome="percentualComissao"
            id="percentualComissao"
            rotulo="% de comissão total"
            valorInicial={paraTexto(iniciais.percentualComissao)}
            obrigatorio
            erro={estado.errosPorCampo.percentualComissao}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoPercentual
            nome="rateioThiago"
            id="rateioThiago"
            rotulo="Thiago"
            valorInicial={paraTexto(iniciais.rateio.thiago)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_thiago}
          />
          <CampoPercentual
            nome="rateioGeice"
            id="rateioGeice"
            rotulo="Geice"
            valorInicial={paraTexto(iniciais.rateio.geice)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_geice}
          />
          <CampoPercentual
            nome="rateioGabrielle"
            id="rateioGabrielle"
            rotulo="Gabrielle"
            valorInicial={paraTexto(iniciais.rateio.gabrielle)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_gabrielle}
          />
        </div>
      </fieldset>

      <Campo rotulo="Observação" htmlFor="observacao">
        <textarea
          name="observacao"
          id="observacao"
          rows={3}
          defaultValue={iniciais.observacao}
          className={CLASSE_ENTRADA}
        />
      </Campo>

      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal className="sm:w-fit">
        Salvar correção
      </Botao>
    </form>
  );
}
