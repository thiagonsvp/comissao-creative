import Link from 'next/link';
import { formatarBRL } from '@/dominio/dinheiro';
import { Selo, type TomSelo } from './Selo';

/** Uma linha de lista no celular. No computador as mesmas listas viram <table class="tabela">. */
export function CartaoLista({
  href,
  titulo,
  selo,
  descricao,
  rotuloValor,
  valor,
}: {
  href: string;
  titulo: string;
  selo: { tom: TomSelo; rotulo: string };
  descricao: string;
  rotuloValor: string;
  valor: bigint;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-borda bg-superficie p-3.5 active:bg-superficie-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="num text-sm font-bold">{titulo}</span>
        <Selo tom={selo.tom}>{selo.rotulo}</Selo>
      </div>
      <p className="mt-1 mb-2.5 text-[13px] text-texto-2">{descricao}</p>
      <div className="flex items-baseline justify-between border-t border-borda pt-2">
        <span className="rotulo">{rotuloValor}</span>
        <span className="num text-[15px] font-bold text-destaque">{formatarBRL(valor)}</span>
      </div>
    </Link>
  );
}
