import type { StatusRecebimento } from '@/dominio/comissao';

export type TomSelo = 'neutro' | 'destaque' | 'sucesso' | 'erro';

const TONS: Record<TomSelo, string> = {
  neutro: 'border-borda bg-superficie-2 text-texto-2',
  destaque: 'border-destaque bg-destaque-suave text-destaque',
  sucesso: 'border-sucesso bg-sucesso-suave text-sucesso',
  erro: 'border-erro bg-erro-suave text-erro',
};

/**
 * Status sempre com cor + texto + ponto. Quem não distingue bem as cores
 * continua lendo o estado pelo rótulo.
 */
export function Selo({ tom, children }: { tom: TomSelo; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONS[tom]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function seloDeStatusOs(status: StatusRecebimento): { tom: TomSelo; rotulo: string } {
  if (status === 'quitada') return { tom: 'sucesso', rotulo: 'Quitada' };
  if (status === 'parcial') return { tom: 'destaque', rotulo: 'Parcial' };
  return { tom: 'neutro', rotulo: 'Aberta' };
}

export function seloDeEstadoLote(estado: string): { tom: TomSelo; rotulo: string } {
  if (estado === 'aprovado') return { tom: 'sucesso', rotulo: 'Aprovado' };
  if (estado === 'enviado') return { tom: 'destaque', rotulo: 'Aguardando conferência' };
  if (estado === 'cancelado') return { tom: 'erro', rotulo: 'Cancelado' };
  return { tom: 'neutro', rotulo: 'Rascunho' };
}
