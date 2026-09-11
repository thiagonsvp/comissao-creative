'use client';

import { useActionState } from 'react';
import { formatarBRL, type Centavos } from '@/dominio/dinheiro';
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
  const total = osElegiveis.reduce((acc, os) => acc + os.comissaoDisponivel, 0n);

  if (osElegiveis.length === 0) {
    return <p className="text-gray-500">Nenhuma OS com comissão disponível para envio.</p>;
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <table className="w-full max-w-2xl text-sm">
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2">
              <span className="sr-only">Selecionar</span>
            </th>
            <th scope="col">Número</th>
            <th scope="col">Cliente</th>
            <th scope="col">Comissão disponível</th>
          </tr>
        </thead>
        <tbody>
          {osElegiveis.map((os) => (
            <tr key={os.id} className="border-b">
              <td className="py-2">
                <input
                  type="checkbox"
                  name="osIds"
                  value={os.id}
                  defaultChecked
                  aria-label={`Incluir OS ${os.numeroOs}`}
                />
              </td>
              <td>{os.numeroOs}</td>
              <td>{os.cliente}</td>
              <td>{formatarBRL(os.comissaoDisponivel)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="font-medium">
        Total de todas as OS elegíveis: {formatarBRL(total)}
      </p>
      <p className="max-w-2xl text-sm text-gray-500">
        Este total é o da abertura da página. O valor gravado é sempre recalculado no
        servidor, dentro da transação, no momento da confirmação.
      </p>

      <label className="flex max-w-md flex-col gap-1 text-sm">
        Observação (opcional)
        <input name="observacao" className="rounded border px-3 py-2" />
      </label>

      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button
        type="submit"
        disabled={emAndamento}
        className="w-fit rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Confirmar envio ao financeiro
      </button>
    </form>
  );
}
