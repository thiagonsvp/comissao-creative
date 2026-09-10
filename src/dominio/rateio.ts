import { ErroValidacao } from './erros';
import type { Percentual } from './dinheiro';

export const ORDEM_PESSOAS = ['thiago', 'geice', 'gabrielle'] as const;
export type Pessoa = (typeof ORDEM_PESSOAS)[number];
export type PorPessoa = Record<Pessoa, bigint>;
export const ALGORITMO_RATEIO = 'divisores_v1';
export const ZERO_POR_PESSOA: PorPessoa = { thiago: 0n, geice: 0n, gabrielle: 0n };

export function somaPorPessoa(a: PorPessoa, b: PorPessoa): PorPessoa {
  return { thiago: a.thiago + b.thiago, geice: a.geice + b.geice, gabrielle: a.gabrielle + b.gabrielle };
}

function somaPesos(p: PorPessoa): bigint {
  return p.thiago + p.geice + p.gabrielle;
}

// Maior peso/(atribuido+1), comparado por multiplicação cruzada; empate mantém a ordem fixa.
function escolherProxima(pesos: PorPessoa, atribuido: PorPessoa): Pessoa {
  let melhor: Pessoa | null = null;
  for (const p of ORDEM_PESSOAS) {
    if (pesos[p] === 0n) continue;
    if (melhor === null) { melhor = p; continue; }
    if (pesos[p] * (atribuido[melhor] + 1n) > pesos[melhor] * (atribuido[p] + 1n)) melhor = p;
  }
  if (melhor === null) throw new Error('Todos os pesos são zero; só n = 0 é permitido');
  return melhor;
}

export function acumuladoReferencia(pesos: PorPessoa, n: bigint): PorPessoa {
  if (n < 0n) throw new Error('n não pode ser negativo');
  const a: PorPessoa = { ...ZERO_POR_PESSOA };
  for (let i = 0n; i < n; i++) a[escolherProxima(pesos, a)] += 1n;
  return a;
}

export function acumulado(pesos: PorPessoa, n: bigint): PorPessoa {
  if (n < 0n) throw new Error('n não pode ser negativo');
  if (n === 0n) return { ...ZERO_POR_PESSOA };
  const W = somaPesos(pesos);
  if (W <= 0n) throw new Error('Todos os pesos são zero; só n = 0 é permitido');
  const a: PorPessoa = {
    thiago: (n * pesos.thiago) / W,
    geice: (n * pesos.geice) / W,
    gabrielle: (n * pesos.gabrielle) / W,
  };
  let restantes = n - somaPesos(a);
  while (restantes > 0n) { a[escolherProxima(pesos, a)] += 1n; restantes -= 1n; }
  return a;
}

export function ratearIntervalo(pesos: PorPessoa, inicio: bigint, fim: bigint): PorPessoa {
  if (inicio < 0n || fim < inicio) throw new Error(`Intervalo inválido [${inicio}, ${fim})`);
  const b = acumulado(pesos, fim);
  const a = acumulado(pesos, inicio);
  return { thiago: b.thiago - a.thiago, geice: b.geice - a.geice, gabrielle: b.gabrielle - a.gabrielle };
}

export function validarPesos(pesos: PorPessoa, percentualTotal: Percentual): void {
  for (const p of ORDEM_PESSOAS) {
    if (pesos[p] < 0n || pesos[p] > 10000n) {
      throw new ErroValidacao(`Percentual de ${p} deve estar entre 0 e 100`, `rateio_${p}`);
    }
  }
  if (somaPesos(pesos) !== percentualTotal) {
    throw new ErroValidacao('A soma do rateio deve ser igual ao percentual total de comissão');
  }
}
