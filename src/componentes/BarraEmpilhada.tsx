import { formatarBRL } from '@/dominio/dinheiro';

export interface SegmentoBarra {
  rotulo: string;
  valor: bigint;
  tom: 'destaque' | 'sucesso' | 'neutro';
}

const FUNDOS: Record<SegmentoBarra['tom'], string> = {
  destaque: 'bg-destaque',
  sucesso: 'bg-sucesso',
  neutro: 'bg-borda-forte',
};

export function BarraEmpilhada({ segmentos }: { segmentos: SegmentoBarra[] }) {
  const total = segmentos.reduce((acc, s) => acc + s.valor, 0n);
  if (total <= 0n) return null;

  // A divisão acontece em bigint (pontos-base); só a proporção adimensional vira número.
  const largura = (valor: bigint): string => `${Number((valor * 10000n) / total) / 100}%`;
  const visiveis = segmentos.filter((s) => s.valor > 0n);

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-superficie-2">
        {visiveis.map((s) => (
          <span key={s.rotulo} className={FUNDOS[s.tom]} style={{ width: largura(s.valor) }} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-texto-2">
        {visiveis.map((s) => (
          <li key={s.rotulo} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2 rounded-sm ${FUNDOS[s.tom]}`} />
            {s.rotulo} · <span className="num">{formatarBRL(s.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
