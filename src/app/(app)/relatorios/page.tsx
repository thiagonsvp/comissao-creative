import Link from 'next/link';
import { CartaoValor } from '@/componentes/CartaoValor';
import { CLASSE_ENTRADA } from '@/componentes/Campo';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeStatusOs } from '@/componentes/Selo';
import { formatarDataBr, validarDataIso } from '@/dominio/datas';
import { sessaoDaPagina } from '@/servidor/auth';
import { listarOs, type FiltroStatusOs } from '@/servidor/os/consultas';

const STATUS_VALIDOS = new Set<FiltroStatusOs>([
  'pendentes', 'aberta', 'parcial', 'quitada', 'todas',
]);

function dataValida(valor?: string): string | undefined {
  if (!valor) return undefined;
  try {
    return validarDataIso(valor, 'data');
  } catch {
    return undefined;
  }
}

export default async function PaginaRelatorios({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string; status?: string; visao?: string }>;
}) {
  await sessaoDaPagina('admin');
  const parametros = await searchParams;
  const inicio = dataValida(parametros.inicio);
  const fim = dataValida(parametros.fim);
  const status = STATUS_VALIDOS.has(parametros.status as FiltroStatusOs)
    ? parametros.status as FiltroStatusOs
    : 'todas';
  const visao = parametros.visao === 'detalhada' ? 'detalhada' : 'resumo';
  const lista = await listarOs({
    dataInicio: inicio,
    dataFim: fim,
    status,
    ordenarPor: 'dataVenda',
    direcao: 'desc',
  });
  const totalVendas = lista.reduce((total, os) => total + os.valor, 0n);
  const totalRecebido = lista.reduce((total, os) => total + os.totalPagoCliente, 0n);
  const comissaoLiberada = lista.reduce((total, os) => total + os.comissaoLiberada, 0n);
  const comissaoDisponivel = lista.reduce((total, os) => total + os.comissaoDisponivel, 0n);

  return (
    <main>
      <div className="mb-5">
        <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">Relatórios personalizados</h1>
        <p className="mt-1 text-sm text-texto-2">
          Escolha o período, o status e o formato para montar seu relatório de OS.
        </p>
      </div>

      <form className="mb-5 grid gap-3 rounded-xl border border-borda bg-superficie p-4 md:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-texto-2">Venda inicial</span>
          <input type="date" name="inicio" defaultValue={inicio} className={CLASSE_ENTRADA} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-texto-2">Venda final</span>
          <input type="date" name="fim" defaultValue={fim} className={CLASSE_ENTRADA} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-texto-2">Status da OS</span>
          <select name="status" defaultValue={status} className={CLASSE_ENTRADA}>
            <option value="todas">Todas as OS</option>
            <option value="pendentes">Em aberto e parciais</option>
            <option value="aberta">Somente abertas</option>
            <option value="parcial">Somente parciais</option>
            <option value="quitada">Somente quitadas</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-texto-2">Formato</span>
          <select name="visao" defaultValue={visao} className={CLASSE_ENTRADA}>
            <option value="resumo">Resumo financeiro</option>
            <option value="detalhada">OS detalhadas</option>
          </select>
        </label>
        <div className="md:col-span-4">
          <button className="min-h-11 rounded-lg bg-destaque px-4 text-sm font-semibold text-sobre-destaque">
            Gerar relatório
          </button>
        </div>
      </form>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoValor rotulo="Total em vendas" valor={totalVendas} detalhe={`${lista.length} OS no período`} />
        <CartaoValor rotulo="Recebido dos clientes" valor={totalRecebido} />
        <CartaoValor rotulo="Comissão liberada" valor={comissaoLiberada} />
        <CartaoValor rotulo="Disponível para lote" valor={comissaoDisponivel} destaque />
      </div>

      {visao === 'detalhada' && (lista.length === 0 ? (
        <EstadoVazio titulo="Nenhuma OS no relatório" descricao="Altere os filtros para incluir outras ordens de serviço." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
          <table className="tabela min-w-[920px]">
            <thead>
              <tr>
                <th>Número</th><th>Data da venda</th><th>Cliente</th><th>Produto</th>
                <th className="direita">Venda</th><th>Status</th><th className="direita">Recebido</th>
                <th className="direita">Comissão disponível</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((os) => (
                <tr key={os.id}>
                  <td><Link href={`/os/${os.id}`} className="num font-bold text-destaque underline">{os.numeroOs}</Link></td>
                  <td className="num whitespace-nowrap">{formatarDataBr(os.dataVenda)}</td>
                  <td>{os.cliente}</td><td className="text-texto-2">{os.produto}</td>
                  <td className="direita"><Moeda valor={os.valor} /></td>
                  <td><Selo tom={seloDeStatusOs(os.status).tom}>{seloDeStatusOs(os.status).rotulo}</Selo></td>
                  <td className="direita"><Moeda valor={os.totalPagoCliente} /></td>
                  <td className="direita font-semibold"><Moeda valor={os.comissaoDisponivel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </main>
  );
}
