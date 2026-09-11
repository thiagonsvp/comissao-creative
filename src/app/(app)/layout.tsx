import { AlternadorTema } from '@/componentes/AlternadorTema';
import { NavRodape } from '@/componentes/NavRodape';
import { NavTopo } from '@/componentes/NavTopo';
import { sessaoDaPagina } from '@/servidor/auth';
import { sairAction } from '@/servidor/auth-acoes';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoDaPagina();

  return (
    <div className="min-h-screen">
      <NavTopo papel={sessao.papel} email={sessao.email} />

      {/* Cabeçalho de celular: papel, tema e sair. A navegação fica no rodapé. */}
      <header className="sem-impressao flex items-center justify-between gap-3 border-b border-borda bg-superficie px-4 py-2.5 md:hidden">
        <span className="text-[12.5px] text-texto-2">{sessao.papel}</span>
        <div className="flex items-center gap-3">
          <AlternadorTema />
          <form action={sairAction}>
            <button type="submit" className="min-h-11 px-1 text-[12.5px] underline">
              Sair
            </button>
          </form>
        </div>
      </header>

      {/* pb-24 no celular abre espaço para a barra fixa não cobrir o conteúdo. */}
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-10">{children}</div>

      <div className="sem-impressao mx-auto hidden max-w-6xl px-6 pb-8 md:block">
        <form action={sairAction}>
          <button type="submit" className="text-[12.5px] text-texto-2 underline">
            Sair
          </button>
        </form>
      </div>

      <NavRodape papel={sessao.papel} />
    </div>
  );
}
