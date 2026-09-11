import Link from 'next/link';

export default function PaginaSemPermissao() {
  return (
    <main className="p-6">
      <h1 className="mb-2 text-xl font-semibold">Acesso não autorizado</h1>
      <p className="mb-4 text-gray-600">
        Seu usuário não tem permissão para abrir esta tela.
      </p>
      <Link href="/os" className="text-sm text-blue-600 underline">
        Voltar para as OS
      </Link>
    </main>
  );
}
