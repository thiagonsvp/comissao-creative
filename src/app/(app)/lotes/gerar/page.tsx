import Link from 'next/link';
import { sessaoDaPagina } from '@/servidor/auth';
import { listarOsComComissaoDisponivel } from '@/servidor/os/consultas';
import { FormularioGerarLote } from './FormularioGerarLote';

export default async function PaginaGerarLote() {
  await sessaoDaPagina('admin');
  const osElegiveis = await listarOsComComissaoDisponivel();

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Gerar relatório para o financeiro</h1>
      <FormularioGerarLote osElegiveis={osElegiveis} />
      <p className="mt-6">
        <Link href="/lotes" className="text-sm text-blue-600 underline">
          ← Voltar para os lotes
        </Link>
      </p>
    </main>
  );
}
