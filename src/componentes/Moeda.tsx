import { formatarBRL } from '@/dominio/dinheiro';

export function Moeda({ valor, className }: { valor: bigint; className?: string }) {
  return <span className={className ? `num ${className}` : 'num'}>{formatarBRL(valor)}</span>;
}
