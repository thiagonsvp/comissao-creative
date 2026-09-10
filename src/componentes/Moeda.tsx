import { formatarBRL } from '@/dominio/dinheiro';

export function Moeda({ valor, classeName }: { valor: bigint; classeName?: string }) {
  return <span className={classeName}>{formatarBRL(valor)}</span>;
}
