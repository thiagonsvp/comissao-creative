import { comissaoLiberada, comissaoTotal } from './comissao';
import type { Centavos, Percentual } from './dinheiro';
import { ErroValidacao } from './erros';
import { intervalosLivres, somaTamanhos, type Intervalo } from './intervalos';
import { ratearIntervalo, validarPesos, type PorPessoa } from './rateio';

export const VERSAO_CALCULO = 'comissao_v2/divisores_v1';

export interface OsParaLote {
  osId: string;
  numeroOs: string;
  numeroOsNormalizado: string;
  cliente: string;
  produto: string;
  valorOs: Centavos;
  percentualComissao: Percentual;
  totalPagoCliente: Centavos;
  reservasAtivas: Intervalo[];
  pesos: PorPessoa;
}

export interface SnapshotItem {
  numeroOs: string;
  cliente: string;
  produto: string;
  valorOs: Centavos;
  percentualComissao: Percentual;
  totalPagoCliente: Centavos;
  comissaoLiberada: Centavos;
  comissaoComprometidaAnterior: Centavos;
}

export interface ItemLoteCalculado {
  osId: string;
  ordem: number;
  inicio: bigint;
  fim: bigint;
  valorComissao: Centavos;
  rateio: PorPessoa;
  snapshot: SnapshotItem;
}

export function resumoComissaoOs(os: OsParaLote) {
  const total = comissaoTotal(os.valorOs, os.percentualComissao);
  const liberada = comissaoLiberada(total, os.totalPagoCliente, os.valorOs);
  const livres = intervalosLivres(liberada, os.reservasAtivas);
  const comprometida = somaTamanhos(os.reservasAtivas);
  return {
    comissaoTotal: total,
    comissaoLiberada: liberada,
    comissaoComprometida: comprometida,
    comissaoDisponivel: somaTamanhos(livres),
    livres,
  };
}

function compararOs(a: OsParaLote, b: OsParaLote): number {
  if (a.numeroOsNormalizado !== b.numeroOsNormalizado) return a.numeroOsNormalizado < b.numeroOsNormalizado ? -1 : 1;
  if (a.osId !== b.osId) return a.osId < b.osId ? -1 : 1;
  return 0;
}

export function calcularItensLote(oss: OsParaLote[]): ItemLoteCalculado[] {
  const itens: ItemLoteCalculado[] = [];
  for (const os of [...oss].sort(compararOs)) {
    validarPesos(os.pesos, os.percentualComissao);
    const resumo = resumoComissaoOs(os);
    for (const iv of resumo.livres) {
      itens.push({
        osId: os.osId,
        ordem: itens.length + 1,
        inicio: iv.inicio,
        fim: iv.fim,
        valorComissao: iv.fim - iv.inicio,
        rateio: ratearIntervalo(os.pesos, iv.inicio, iv.fim),
        snapshot: {
          numeroOs: os.numeroOs,
          cliente: os.cliente,
          produto: os.produto,
          valorOs: os.valorOs,
          percentualComissao: os.percentualComissao,
          totalPagoCliente: os.totalPagoCliente,
          comissaoLiberada: resumo.comissaoLiberada,
          comissaoComprometidaAnterior: resumo.comissaoComprometida,
        },
      });
    }
  }
  if (itens.length === 0) throw new ErroValidacao('Nenhuma comissão disponível para envio');
  return itens;
}

export function totalItens(itens: ItemLoteCalculado[]): Centavos {
  return itens.reduce((acc, i) => acc + i.valorComissao, 0n);
}
