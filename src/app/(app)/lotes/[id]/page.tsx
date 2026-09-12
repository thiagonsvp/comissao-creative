import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoValor } from '@/componentes/CartaoValor';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeEstadoLote } from '@/componentes/Selo';
import { formatarDataBr } from '@/dominio/datas';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterLotePorId } from '@/servidor/lotes/consultas';
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

  const selo = seloDeEstadoLote(lote.estadoConferencia);

  return (
    <main>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">
              Lote <span className="num text-destaque">{lote.numero}</span>
            </h1>
            <Selo tom={selo.tom}>{selo.rotulo}</Selo>
          </div>
          <p className="mt-1 text-[13.5px] text-texto-2">
            {lote.dataEnvio ? `Enviado em ${formatarDataBr(lote.dataEnvio)}` : 'Sem data de envio'}
            {lote.observacao ? ` · ${lote.observacao}` : ''}
          </p>
        </div>
        <BotaoLink href={`/lotes/${lote.id}/imprimir`} target="_blank" variante="secundario">
          Ver relatório para impressão
        </BotaoLink>
      </div>

      <div className="mb-5 max-w-sm">
        <CartaoValor
          rotulo="Total do lote"
          valor={lote.valorTotal}
          destaque
          detalhe={`${lote.itens.length} ${lote.itens.length === 1 ? 'item' : 'itens'}`}
        />
      </div>

      {lote.motivoCancelamento && (
        <p className="mb-4 rounded-xl border border-erro bg-erro-suave p-3.5 text-[13px]">
          <strong>Lote cancelado.</strong> {lote.motivoCancelamento}
          {lote.loteSubstituto && (
            <>
              {' '}
              Substituído pelo{' '}
              <Link
                href={`/lotes/${lote.loteSubstituto.id}`}
                className="font-semibold underline"
              >
                lote {lote.loteSubstituto.numero}
              </Link>
              .
            </>
          )}
        </p>
      )}

      {lote.loteOrigem && (
        <p className="mb-4 text-[13px] text-texto-2">
          Substitui o{' '}
          <Link href={`/lotes/${lote.loteOrigem.id}`} className="underline">
            lote {lote.loteOrigem.numero}
          </Link>
          , que foi cancelado.
        </p>
      )}

      {ehAdmin && lote.estadoConferencia === 'cancelado' && !lote.loteSubstituto && (
        <div className="mb-6">
          <BotaoLink href={`/lotes/gerar?origem=${lote.id}`}>Gerar lote substituto</BotaoLink>
        </div>
      )}

      {ehAdmin && (
        <div className="mb-6">
          <AcoesLote loteId={lote.id} estadoConferencia={lote.estadoConferencia} />
        </div>
      )}

      {/* Celular */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {lote.itens.map((item) => (
          <li key={item.id} className="rounded-xl border border-borda bg-superficie p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="num text-sm font-bold">{item.numeroOsSnapshot}</span>
              <Moeda valor={item.valorComissao} className="text-[15px] font-bold text-destaque" />
            </div>
            <p className="mt-1 text-[13px] text-texto-2">
              {item.clienteSnapshot} · {item.produtoSnapshot}
            </p>
            {item.rateio && (
              <p className="num mt-2 border-t border-borda pt-2 text-[12px] text-texto-2">
                T <Moeda valor={item.rateio.thiago} /> · G <Moeda valor={item.rateio.geice} /> · Ga{' '}
                <Moeda valor={item.rateio.gabrielle} />
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Computador */}
      <table className="tabela hidden md:table">
        <thead>
          <tr>
            <th scope="col">OS</th>
            <th scope="col">Cliente</th>
            <th scope="col">Produto</th>
            <th scope="col" className="direita">Comissão do trecho</th>
            {ehAdmin && <th scope="col" className="direita">Thiago / Geice / Gabrielle</th>}
          </tr>
        </thead>
        <tbody>
          {lote.itens.map((item) => (
            <tr key={item.id}>
              <td className="num font-bold">{item.numeroOsSnapshot}</td>
              <td>{item.clienteSnapshot}</td>
              <td className="text-texto-2">{item.produtoSnapshot}</td>
              <td className="direita font-semibold">
                <Moeda valor={item.valorComissao} />
              </td>
              {ehAdmin && (
                <td className="direita text-[13px] text-texto-2">
                  {item.rateio ? (
                    <>
                      <Moeda valor={item.rateio.thiago} /> / <Moeda valor={item.rateio.geice} /> /{' '}
                      <Moeda valor={item.rateio.gabrielle} />
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6">
        <Link href="/lotes" className="text-[13px] text-texto-2 underline">
          ← Voltar para os lotes
        </Link>
      </p>
    </main>
  );
}
