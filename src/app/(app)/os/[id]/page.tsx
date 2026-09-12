import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarraEmpilhada } from '@/componentes/BarraEmpilhada';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoValor } from '@/componentes/CartaoValor';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeStatusOs } from '@/componentes/Selo';
import { formatarDataBr, hojeNegocio } from '@/dominio/datas';
import { formatarPercentual, paraDecimalDb } from '@/dominio/dinheiro';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterOsPorId } from '@/servidor/os/consultas';
import { EstornarBaixa } from './EstornarBaixa';

export default async function PaginaDetalheOs({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await sessaoDaPagina();
  const { id } = await params;
  const ehAdmin = sessao.papel === 'admin';
  const os = await obterOsPorId(id, ehAdmin);
  if (!os) notFound();

  const comprometida = os.comissaoLiberada - os.comissaoDisponivel;
  const presa = os.comissaoTotal - os.comissaoLiberada;
  const selo = seloDeStatusOs(os.status);
  const saldo = os.valor - os.totalPagoCliente;

  return (
    <main>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">
              OS <span className="num text-destaque">{os.numeroOs}</span>
            </h1>
            <Selo tom={selo.tom}>{selo.rotulo}</Selo>
          </div>
          <p className="mt-1 text-[13.5px] text-texto-2">
            {os.cliente} · {os.produto} · venda em {formatarDataBr(os.dataVenda)}
          </p>
        </div>
        {ehAdmin && (
          <div className="flex flex-wrap gap-2">
            <BotaoLink href={`/os/${os.id}/editar`} variante="secundario">
              Editar
            </BotaoLink>
            <BotaoLink href={`/os/${os.id}/baixas/nova`}>Registrar pagamento</BotaoLink>
          </div>
        )}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <CartaoValor
          rotulo="Valor da OS"
          valor={os.valor}
          detalhe={`comissão de ${formatarPercentual(os.percentualComissao)} · ${os.tipoPagamento}`}
        />
        <CartaoValor
          rotulo="Pago pelo cliente"
          valor={os.totalPagoCliente}
          detalhe={saldo > 0n ? 'ainda falta receber o saldo abaixo' : 'cliente quitou a OS'}
        >
          {saldo > 0n && (
            <p className="mt-1.5 text-[12.5px] text-texto-2">
              Saldo a receber: <Moeda valor={saldo} />
            </p>
          )}
        </CartaoValor>
        <CartaoValor
          rotulo="Disponível para lote"
          valor={os.comissaoDisponivel}
          destaque
          detalhe={comprometida > 0n ? 'o restante já foi enviado em lote' : 'nada comprometido ainda'}
        />
      </div>

      <section className="mb-4 rounded-xl border border-borda bg-superficie p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Comissão</h2>
          <span className="text-[12px] text-texto-2">
            total de <Moeda valor={os.comissaoTotal} />
          </span>
        </div>
        <BarraEmpilhada
          segmentos={[
            { rotulo: 'Liberada e disponível', valor: os.comissaoDisponivel, tom: 'destaque' },
            { rotulo: 'Já enviada em lote', valor: comprometida, tom: 'sucesso' },
            { rotulo: 'Presa ao que o cliente não pagou', valor: presa, tom: 'neutro' },
          ]}
        />
      </section>

      <section className="mb-4 rounded-xl border border-borda bg-superficie p-4">
        <h2 className="mb-3 text-sm font-semibold">Pagamentos do cliente</h2>
        {os.baixas.length === 0 ? (
          <p className="text-[13.5px] text-texto-2">
            Nenhum pagamento registrado ainda. Enquanto o cliente não pagar, nenhuma
            comissão é liberada.
          </p>
        ) : (
          <ul>
            {os.baixas.map((baixa) => {
              const ehEstorno = baixa.tipo === 'estorno';
              const saldo = baixa.valor - baixa.estornado;
              return (
                <li key={baixa.id} className="border-b border-borda py-3 last:border-b-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13.5px]">
                    <span className="num">
                      {formatarDataBr(baixa.data)}
                      {ehEstorno && <span className="ml-2 text-erro">estorno</span>}
                    </span>
                    <span className={ehEstorno ? 'text-erro' : ''}>
                      {ehEstorno && '− '}
                      <Moeda valor={baixa.valor} className="font-medium" />
                    </span>
                  </div>
                  {baixa.motivo && (
                    <p className="mt-1 text-[12.5px] text-texto-2">{baixa.motivo}</p>
                  )}
                  {!ehEstorno && baixa.estornado > 0n && (
                    <p className="mt-1 text-[12.5px] text-texto-2">
                      Estornado: <Moeda valor={baixa.estornado} />
                    </p>
                  )}
                  {ehAdmin && !ehEstorno && saldo > 0n && (
                    <EstornarBaixa
                      osId={os.id}
                      baixaId={baixa.id}
                      saldoEstornavel={paraDecimalDb(saldo).replace('.', ',')}
                      dataPadrao={hojeNegocio()}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {os.rateio && (
        <section className="mb-4 border-l-2 border-destaque pl-3.5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-destaque">
            Visível só para admin
          </p>
          <h2 className="mb-3 text-sm font-semibold">Rateio da comissão</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { nome: 'Thiago', peso: os.rateio.thiago },
              { nome: 'Geice', peso: os.rateio.geice },
              { nome: 'Gabrielle', peso: os.rateio.gabrielle },
            ].map((pessoa) => (
              <div key={pessoa.nome} className="rounded-lg bg-superficie-2 px-3 py-2.5">
                <p className="text-[12px] text-texto-2">{pessoa.nome}</p>
                <p className="num text-[15px] font-bold">{formatarPercentual(pessoa.peso)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link href="/os" className="text-[13px] text-texto-2 underline">
        ← Voltar para a lista
      </Link>
    </main>
  );
}
