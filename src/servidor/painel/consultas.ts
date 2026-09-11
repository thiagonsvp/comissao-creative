import { parseDecimal, parsePercentual, type Centavos } from '@/dominio/dinheiro';
import type { ComponentesOs } from '@/dominio/painel';
import { sql, type Executor } from '@/servidor/db';

/** Lote enviado há mais dias que isto recebe alerta nos dois painéis. */
export const DIAS_PARA_ALERTA = 15;

export interface LotePendente {
  id: string;
  numero: number;
  valorTotal: Centavos;
  dias: number;
}

export interface ResumoLotes {
  aguardandoConferencia: { total: Centavos; quantidade: number };
  aprovado: { total: Centavos; quantidade: number };
  pendentes: LotePendente[];
}

/**
 * Componentes crus por OS. Nenhuma comissão é calculada aqui — quem soma é
 * `src/dominio/painel.ts`, com as mesmas funções das telas.
 *
 * Quando `incluirRateio` é falso a consulta não toca `interno.os_rateio`:
 * é assim que o painel do financeiro fica incapaz de carregar rateio.
 */
export async function componentesPorOs(
  incluirRateio: boolean,
  exec: Executor = sql,
): Promise<ComponentesOs[]> {
  const comuns = exec`
    o.id, o.valor, o.percentual_comissao,
    to_char(o.data_venda, 'YYYY-MM') as mes_venda,
    (
      select coalesce(sum(case when b.tipo = 'estorno' then -b.valor else b.valor end), 0)
      from public.baixa_cliente b
      where b.os_id = o.id
    ) as total_pago,
    (
      select coalesce(sum(li.valor_comissao), 0)
      from public.lote_item li
      join public.lote_financeiro lf on lf.id = li.lote_id
      where li.os_id = o.id and lf.estado_conferencia <> 'cancelado'
    ) as comprometido
  `;

  // Sem filtro de `situacao`: esta é a única consulta do sistema que olhava essa
  // coluna, e as demais (listarOs, obterOsPorId, listarOsComComissaoDisponivel,
  // geração de lote) ignoram OS canceladas de propósitos diferentes entre si.
  // Tratar cancelamento aqui sozinho criaria divergência sobre qual universo de
  // OS o painel conta em relação ao resto do sistema. Fica para a fase de
  // cancelamento, quando todas as consultas tratarem a coluna de forma coerente.
  const linhas = incluirRateio
    ? await exec`
        select ${comuns}, r.rateio_thiago, r.rateio_geice, r.rateio_gabrielle
        from public.os o
        join interno.os_rateio r on r.os_id = o.id
      `
    : await exec`
        select ${comuns}
        from public.os o
      `;

  return linhas.map((linha) => ({
    osId: linha.id,
    valorOs: parseDecimal(linha.valor),
    percentualComissao: parsePercentual(linha.percentual_comissao),
    totalPagoCliente: parseDecimal(linha.total_pago),
    comprometido: parseDecimal(linha.comprometido),
    mesVenda: linha.mes_venda,
    pesos: incluirRateio
      ? {
          thiago: parsePercentual(linha.rateio_thiago),
          geice: parsePercentual(linha.rateio_geice),
          gabrielle: parsePercentual(linha.rateio_gabrielle),
        }
      : null,
  }));
}

export async function resumoLotes(exec: Executor = sql): Promise<ResumoLotes> {
  const porEstado = await exec`
    select estado_conferencia,
      coalesce(sum(valor_total_original), 0) as total,
      count(*)::int as quantidade
    from public.lote_financeiro
    where estado_conferencia in ('enviado', 'aprovado')
    group by estado_conferencia
  `;

  // A idade usa a data no fuso do negócio; current_date no servidor está em UTC
  // e viraria o dia três horas antes.
  const pendentes = await exec`
    select id, numero, valor_total_original,
      greatest(
        0,
        ((now() at time zone 'America/Sao_Paulo')::date - data_envio)
      )::int as dias
    from public.lote_financeiro
    where estado_conferencia = 'enviado'
    order by data_envio nulls last, numero
  `;

  function estado(nome: string): { total: Centavos; quantidade: number } {
    const linha = porEstado.find((l) => l.estado_conferencia === nome);
    return {
      total: linha ? parseDecimal(linha.total) : 0n,
      quantidade: linha ? linha.quantidade : 0,
    };
  }

  return {
    aguardandoConferencia: estado('enviado'),
    aprovado: estado('aprovado'),
    pendentes: pendentes.map((l) => ({
      id: l.id,
      numero: Number(l.numero),
      valorTotal: parseDecimal(l.valor_total_original),
      dias: l.dias ?? 0,
    })),
  };
}
