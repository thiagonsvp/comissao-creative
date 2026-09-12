import {
  parseDecimal,
  parsePercentual,
  type Centavos,
  type Percentual,
} from '@/dominio/dinheiro';
import type { LoteQueReserva } from '@/dominio/travas';
import { sql, type Executor } from '@/servidor/db';

export interface LoteReservando extends LoteQueReserva {
  id: string;
}

export interface SituacaoDaOs {
  valorOs: Centavos;
  percentualComissao: Percentual;
  totalPago: Centavos;
  comprometido: Centavos;
  lotes: LoteReservando[];
}

/**
 * Foto da OS antes de qualquer correção: os componentes para recalcular a
 * comissão e os lotes não cancelados que já reservaram parte dela.
 *
 * Nenhuma comissão é calculada aqui — quem calcula é `src/dominio`.
 */
export async function situacaoDaOs(
  osId: string,
  exec: Executor = sql,
): Promise<SituacaoDaOs | null> {
  const [os] = await exec`
    select o.valor, o.percentual_comissao,
      (
        select coalesce(sum(case when b.tipo = 'estorno' then -b.valor else b.valor end), 0)
        from public.baixa_cliente b
        where b.os_id = o.id
      ) as total_pago
    from public.os o
    where o.id = ${osId}
  `;
  if (!os) return null;

  const lotes = await exec`
    select lf.id, lf.numero, lf.estado_conferencia,
      coalesce(sum(li.valor_comissao), 0) as valor_reservado
    from public.lote_item li
    join public.lote_financeiro lf on lf.id = li.lote_id
    where li.os_id = ${osId} and lf.estado_conferencia <> 'cancelado'
    group by lf.id, lf.numero, lf.estado_conferencia
    order by lf.numero
  `;

  const reservando: LoteReservando[] = lotes.map((l) => ({
    id: l.id,
    numero: Number(l.numero),
    estadoConferencia: l.estado_conferencia,
    valorReservado: parseDecimal(l.valor_reservado),
  }));

  return {
    valorOs: parseDecimal(os.valor),
    percentualComissao: parsePercentual(os.percentual_comissao),
    totalPago: parseDecimal(os.total_pago),
    comprometido: reservando.reduce((acc, l) => acc + l.valorReservado, 0n),
    lotes: reservando,
  };
}
