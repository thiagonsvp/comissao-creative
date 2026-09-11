import Link from 'next/link';
import { formatarBRL } from '@/dominio/dinheiro';
import type { StatusRecebimento } from '@/dominio/comissao';
import { exigirSessao } from '@/servidor/auth';
import { listarOs } from '@/servidor/os/consultas';

const RUBRICA_STATUS: Record<StatusRecebimento, string> = {
  aberta: 'Aberta',
  parcial: 'Parcial',
  quitada: 'Quitada',
};

export default async function PaginaListaOs({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sessao = await exigirSessao();
  const { q } = await searchParams;
  const lista = await listarOs({ busca: q });

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ordens de serviço</h1>
        {sessao.papel === 'admin' && (
          <Link href="/os/nova" className="rounded bg-blue-600 px-4 py-2 text-white">
            Nova OS
          </Link>
        )}
      </div>

      <form className="mb-4">
        <label htmlFor="q" className="sr-only">
          Buscar
        </label>
        <input
          type="search"
          name="q"
          id="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por número, cliente ou produto"
          className="w-80 rounded border px-3 py-2"
        />
      </form>

      {lista.length === 0 ? (
        <p className="mt-4 text-gray-500">Nenhuma OS encontrada.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2">
                Número
              </th>
              <th scope="col">Cliente</th>
              <th scope="col">Produto</th>
              <th scope="col">Valor</th>
              <th scope="col">Status</th>
              <th scope="col">Comissão disponível</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((os) => (
              <tr key={os.id} className="border-b">
                <td className="py-2">
                  <Link href={`/os/${os.id}`} className="text-blue-600 underline">
                    {os.numeroOs}
                  </Link>
                </td>
                <td>{os.cliente}</td>
                <td>{os.produto}</td>
                <td>{formatarBRL(os.valor)}</td>
                <td>{RUBRICA_STATUS[os.status]}</td>
                <td>{formatarBRL(os.comissaoDisponivel)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
