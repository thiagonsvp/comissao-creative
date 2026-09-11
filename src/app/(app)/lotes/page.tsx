import Link from 'next/link';
import { formatarDataBr } from '@/dominio/datas';
import { formatarBRL } from '@/dominio/dinheiro';
import { sessaoDaPagina } from '@/servidor/auth';
import { listarLotes } from '@/servidor/lotes/consultas';
import { RUBRICA_ESTADO } from './rubricas';

export default async function PaginaListaLotes() {
  const sessao = await sessaoDaPagina();
  const lotes = await listarLotes();

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lotes enviados ao financeiro</h1>
        {sessao.papel === 'admin' && (
          <Link href="/lotes/gerar" className="rounded bg-blue-600 px-4 py-2 text-white">
            Gerar novo lote
          </Link>
        )}
      </div>

      {lotes.length === 0 ? (
        <p className="mt-4 text-gray-500">Nenhum lote gerado ainda.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2">
                Número
              </th>
              <th scope="col">Data de envio</th>
              <th scope="col">Total</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((lote) => (
              <tr key={lote.id} className="border-b">
                <td className="py-2">
                  <Link href={`/lotes/${lote.id}`} className="text-blue-600 underline">
                    Lote {lote.numero}
                  </Link>
                </td>
                <td>{lote.dataEnvio ? formatarDataBr(lote.dataEnvio) : '—'}</td>
                <td>{formatarBRL(lote.valorTotal)}</td>
                <td>{RUBRICA_ESTADO[lote.estadoConferencia] ?? lote.estadoConferencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
