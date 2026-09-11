'use client';

import { Botao } from '@/componentes/Botao';
import { formatarDataBr } from '@/dominio/datas';
import { formatarBRL } from '@/dominio/dinheiro';
import type { LoteDetalhe } from '@/servidor/lotes/consultas';

export function ConteudoImpressao({ lote }: { lote: LoteDetalhe }) {
  const totalValorOs = lote.itens.reduce((acc, i) => acc + i.valorOsSnapshot, 0n);
  const totalPago = lote.itens.reduce((acc, i) => acc + i.totalPagoClienteSnapshot, 0n);
  const totalJaEnviado = lote.itens.reduce(
    (acc, i) => acc + i.comissaoComprometidaAnteriorSnapshot,
    0n,
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0">
      <header className="flex items-start justify-between gap-4 border-b-2 border-texto pb-2.5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.18em]">
          Controle de Comissão
        </p>
        <p className="text-right text-[10px] leading-relaxed text-texto-2">
          Lote <strong className="text-texto">{lote.numero}</strong>
          <br />
          {lote.dataEnvio ? `Enviado em ${formatarDataBr(lote.dataEnvio)}` : 'Sem data de envio'}
        </p>
      </header>

      <h1 className="mt-4 mb-0.5 text-lg font-bold tracking-tight">Relatório de comissão</h1>
      <p className="mb-5 text-[10.5px] text-texto-2">
        Comissões liberadas por pagamento de cliente já recebido.
        {lote.observacao ? ` ${lote.observacao}` : ''}
      </p>

      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="border-b border-texto">
            <th scope="col" className="pb-1.5 text-left text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">OS</th>
            <th scope="col" className="pb-1.5 pl-2 text-left text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Cliente e produto</th>
            <th scope="col" className="pb-1.5 pl-2 text-right text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Valor da OS</th>
            <th scope="col" className="pb-1.5 pl-2 text-right text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Pago pelo cliente</th>
            <th scope="col" className="pb-1.5 pl-2 text-right text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Comissão já enviada</th>
            <th scope="col" className="pb-1.5 pl-2 text-right text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Liberada para pagamento</th>
          </tr>
        </thead>
        <tbody>
          {lote.itens.map((item) => (
            <tr key={item.id} className="border-b border-borda align-top">
              <td className="num py-2 font-bold">{item.numeroOsSnapshot}</td>
              <td className="py-2 pl-2">
                {item.clienteSnapshot}
                <span className="block text-[9.5px] text-texto-2">{item.produtoSnapshot}</span>
              </td>
              <td className="num py-2 pl-2 text-right">{formatarBRL(item.valorOsSnapshot)}</td>
              <td className="num py-2 pl-2 text-right">
                {formatarBRL(item.totalPagoClienteSnapshot)}
              </td>
              <td className="num py-2 pl-2 text-right">
                {/* Zero e "não se aplica" são coisas diferentes: primeira vez da OS num lote mostra traço. */}
                {item.comissaoComprometidaAnteriorSnapshot > 0n
                  ? formatarBRL(item.comissaoComprometidaAnteriorSnapshot)
                  : '—'}
              </td>
              <td className="num py-2 pl-2 text-right font-bold">
                {formatarBRL(item.valorComissao)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-texto font-bold">
            <td colSpan={2} className="pt-2.5 text-[11.5px]">
              Total do lote · {lote.itens.length} {lote.itens.length === 1 ? 'item' : 'itens'}
            </td>
            <td className="num pt-2.5 pl-2 text-right">{formatarBRL(totalValorOs)}</td>
            <td className="num pt-2.5 pl-2 text-right">{formatarBRL(totalPago)}</td>
            <td className="num pt-2.5 pl-2 text-right">
              {totalJaEnviado > 0n ? formatarBRL(totalJaEnviado) : '—'}
            </td>
            <td className="num pt-2.5 pl-2 text-right text-[15px] tracking-tight">
              {formatarBRL(lote.valorTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-9 flex gap-6">
        <p className="flex-1 border-t border-borda-forte pt-1.5 text-[9px] text-texto-2">
          Conferido por
        </p>
        <p className="flex-1 border-t border-borda-forte pt-1.5 text-[9px] text-texto-2">Data</p>
      </div>

      <footer className="mt-6 flex justify-between border-t border-borda pt-2 text-[8.5px] text-texto-2">
        <span>Controle de Comissão · lote {lote.numero}</span>
        <span>Documento gerado a partir dos valores congelados no envio do lote</span>
      </footer>

      <div className="sem-impressao mt-7">
        <Botao type="button" onClick={() => window.print()}>
          Imprimir / salvar PDF
        </Botao>
      </div>
    </main>
  );
}
