import {
  comissaoLiberada,
  comissaoTotal,
  statusRecebimento,
  type StatusRecebimento,
} from './comissao';
import type { Centavos, Percentual } from './dinheiro';
import {
  ratearIntervalo,
  somaPorPessoa,
  ZERO_POR_PESSOA,
  type PorPessoa,
} from './rateio';

/**
 * Componentes crus de uma OS, como vêm do banco. A comissão NUNCA é calculada
 * em SQL: é derivada aqui, com as mesmas funções que as telas usam, para não
 * existir uma segunda implementação do arredondamento.
 */
export interface ComponentesOs {
  osId: string;
  valorOs: Centavos;
  percentualComissao: Percentual;
  totalPagoCliente: Centavos;
  /** Soma já reservada em lotes não cancelados. */
  comprometido: Centavos;
  /** Mês da venda no formato YYYY-MM. */
  mesVenda: string;
  /** `null` quando o papel que consultou não pode ver rateio. */
  pesos: PorPessoa | null;
}

export interface ResumoComissoes {
  comissaoTotal: Centavos;
  liberada: Centavos;
  comprometida: Centavos;
  disponivel: Centavos;
  quantidadeComDisponivel: number;
  porStatus: Record<StatusRecebimento, number>;
}

export interface PontoMensal {
  mes: string;
  rotulo: string;
  valor: Centavos;
}

const ROTULOS_MES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function totalDa(linha: ComponentesOs): Centavos {
  return comissaoTotal(linha.valorOs, linha.percentualComissao);
}

function liberadaDa(linha: ComponentesOs): Centavos {
  return comissaoLiberada(totalDa(linha), linha.totalPagoCliente, linha.valorOs);
}

function disponivelDa(linha: ComponentesOs): Centavos {
  const liberada = liberadaDa(linha);
  return liberada > linha.comprometido ? liberada - linha.comprometido : 0n;
}

export function resumirComissoes(linhas: ComponentesOs[]): ResumoComissoes {
  const porStatus: Record<StatusRecebimento, number> = { aberta: 0, parcial: 0, quitada: 0 };
  let total = 0n;
  let liberada = 0n;
  let comprometida = 0n;
  let disponivel = 0n;
  let quantidadeComDisponivel = 0;

  for (const linha of linhas) {
    total += totalDa(linha);
    liberada += liberadaDa(linha);
    comprometida += linha.comprometido;
    const daLinha = disponivelDa(linha);
    disponivel += daLinha;
    if (daLinha > 0n) quantidadeComDisponivel += 1;
    porStatus[statusRecebimento(linha.totalPagoCliente, linha.valorOs)] += 1;
  }

  return { comissaoTotal: total, liberada, comprometida, disponivel, quantidadeComDisponivel, porStatus };
}

/**
 * Quanto cada pessoa receberia se tudo que está disponível virasse lote agora.
 *
 * Suposição: as reservas de uma OS são contíguas a partir de zero, porque
 * `gerarLote` sempre toma todo o espaço livre de [0, liberada). Logo o próximo
 * trecho é exatamente [comprometido, liberada). Se algum dia existir reserva
 * parcial, esta função precisa passar a receber os intervalos reais.
 */
export function ratearDisponivel(linhas: ComponentesOs[]): PorPessoa {
  let acumulado: PorPessoa = { ...ZERO_POR_PESSOA };

  for (const linha of linhas) {
    if (!linha.pesos) continue;
    const liberada = liberadaDa(linha);
    if (liberada <= linha.comprometido) continue;
    acumulado = somaPorPessoa(
      acumulado,
      ratearIntervalo(linha.pesos, linha.comprometido, liberada),
    );
  }

  return acumulado;
}

export function mesesAnteriores(mesFinal: string, quantidade: number): string[] {
  const [anoTexto, mesTexto] = mesFinal.split('-');
  let ano = Number(anoTexto);
  let mes = Number(mesTexto);
  const janela: string[] = [];

  for (let i = 0; i < quantidade; i += 1) {
    janela.unshift(`${ano}-${String(mes).padStart(2, '0')}`);
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      ano -= 1;
    }
  }

  return janela;
}

export function serieMensal(
  linhas: ComponentesOs[],
  mesFinal: string,
  quantidade = 12,
): PontoMensal[] {
  const janela = mesesAnteriores(mesFinal, quantidade);
  const soma = new Map<string, Centavos>(janela.map((mes) => [mes, 0n]));

  for (const linha of linhas) {
    const atual = soma.get(linha.mesVenda);
    if (atual === undefined) continue;
    soma.set(linha.mesVenda, atual + totalDa(linha));
  }

  return janela.map((mes) => ({
    mes,
    rotulo: ROTULOS_MES[Number(mes.slice(5, 7)) - 1],
    valor: soma.get(mes) ?? 0n,
  }));
}
