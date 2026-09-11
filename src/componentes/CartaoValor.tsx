import { formatarBRL } from '@/dominio/dinheiro';

export function CartaoValor({
  rotulo,
  valor,
  detalhe,
  destaque = false,
  children,
}: {
  rotulo: string;
  valor: bigint;
  detalhe?: string;
  destaque?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-borda bg-superficie p-4 ${
        destaque ? 'border-t-2 border-t-destaque' : ''
      }`}
    >
      <p className="rotulo">{rotulo}</p>
      <p
        className={`num mt-2 font-bold leading-none ${
          destaque ? 'text-[2.25rem] text-destaque sm:text-[2.75rem]' : 'text-[1.5rem]'
        }`}
      >
        {formatarBRL(valor)}
      </p>
      {detalhe && <p className="mt-1.5 text-[12.5px] text-texto-2">{detalhe}</p>}
      {children}
    </div>
  );
}
