import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hojeNegocio } from '@/dominio/datas';
import { formatarBRL } from '@/dominio/dinheiro';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterOsPorId } from '@/servidor/os/consultas';
import { FormularioBaixa } from './FormularioBaixa';

export default async function PaginaNovaBaixa({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await sessaoDaPagina('admin');
  const { id } = await params;
  const os = await obterOsPorId(id, false);
  if (!os) notFound();

  const saldo = os.valor - os.totalPagoCliente;

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">
        Registrar pagamento — OS {os.numeroOs}
      </h1>
      <p className="mb-4 text-sm text-gray-600">
        Valor da OS {formatarBRL(os.valor)} · já pago {formatarBRL(os.totalPagoCliente)} ·
        saldo a receber <strong>{formatarBRL(saldo)}</strong>
      </p>
      <FormularioBaixa osId={os.id} dataPadrao={hojeNegocio()} />
      <p className="mt-6">
        <Link href={`/os/${os.id}`} className="text-sm text-blue-600 underline">
          ← Voltar para a OS
        </Link>
      </p>
    </main>
  );
}
