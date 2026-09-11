import { BotaoLink } from '@/componentes/Botao';
import { CartaoLista } from '@/componentes/CartaoLista';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeStatusOs } from '@/componentes/Selo';
import { CLASSE_ENTRADA } from '@/componentes/Campo';
import { sessaoDaPagina } from '@/servidor/auth';
import { listarOs } from '@/servidor/os/consultas';

export default async function PaginaListaOs({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sessao = await sessaoDaPagina();
  const { q } = await searchParams;
  const lista = await listarOs({ busca: q });
  const ehAdmin = sessao.papel === 'admin';

  return (
    <main>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">
          Ordens de serviço
        </h1>
        {ehAdmin && <BotaoLink href="/os/nova">Nova OS</BotaoLink>}
      </div>

      <form className="mb-5">
        <label htmlFor="q" className="sr-only">
          Buscar ordens de serviço
        </label>
        <input
          type="search"
          name="q"
          id="q"
          defaultValue={q ?? ''}
          placeholder="Buscar número, cliente ou produto"
          className={`${CLASSE_ENTRADA} md:max-w-sm`}
        />
      </form>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma OS encontrada"
          descricao={
            q
              ? 'Nenhuma ordem de serviço corresponde a essa busca. Tente outro número, cliente ou produto.'
              : 'Ainda não há ordens de serviço cadastradas.'
          }
          acao={ehAdmin && !q ? <BotaoLink href="/os/nova">Cadastrar a primeira OS</BotaoLink> : undefined}
        />
      ) : (
        <>
          {/* Celular: cartões, sem rolagem lateral. */}
          <ul className="flex flex-col gap-2.5 md:hidden">
            {lista.map((os) => (
              <li key={os.id}>
                <CartaoLista
                  href={`/os/${os.id}`}
                  titulo={os.numeroOs}
                  selo={seloDeStatusOs(os.status)}
                  descricao={`${os.cliente} · ${os.produto}`}
                  rotuloValor="Disponível"
                  valor={os.comissaoDisponivel}
                />
              </li>
            ))}
          </ul>

          {/* Computador: tabela. */}
          <table className="tabela hidden md:table">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Cliente</th>
                <th scope="col">Produto</th>
                <th scope="col" className="direita">Valor</th>
                <th scope="col">Status</th>
                <th scope="col" className="direita">Comissão disponível</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((os) => (
                <tr key={os.id}>
                  <td>
                    <a href={`/os/${os.id}`} className="num font-bold text-destaque underline">
                      {os.numeroOs}
                    </a>
                  </td>
                  <td>{os.cliente}</td>
                  <td className="text-texto-2">{os.produto}</td>
                  <td className="direita"><Moeda valor={os.valor} /></td>
                  <td>
                    <Selo tom={seloDeStatusOs(os.status).tom}>
                      {seloDeStatusOs(os.status).rotulo}
                    </Selo>
                  </td>
                  <td className="direita font-semibold">
                    <Moeda valor={os.comissaoDisponivel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
