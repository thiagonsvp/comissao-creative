import Link from 'next/link';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoValor } from '@/componentes/CartaoValor';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { DIAS_PARA_ALERTA, type ResumoLotes } from '@/servidor/painel/consultas';

export function PainelFinanceiro({ lotes }: { lotes: ResumoLotes }) {
  const maisAntigo = lotes.pendentes.reduce<(typeof lotes.pendentes)[number] | null>(
    (acc, lote) => (acc === null || lote.dias > acc.dias ? lote : acc),
    null,
  );

  return (
    <main>
      <h1 className="mb-5 text-[1.375rem] font-bold tracking-tight md:text-2xl">Início</h1>

      <div className="mb-3 grid gap-3 md:grid-cols-[1.25fr_1fr_1fr]">
        <CartaoValor
          rotulo="Esperando sua conferência"
          valor={lotes.aguardandoConferencia.total}
          destaque
          detalhe={`${lotes.aguardandoConferencia.quantidade} ${
            lotes.aguardandoConferencia.quantidade === 1
              ? 'lote recebido e ainda não aprovado'
              : 'lotes recebidos e ainda não aprovados'
          }`}
        >
          {lotes.pendentes.length > 0 && (
            <div className="mt-4">
              <BotaoLink href="/lotes">Ver lotes pendentes</BotaoLink>
            </div>
          )}
        </CartaoValor>

        <CartaoValor
          rotulo="Já aprovado por você"
          valor={lotes.aprovado.total}
          detalhe={`${lotes.aprovado.quantidade} ${
            lotes.aprovado.quantidade === 1 ? 'lote' : 'lotes'
          }`}
        />

        <div className="rounded-xl border border-borda bg-superficie p-4">
          <p className="rotulo">Lote mais antigo na fila</p>
          {maisAntigo ? (
            <>
              <p
                className={`num mt-2 text-[1.5rem] font-bold leading-none ${
                  maisAntigo.dias > DIAS_PARA_ALERTA ? 'text-erro' : ''
                }`}
              >
                {maisAntigo.dias} {maisAntigo.dias === 1 ? 'dia' : 'dias'}
              </p>
              <p className="mt-1.5 text-[12.5px] text-texto-2">
                Lote {maisAntigo.numero} · <Moeda valor={maisAntigo.valorTotal} />
              </p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-texto-2">Nenhum lote na fila.</p>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-borda bg-superficie p-4">
        <h2 className="mb-3.5 text-sm font-semibold">Lotes a conferir</h2>
        {lotes.pendentes.length === 0 ? (
          <EstadoVazio
            titulo="Nada pendente"
            descricao="Quando um lote novo for enviado, ele aparece aqui para conferência."
          />
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
                      : `recebido há ${lote.dias} ${lote.dias === 1 ? 'dia' : 'dias'}`}
                  </span>
                </span>
                <Moeda valor={lote.valorTotal} className="font-bold" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
