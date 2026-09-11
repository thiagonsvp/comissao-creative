import Link from 'next/link';
import { exigirSessao } from '@/servidor/auth';
import { sairAction } from '@/servidor/auth-acoes';

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await exigirSessao();

  return (
    <div>
      <nav className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div className="flex gap-4 text-sm">
          <Link href="/os">OS</Link>
          <Link href="/lotes">Lotes</Link>
          {sessao.papel === 'admin' && <Link href="/configuracao">Configuração</Link>}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            {sessao.email} ({sessao.papel})
          </span>
          <form action={sairAction}>
            <button type="submit" className="underline">
              Sair
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
