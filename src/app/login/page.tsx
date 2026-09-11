import { AlternadorTema } from '@/componentes/AlternadorTema';
import { FormularioLogin } from './FormularioLogin';

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-xs">
        <p className="rotulo">Controle de</p>
        <h1 className="mt-1 mb-7 text-[1.75rem] font-bold leading-none tracking-tight">
          Comissão
        </h1>
        <FormularioLogin />
        <div className="mt-8 flex justify-center">
          <AlternadorTema />
        </div>
      </div>
    </main>
  );
}
