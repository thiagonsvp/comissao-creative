'use client';

import { formatarDataBr } from '@/dominio/datas';
import { formatarBRL } from '@/dominio/dinheiro';
import type { LoteDetalhe } from '@/servidor/lotes/consultas';

const ESTILO_IMPRESSAO = '@media print { @page { size: A4; margin: 2cm; } }';

export function ConteudoImpressao({ lote }: { lote: LoteDetalhe }) {
  return (
    <main className="mx-auto max-w-3xl p-8 print:p-0">
      <style>{ESTILO_IMPRESSAO}</style>
      <h1 className="mb-1 text-lg font-semibold">
        Relatório de comissão — Lote {lote.numero}
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Enviado em {lote.dataEnvio ? formatarDataBr(lote.dataEnvio) : '—'}
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th scope="col" className="py-2">
              OS
            </th>
            <th scope="col">Cliente</th>
            <th scope="col">Produto</th>
            <th scope="col" className="text-right">
              Comissão
            </th>
          </tr>
        </thead>
        <tbody>
          {lote.itens.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-1">{item.numeroOsSnapshot}</td>
              <td>{item.clienteSnapshot}</td>
              <td>{item.produtoSnapshot}</td>
              <td className="text-right">{formatarBRL(item.valorComissao)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-semibold">
            <td className="py-2" colSpan={3}>
              Total
            </td>
            <td className="text-right">{formatarBRL(lote.valorTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <button
        type="button"
        onClick={() => window.print()}
        className="mt-6 rounded bg-blue-600 px-4 py-2 text-white print:hidden"
      >
        Imprimir / salvar PDF
      </button>
    </main>
  );
}
