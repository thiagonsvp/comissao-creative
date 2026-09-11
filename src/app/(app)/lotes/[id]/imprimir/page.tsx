import { notFound } from 'next/navigation';
import { exigirSessao } from '@/servidor/auth';
import { obterLotePorId } from '@/servidor/lotes/consultas';
import { ConteudoImpressao } from './ConteudoImpressao';

export default async function PaginaImprimirLote({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirSessao();
  const { id } = await params;
  // Sempre `false`: o documento do financeiro nunca carrega nem renderiza
  // rateio, nem quando quem abre é admin.
  const lote = await obterLotePorId(id, false);
  if (!lote) notFound();

  return <ConteudoImpressao lote={lote} />;
}
