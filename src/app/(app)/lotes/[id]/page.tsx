import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatarDataBr } from '@/dominio/datas';
import { formatarBRL } from '@/dominio/dinheiro';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterLotePorId } from '@/servidor/lotes/consultas';
import { RUBRICA_ESTADO } from '../rubricas';
import { AcoesLote } from './AcoesLote';

export default async function PaginaDetalheLote({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await sessaoDaPagina();
  const { id } = await params;
  const ehAdmin = sessao.papel === 'admin';
  const lote = await obterLotePorId(id, ehAdmin);
  if (!lote) notFound();

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Lote {lote.numero} —{' '}
          {RUBRICA_ESTADO[lote.estadoConferencia] ?? lote.estadoConferencia}
        </h1>
        <Link
          href={`/lotes/${lote.id}/imprimir`}
          target="_blank"
          className="rounded border px-4 py-2"
        >
          Ver relatório para impressão
        </Link>
      </div>

      <p className="mb-4">
        Total: <strong>{formatarBRL(lote.valorTotal)}</strong> — Enviado em{' '}
        {lote.dataEnvio ? formatarDataBr(lote.dataEnvio) : '—'}
      </p>
      {lote.observacao && <p className="mb-4 text-sm text-gray-600">{lote.observacao}</p>}

      {ehAdmin && (
        <div className="mb-6">
          <AcoesLote loteId={lote.id} estadoConferencia={lote.estadoConferencia} />
        </div>
      )}

      <table className="w-full max-w-3xl text-sm">
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2">
              OS
            </th>
            <th scope="col">Cliente</th>
            <th scope="col">Produto</th>
            <th scope="col">Comissão do trecho</th>
            {ehAdmin && <th scope="col">Thiago / Geice / Gabrielle</th>}
          </tr>
        </thead>
        <tbody>
          {lote.itens.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2">{item.numeroOsSnapshot}</td>
              <td>{item.clienteSnapshot}</td>
              <td>{item.produtoSnapshot}</td>
              <td>{formatarBRL(item.valorComissao)}</td>
              {ehAdmin && (
                <td>
                  {item.rateio
                    ? [item.rateio.thiago, item.rateio.geice, item.rateio.gabrielle]
                        .map(formatarBRL)
                        .join(' / ')
                    : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6">
        <Link href="/lotes" className="text-sm text-blue-600 underline">
          ← Voltar para os lotes
        </Link>
      </p>
    </main>
  );
}
