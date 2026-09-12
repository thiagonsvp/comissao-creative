import Link from 'next/link';
import { notFound } from 'next/navigation';
import { paraDecimalDb } from '@/dominio/dinheiro';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterOsPorId } from '@/servidor/os/consultas';
import { situacaoDaOs } from '@/servidor/os/travas';
import { FormularioEditarOs } from './FormularioEditarOs';

export default async function PaginaEditarOs({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await sessaoDaPagina('admin');
  const { id } = await params;
  const os = await obterOsPorId(id, true);
  const situacao = await situacaoDaOs(id);
  if (!os || !os.rateio || !situacao) notFound();

  return (
    <main>
      <h1 className="mb-1 text-[1.375rem] font-bold tracking-tight md:text-2xl">
        Editar OS <span className="num text-destaque">{os.numeroOs}</span>
      </h1>
      <p className="mb-6 max-w-xl text-[13.5px] text-texto-2">
        Correções ficam registradas na auditoria com o valor antigo e o novo. Os lotes
        já emitidos não mudam — eles guardam a própria cópia dos dados.
      </p>

      <FormularioEditarOs
        osId={os.id}
        comprometido={situacao.comprometido}
        numerosDeLote={situacao.lotes.map((l) => l.numero)}
        iniciais={{
          numeroOs: os.numeroOs,
          cliente: os.cliente,
          produto: os.produto,
          tipoPagamento: os.tipoPagamento,
          dataVenda: os.dataVenda,
          observacao: os.observacao ?? '',
          valor: paraDecimalDb(os.valor).replace('.', ','),
          percentualComissao: os.percentualComissao,
          rateio: os.rateio,
        }}
      />

      <p className="mt-8">
        <Link href={`/os/${os.id}`} className="text-[13px] text-texto-2 underline">
          ← Voltar sem salvar
        </Link>
      </p>
    </main>
  );
}
