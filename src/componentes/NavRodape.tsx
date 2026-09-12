'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Papel } from '@/servidor/auth';
import { destinosDoPapel, ehAtivo } from './NavTopo';

/** Barra fixa no rodapé: quatro destinos, no alcance do polegar. Só no celular. */
export function NavRodape({ papel }: { papel: Papel }) {
  const caminho = usePathname();

  return (
    <nav className="sem-impressao fixed inset-x-0 bottom-0 z-10 flex border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
      {destinosDoPapel(papel).map((destino) => {
        const ativo = ehAtivo(caminho, destino.href);
        return (
          <Link
            key={destino.href}
            href={destino.href}
            aria-current={ativo ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] ${
              ativo ? 'text-destaque' : 'text-rotulo'
            }`}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {destino.icone}
            </span>
            {destino.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
