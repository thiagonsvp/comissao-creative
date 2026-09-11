'use client';

import { useActionState, useState } from 'react';
import { Botao, BotaoLink } from '@/componentes/Botao';
import { Campo, CLASSE_ENTRADA } from '@/componentes/Campo';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { type Centavos } from '@/dominio/dinheiro';
import { gerarLoteAction } from '@/servidor/lotes/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

interface OsElegivel {
  id: string;
  numeroOs: string;
  cliente: string;
  comissaoDisponivel: Centavos;
}

export function FormularioGerarLote({ osElegiveis }: { osElegiveis: OsElegivel[] }) {
  const [estado, acao, emAndamento] = useActionState(
    gerarLoteAction,
    ESTADO_INICIAL_FORMULARIO,
  );
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    () => new Set(osElegiveis.map((os) => os.id)),
  );

  if (osElegiveis.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma OS com comissão disponível"
        descricao="A comissão só libera na proporção do que o cliente já pagou. Registre um pagamento para liberar comissão."
        acao={<BotaoLink href="/os" variante="secundario">Ver ordens de serviço</BotaoLink>}
      />
    );
  }

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const total = osElegiveis
    .filter((os) => selecionadas.has(os.id))
    .reduce((acc, os) => acc + os.comissaoDisponivel, 0n);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2.5">
        {osElegiveis.map((os) => {
          const marcada = selecionadas.has(os.id);
          return (
            <li key={os.id}>
              <label
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3.5 ${
                  marcada ? 'border-destaque bg-destaque-suave' : 'border-borda bg-superficie'
                }`}
              >
                <input
                  type="checkbox"
                  name="osIds"
                  value={os.id}
                  checked={marcada}
                  onChange={() => alternar(os.id)}
                  className="size-4 accent-[var(--cor-destaque)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="num block text-sm font-bold">{os.numeroOs}</span>
                  <span className="block truncate text-[13px] text-texto-2">{os.cliente}</span>
                </span>
                <Moeda valor={os.comissaoDisponivel} className="text-sm font-semibold" />
              </label>
            </li>
          );
        })}
      </ul>

      <Campo rotulo="Observação (opcional)" htmlFor="observacao">
        <input name="observacao" id="observacao" className={`${CLASSE_ENTRADA} md:max-w-md`} />
      </Campo>

      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}

      {/* Gruda no rodapé em listas longas: o botão nunca fica fora de alcance. */}
      <div className="sticky bottom-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda-forte bg-superficie p-3.5 shadow-lg md:bottom-4">
        <div>
          <p className="rotulo">
            {selecionadas.size} de {osElegiveis.length} selecionadas
          </p>
          <p className="num mt-1 text-[1.4rem] font-bold text-destaque">
            <Moeda valor={total} />
          </p>
        </div>
        <Botao type="submit" carregando={emAndamento} disabled={selecionadas.size === 0}>
          Confirmar envio
        </Botao>
      </div>
    </form>
  );
}
