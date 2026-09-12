'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Papel } from '@/servidor/auth';
import { AlternadorTema } from './AlternadorTema';

export interface Destino {
  href: string;
  rotulo: string;
  icone: string;
  somenteAdmin?: boolean;
}

export const DESTINOS: Destino[] = [
  { href: '/', rotulo: 'Início', icone: '▣' },
  { href: '/os', rotulo: 'OS', icone: '≡' },
  { href: '/lotes', rotulo: 'Lotes', icone: '▤' },
  { href: '/configuracao', rotulo: 'Configuração', icone: '⚙', somenteAdmin: true },
];

export function destinosDoPapel(papel: Papel): Destino[] {
  return DESTINOS.filter((destino) => !destino.somenteAdmin || papel === 'admin');
}

export function ehAtivo(caminho: string, href: string): boolean {
  return href === '/' ? caminho === '/' : caminho.startsWith(href);
}

export function NavTopo({ papel, email }: { papel: Papel; email: string }) {
  const caminho = usePathname();

  return (
    <nav className="sem-impressao hidden border-b border-borda bg-superficie px-6 md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex gap-6">
          {destinosDoPapel(papel).map((destino) => {
            const ativo = ehAtivo(caminho, destino.href);
            return (
              <Link
                key={destino.href}
                href={destino.href}
                aria-current={ativo ? 'page' : undefined}
                className={`relative block py-4 text-sm ${
                  ativo
                    ? 'font-semibold text-texto after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-destaque'
                    : 'text-texto-2 hover:text-texto'
                }`}
              >
                {destino.rotulo}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          <AlternadorTema />
          <span className="text-[12.5px] text-texto-2">
            {email} ({papel})
          </span>
        </div>
      </div>
    </nav>
  );
}
