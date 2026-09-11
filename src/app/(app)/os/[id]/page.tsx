import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatarDataBr } from '@/dominio/datas';
import { formatarBRL, formatarPercentual } from '@/dominio/dinheiro';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterOsPorId } from '@/servidor/os/consultas';

export default async function PaginaDetalheOs({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await sessaoDaPagina();
  const { id } = await params;
  const os = await obterOsPorId(id, sessao.papel === 'admin');
  if (!os) notFound();

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">OS {os.numeroOs}</h1>
      <p className="mb-4 text-gray-600">
        {os.cliente} — {os.produto}
      </p>

      <dl className="mb-6 grid max-w-md grid-cols-2 gap-y-2 text-sm">
        <dt className="text-gray-500">Valor</dt>
        <dd>{formatarBRL(os.valor)}</dd>
        <dt className="text-gray-500">Tipo de pagamento</dt>
        <dd>{os.tipoPagamento}</dd>
        <dt className="text-gray-500">Data da venda</dt>
        <dd>{formatarDataBr(os.dataVenda)}</dd>
        <dt className="text-gray-500">% comissão</dt>
        <dd>{formatarPercentual(os.percentualComissao)}</dd>
        <dt className="text-gray-500">Total pago pelo cliente</dt>
        <dd>{formatarBRL(os.totalPagoCliente)}</dd>
        <dt className="text-gray-500">Comissão total</dt>
        <dd>{formatarBRL(os.comissaoTotal)}</dd>
        <dt className="text-gray-500">Comissão liberada</dt>
        <dd>{formatarBRL(os.comissaoLiberada)}</dd>
        <dt className="text-gray-500">Comissão disponível p/ lote</dt>
        <dd>{formatarBRL(os.comissaoDisponivel)}</dd>
        {os.rateio && (
          <>
            <dt className="text-gray-500">Rateio</dt>
            <dd>
              Thiago {formatarPercentual(os.rateio.thiago)} / Geice{' '}
              {formatarPercentual(os.rateio.geice)} / Gabrielle{' '}
              {formatarPercentual(os.rateio.gabrielle)}
            </dd>
          </>
        )}
      </dl>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Pagamentos do cliente</h2>
          {sessao.papel === 'admin' && (
            <Link
              href={`/os/${os.id}/baixas/nova`}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              Registrar pagamento
            </Link>
          )}
        </div>
        <ul className="text-sm">
          {os.baixas.map((baixa) => (
            <li key={baixa.id} className="border-b py-1">
              {formatarDataBr(baixa.data)} — {formatarBRL(baixa.valor)}
            </li>
          ))}
          {os.baixas.length === 0 && (
            <li className="text-gray-500">Nenhum pagamento registrado ainda.</li>
          )}
        </ul>
      </section>

      <Link href="/os" className="text-sm text-blue-600 underline">
        ← Voltar para a lista
      </Link>
    </main>
  );
}
