import { type Centavos, type Percentual, dividirHalfUp } from './dinheiro';

export type StatusRecebimento = 'aberta' | 'parcial' | 'quitada';

export function comissaoTotal(valorOs: Centavos, percentual: Percentual): Centavos {
  return dividirHalfUp(valorOs * percentual, 10000n);
}

export function comissaoLiberada(comissaoTotalOs: Centavos, totalPago: Centavos, valorOs: Centavos): Centavos {
  if (totalPago <= 0n) return 0n;
  if (totalPago >= valorOs) return comissaoTotalOs;
  return dividirHalfUp(comissaoTotalOs * totalPago, valorOs);
}

export function statusRecebimento(totalPago: Centavos, valorOs: Centavos): StatusRecebimento {
  if (totalPago <= 0n) return 'aberta';
  if (totalPago >= valorOs) return 'quitada';
  return 'parcial';
}

export function totalPagoCliente(baixas: { tipo: 'recebimento' | 'estorno'; valor: Centavos }[]): Centavos {
  return baixas.reduce((acc, b) => (b.tipo === 'recebimento' ? acc + b.valor : acc - b.valor), 0n);
}
