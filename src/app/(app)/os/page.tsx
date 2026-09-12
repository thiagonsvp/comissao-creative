import Link from 'next/link';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoLista } from '@/componentes/CartaoLista';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeStatusOs } from '@/componentes/Selo';
import { CLASSE_ENTRADA } from '@/componentes/Campo';
import { validarDataIso } from '@/dominio/datas';
import { sessaoDaPagina } from '@/servidor/auth';
import {
  listarOs,
  type ColunaOrdenacaoOs,
  type DirecaoOrdenacao,
  type FiltroStatusOs,
} from '@/servidor/os/consultas';

const STATUS_VALIDOS = new Set<FiltroStatusOs>([
  'pendentes', 'aberta', 'parcial', 'quitada', 'todas',
]);
const COLUNAS_VALIDAS = new Set<ColunaOrdenacaoOs>([
  'numero', 'cliente', 'produto', 'valor', 'status', 'comissaoDisponivel',
]);

function dataValida(valor?: string): string | undefined {
  if (!valor) return undefined;
  try {
    return validarDataIso(valor, 'data');
  } catch {
    return undefined;
  }
}

export default async function PaginaListaOs({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    inicio?: string;
    fim?: string;
    ordem?: string;
    direcao?: string;
  }>;
}) {
  const sessao = await sessaoDaPagina();
  const parametros = await searchParams;
  const { q, status: statusRecebido, inicio, fim } = parametros;
  const status = STATUS_VALIDOS.has(statusRecebido as FiltroStatusOs)
    ? statusRecebido as FiltroStatusOs
    : 'pendentes';
  const dataInicio = dataValida(inicio);
  const dataFim = dataValida(fim);
  const ordenarPor = COLUNAS_VALIDAS.has(parametros.ordem as ColunaOrdenacaoOs)
    ? parametros.ordem as ColunaOrdenacaoOs
    : 'numero';
  const direcao: DirecaoOrdenacao = parametros.direcao === 'asc' ? 'asc' : 'desc';
  const lista = await listarOs({
    busca: q,
    status,
    dataInicio,
    dataFim,
    ordenarPor,
    direcao,
  });
  const ehAdmin = sessao.papel === 'admin';
  const temFiltros = Boolean(q || status !== 'pendentes' || dataInicio || dataFim);

  function linkOrdenacao(coluna: ColunaOrdenacaoOs): string {
    const novos = new URLSearchParams();
    if (q) novos.set('q', q);
    novos.set('status', status);
    if (dataInicio) novos.set('inicio', dataInicio);
    if (dataFim) novos.set('fim', dataFim);
    novos.set('ordem', coluna);
    novos.set('direcao', ordenarPor === coluna && direcao === 'asc' ? 'desc' : 'asc');
    return `/os?${novos.toString()}`;
  }

  function cabecalho(coluna: ColunaOrdenacaoOs, rotulo: string, direita = false) {
    const ativa = ordenarPor === coluna;
    return (
      <th
        scope="col"
        className={direita ? 'direita' : undefined}
        aria-sort={ativa ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <Link
          href={linkOrdenacao(coluna)}
          className={`inline-flex items-center gap-1 underline-offset-2 hover:underline ${direita ? 'justify-end' : ''}`}
        >
          {rotulo}
          <span aria-hidden="true" className={ativa ? 'text-destaque' : 'text-texto-2'}>
            {ativa ? (direcao === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </Link>
      </th>
    );
  }

  return (
    <main>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">
          Ordens de serviço
        </h1>
        {ehAdmin && <BotaoLink href="/os/nova">Nova OS</BotaoLink>}
      </div>

      <form className="mb-5 grid gap-3 rounded-xl border border-borda bg-superficie p-4 md:grid-cols-4">
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-[12px] font-medium text-texto-2">Buscar</span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Número, cliente ou produto"
            className={CLASSE_ENTRADA}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-texto-2">Status</span>
          <select name="status" defaultValue={status} className={CLASSE_ENTRADA}>
            <option value="pendentes">Em aberto e parciais</option>
            <option value="aberta">Somente abertas</option>
            <option value="parcial">Somente parciais</option>
            <option value="quitada">Somente quitadas</option>
            <option value="todas">Todas as OS</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-texto-2">Venda inicial</span>
            <input type="date" name="inicio" defaultValue={dataInicio} className={CLASSE_ENTRADA} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-texto-2">Venda final</span>
            <input type="date" name="fim" defaultValue={dataFim} className={CLASSE_ENTRADA} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-4">
          <button className="min-h-11 rounded-lg bg-destaque px-4 text-sm font-semibold text-sobre-destaque">
            Aplicar filtros
          </button>
          {temFiltros && (
            <Link href="/os" className="inline-flex min-h-11 items-center px-3 text-sm text-texto-2 underline">
              Limpar filtros
            </Link>
          )}
        </div>
      </form>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma OS encontrada"
          descricao={
            temFiltros
              ? 'Nenhuma ordem de serviço corresponde a essa busca. Tente outro número, cliente ou produto.'
              : 'Não há OS abertas ou parciais. Use o filtro de status para ver as quitadas.'
          }
          acao={ehAdmin && !temFiltros ? <BotaoLink href="/os/nova">Cadastrar nova OS</BotaoLink> : undefined}
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
                {cabecalho('numero', 'Número')}
                {cabecalho('cliente', 'Cliente')}
                {cabecalho('produto', 'Produto')}
                {cabecalho('valor', 'Valor', true)}
                {cabecalho('status', 'Status')}
                {cabecalho('comissaoDisponivel', 'Comissão disponível', true)}
              </tr>
            </thead>
            <tbody>
              {lista.map((os) => (
                <tr key={os.id}>
                  <td>
                    <Link href={`/os/${os.id}`} className="num font-bold text-destaque underline">
                      {os.numeroOs}
                    </Link>
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
