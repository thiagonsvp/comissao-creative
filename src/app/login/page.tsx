import { FormularioLogin } from './FormularioLogin';

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Controle de Comissão</h1>
        <FormularioLogin />
      </div>
    </main>
  );
}
