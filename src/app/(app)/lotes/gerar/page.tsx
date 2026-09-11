import Link from 'next/link';
import { sessaoDaPagina } from '@/servidor/auth';
import { listarOsComComissaoDisponivel } from '@/servidor/os/consultas';
import { FormularioGerarLote } from './FormularioGerarLote';

export default async function PaginaGerarLote() {
  await sessaoDaPagina('admin');
  const osElegiveis = await listarOsComComissaoDisponivel();

  return (
    <main>
      <h1 className="mb-1 text-[1.375rem] font-bold tracking-tight md:text-2xl">
        Gerar relatório para o financeiro
      </h1>
      <p className="mb-6 max-w-xl text-[13.5px] text-texto-2">
        Confira o que entra. O total abaixo é o da abertura da página; o valor gravado é
        sempre recalculado no servidor, dentro da transação, no momento da confirmação.
      </p>
      <FormularioGerarLote osElegiveis={osElegiveis} />
      <p className="mt-8">
        <Link href="/lotes" className="text-[13px] text-texto-2 underline">
          ← Voltar para os lotes
        </Link>
      </p>
    </main>
  );
}
