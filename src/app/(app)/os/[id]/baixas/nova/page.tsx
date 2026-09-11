import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CartaoValor } from '@/componentes/CartaoValor';
import { hojeNegocio } from '@/dominio/datas';
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
    <main>
      <h1 className="mb-1 text-[1.375rem] font-bold tracking-tight md:text-2xl">
        Registrar pagamento
      </h1>
      <p className="mb-5 text-[13.5px] text-texto-2">
        OS <span className="num">{os.numeroOs}</span> · {os.cliente}
      </p>

      <div className="mb-6 max-w-sm">
        <CartaoValor
          rotulo="Saldo a receber"
          valor={saldo}
          destaque
          detalhe="o pagamento não pode ultrapassar este valor"
        />
      </div>

      <FormularioBaixa osId={os.id} dataPadrao={hojeNegocio()} />

      <p className="mt-8">
        <Link href={`/os/${os.id}`} className="text-[13px] text-texto-2 underline">
          ← Voltar para a OS
        </Link>
      </p>
    </main>
  );
}
