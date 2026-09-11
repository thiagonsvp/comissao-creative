'use client';

import Link from 'next/link';

export default function ErroApp({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="p-6">
      <p className="mb-4 text-red-600">
        {error.message || 'Ocorreu um erro inesperado.'}
      </p>
      <Link href="/os" className="text-sm text-blue-600 underline">
        Voltar para as OS
      </Link>
    </main>
  );
}
