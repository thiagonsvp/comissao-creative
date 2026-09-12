import Link from 'next/link';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoLista } from '@/componentes/CartaoLista';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeEstadoLote } from '@/componentes/Selo';
import { formatarDataBr } from '@/dominio/datas';
import { sessaoDaPagina } from '@/servidor/auth';
import { listarLotes } from '@/servidor/lotes/consultas';

export default async function PaginaListaLotes() {
  const sessao = await sessaoDaPagina();
  const lotes = await listarLotes();
  const ehAdmin = sessao.papel === 'admin';

  return (
    <main>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">
          Lotes enviados ao financeiro
        </h1>
        {ehAdmin && <BotaoLink href="/lotes/gerar">Gerar novo lote</BotaoLink>}
      </div>

      {lotes.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum lote gerado ainda"
          descricao="Um lote reúne as comissões já liberadas por pagamento de cliente e é o documento que vai para o financeiro."
          acao={ehAdmin ? <BotaoLink href="/lotes/gerar">Gerar o primeiro lote</BotaoLink> : undefined}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2.5 md:hidden">
            {lotes.map((lote) => (
              <li key={lote.id}>
                <CartaoLista
                  href={`/lotes/${lote.id}`}
                  titulo={`Lote ${lote.numero}`}
                  selo={seloDeEstadoLote(lote.estadoConferencia)}
                  descricao={
                    lote.dataAprovacao
                      ? `Aprovado em ${formatarDataBr(lote.dataAprovacao)}`
                      : lote.dataEnvio
                        ? `Enviado em ${formatarDataBr(lote.dataEnvio)}`
                        : 'Sem data de envio'
                  }
                  rotuloValor="Total"
                  valor={lote.valorTotal}
                />
              </li>
            ))}
          </ul>

          <table className="tabela hidden md:table">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Data de envio</th>
                <th scope="col">Data de aprovação</th>
                <th scope="col" className="direita">Total</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((lote) => (
                <tr key={lote.id}>
                  <td>
                    <Link href={`/lotes/${lote.id}`} className="num font-bold text-destaque underline">
                      Lote {lote.numero}
                    </Link>
                  </td>
                  <td className="num">
                    {lote.dataEnvio ? formatarDataBr(lote.dataEnvio) : '—'}
                  </td>
                  <td className="num">
                    {lote.dataAprovacao ? formatarDataBr(lote.dataAprovacao) : '—'}
                  </td>
                  <td className="direita font-semibold">
                    <Moeda valor={lote.valorTotal} />
                  </td>
                  <td>
                    <Selo tom={seloDeEstadoLote(lote.estadoConferencia).tom}>
                      {seloDeEstadoLote(lote.estadoConferencia).rotulo}
                    </Selo>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
