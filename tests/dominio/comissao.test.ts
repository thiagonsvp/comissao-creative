import { describe, it, expect } from 'vitest';
import { comissaoTotal, comissaoLiberada, statusRecebimento, totalPagoCliente } from '@/dominio/comissao';

describe('comissaoTotal', () => {
  it('7% de R$ 10.000,00 = R$ 700,00', () => expect(comissaoTotal(1_000_000n, 700n)).toBe(70_000n));
  it('arredonda half-up: 7% de R$ 0,07 = R$ 0,0049 -> R$ 0,00; 7% de R$ 0,08 = 0,0056 -> R$ 0,01', () => {
    expect(comissaoTotal(7n, 700n)).toBe(0n);
    expect(comissaoTotal(8n, 700n)).toBe(1n);
  });
  it('percentual zero', () => expect(comissaoTotal(1_000_000n, 0n)).toBe(0n));
});

describe('comissaoLiberada', () => {
  it('proporcional ao pago', () => expect(comissaoLiberada(70_000n, 500_000n, 1_000_000n)).toBe(35_000n));
  it('quitação devolve exatamente a total mesmo com arredondamento', () => {
    expect(comissaoLiberada(1n, 8n, 8n)).toBe(1n);
  });
  it('nada pago = zero', () => expect(comissaoLiberada(70_000n, 0n, 1_000_000n)).toBe(0n));
  it('half-up no meio centavo: total 1 centavo, pago 50% -> 1', () => {
    expect(comissaoLiberada(1n, 1n, 2n)).toBe(1n);
  });
});

describe('statusRecebimento', () => {
  it('aberta / parcial / quitada', () => {
    expect(statusRecebimento(0n, 100n)).toBe('aberta');
    expect(statusRecebimento(1n, 100n)).toBe('parcial');
    expect(statusRecebimento(100n, 100n)).toBe('quitada');
  });
});

describe('totalPagoCliente', () => {
  it('soma recebimentos e subtrai estornos', () => {
    expect(totalPagoCliente([
      { tipo: 'recebimento', valor: 100n },
      { tipo: 'recebimento', valor: 50n },
      { tipo: 'estorno', valor: 30n },
    ])).toBe(120n);
  });
});
