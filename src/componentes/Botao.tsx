import Link from 'next/link';

export type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'destrutivo';

// min-h-11 = 44px: alvo de toque confortável no celular.
const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-destaque text-sobre-destaque hover:bg-destaque-hover',
  secundario: 'border border-borda-forte bg-superficie text-texto hover:bg-superficie-2',
  fantasma: 'text-texto-2 hover:bg-superficie-2 hover:text-texto',
  destrutivo: 'border border-erro bg-transparent text-erro hover:bg-erro-suave',
};

function classes(variante: VarianteBotao, larguraTotal: boolean, extra?: string): string {
  return [BASE, VARIANTES[variante], larguraTotal ? 'w-full' : '', extra ?? ''].join(' ').trim();
}

export function Botao({
  variante = 'primario',
  carregando = false,
  larguraTotal = false,
  className,
  children,
  disabled,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  carregando?: boolean;
  larguraTotal?: boolean;
}) {
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={classes(variante, larguraTotal, className)}
    >
      {carregando && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}

export function BotaoLink({
  href,
  variante = 'primario',
  larguraTotal = false,
  target,
  children,
}: {
  href: string;
  variante?: VarianteBotao;
  larguraTotal?: boolean;
  target?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} target={target} className={classes(variante, larguraTotal)}>
      {children}
    </Link>
  );
}
