import Link from 'next/link';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoValor } from '@/componentes/CartaoValor';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { GraficoBarras } from '@/componentes/GraficoBarras';
import { Moeda } from '@/componentes/Moeda';
import type { PontoMensal, ResumoComissoes } from '@/dominio/painel';
import type { PorPessoa } from '@/dominio/rateio';
import { DIAS_PARA_ALERTA, type ResumoLotes } from '@/servidor/painel/consultas';

export function PainelAdmin({
  resumo,
  serie,
  rateio,
  lotes,
}: {
  resumo: ResumoComissoes;
  serie: PontoMensal[];
  rateio: PorPessoa;
  lotes: ResumoLotes;
}) {
  const melhor = serie.reduce((acc, p) => (p.valor > acc.valor ? p : acc), serie[0]);

  return (
    <main>
      <h1 className="mb-5 text-[1.375rem] font-bold tracking-tight md:text-2xl">Início</h1>

      <div className="mb-3 grid gap-3 md:grid-cols-[1.25fr_1fr_1fr]">
        <CartaoValor
          rotulo="Pronto para enviar ao financeiro"
          valor={resumo.disponivel}
          destaque
          detalhe={
            resumo.quantidadeComDisponivel === 0
              ? 'nenhuma OS tem comissão liberada no momento'
              : `espalhado em ${resumo.quantidadeComDisponivel} OS com pagamento de cliente já recebido`
          }
        >
          {resumo.disponivel > 0n && (
            <div className="mt-4">
              <BotaoLink href="/lotes/gerar">Gerar lote agora</BotaoLink>
            </div>
          )}
        </CartaoValor>

        <CartaoValor
          rotulo="Aguardando conferência"
          valor={lotes.aguardandoConferencia.total}
          detalhe={`${lotes.aguardandoConferencia.quantidade} ${
            lotes.aguardandoConferencia.quantidade === 1 ? 'lote enviado' : 'lotes enviados'
          }, ainda não aprovados`}
        />
        <CartaoValor
          rotulo="Aprovado pelo financeiro"
          valor={lotes.aprovado.total}
          detalhe={`${lotes.aprovado.quantidade} ${
            lotes.aprovado.quantidade === 1 ? 'lote conferido' : 'lotes conferidos'
          }`}
        />
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-[1.55fr_1fr]">
        <section className="rounded-xl border border-borda bg-superficie p-4">
          <h2 className="mb-3.5 text-sm font-semibold">Comissão gerada por mês</h2>
          <GraficoBarras
            pontos={serie.map((p) => ({ rotulo: p.rotulo, valor: p.valor }))}
            descricao="Comissão total das OS por mês de venda, nos últimos doze meses."
          />
          {melhor && melhor.valor > 0n && (
            <p className="mt-3 text-[12.5px] text-texto-2">
              Melhor mês do período: {melhor.rotulo} · <Moeda valor={melhor.valor} />
            </p>
          )}
        </section>

        <section className="rounded-xl border border-borda bg-superficie p-4">
          <h2 className="mb-3.5 text-sm font-semibold">Lotes na mesa do financeiro</h2>
          {lotes.pendentes.length === 0 ? (
            <p className="text-[13px] text-texto-2">
              Nada pendente de conferência no momento.
            </p>
          ) : (
            <ul>
              {lotes.pendentes.map((lote) => (
                <li
                  key={lote.id}
                  className="flex items-center justify-between gap-3 border-b border-borda py-2.5 last:border-b-0"
                >
                  <span>
                    <Link href={`/lotes/${lote.id}`} className="num text-[15px] font-bold underline">
                      Lote {lote.numero}
                    </Link>
                    <span
                      className={`block text-[12px] ${
                        lote.dias > DIAS_PARA_ALERTA ? 'font-semibold text-erro' : 'text-texto-2'
                      }`}
                    >
                      {lote.dias > DIAS_PARA_ALERTA
                        ? `parado há ${lote.dias} dias`
                        : `enviado há ${lote.dias} ${lote.dias === 1 ? 'dia' : 'dias'}`}
                    </span>
                  </span>
                  <Moeda valor={lote.valorTotal} className="font-bold" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mb-3 rounded-xl border border-borda bg-superficie p-4">
        <div className="mb-3 border-l-2 border-destaque pl-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-destaque">
            Visível só para você
          </p>
          <h2 className="mt-1 text-sm font-semibold">Como o disponível se divide hoje</h2>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { nome: 'Thiago', valor: rateio.thiago },
            { nome: 'Geice', valor: rateio.geice },
            { nome: 'Gabrielle', valor: rateio.gabrielle },
          ].map((pessoa) => (
            <div key={pessoa.nome} className="rounded-lg bg-superficie-2 px-3 py-2.5">
              <p className="text-[12px] text-texto-2">{pessoa.nome}</p>
              <Moeda valor={pessoa.valor} className="block text-[17px] font-bold" />
            </div>
          ))}
        </div>
      </section>

      {/* Espaço já desenhado para a próxima fase: quando os dados existirem, é só preencher. */}
      <section className="rounded-xl border border-dashed border-borda-forte p-4 opacity-75">
        <p className="mb-3 inline-block rounded-full border border-borda px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rotulo">
          Entra na próxima fase
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="rotulo">Efetivamente recebido do financeiro</p>
            <p className="num mt-1.5 text-[1.5rem] font-bold text-rotulo">— — —</p>
            <p className="text-[12px] text-texto-2">
              depende do registro de recebimento, que ainda não existe
            </p>
          </div>
          <div>
            <p className="rotulo">A pagar às vendedoras</p>
            <p className="num mt-1.5 text-[1.5rem] font-bold text-rotulo">— — —</p>
            <p className="text-[12px] text-texto-2">
              depende do recebimento e do registro de pagamento
            </p>
          </div>
        </div>
      </section>

      {resumo.disponivel === 0n && lotes.pendentes.length === 0 && (
        <div className="mt-3">
          <EstadoVazio
            titulo="Nada a enviar no momento"
            descricao="A comissão libera na proporção do que o cliente já pagou. Registre um pagamento para liberar comissão."
            acao={<BotaoLink href="/os" variante="secundario">Ver ordens de serviço</BotaoLink>}
          />
        </div>
      )}
    </main>
  );
}
