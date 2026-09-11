import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  acumulado, acumuladoReferencia, ratearIntervalo, validarPesos, type PorPessoa,
} from '@/dominio/rateio';
import { ErroValidacao } from '@/dominio/erros';

const P = (t: number, g: number, b: number): PorPessoa => ({ thiago: BigInt(t), geice: BigInt(g), gabrielle: BigInt(b) });
const PADRAO = P(500, 100, 100);
const soma = (a: PorPessoa) => a.thiago + a.geice + a.gabrielle;
const arbPesos = fc.tuple(fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 0, max: 10000 }))
  .filter(([t, g, b]) => t + g + b > 0).map(([t, g, b]) => P(t, g, b));

describe('acumuladoReferencia', () => {
  it('n = 0 -> zeros', () => expect(acumuladoReferencia(PADRAO, 0n)).toEqual(P(0, 0, 0)));
  it('7 centavos com 5/1/1 -> 5/1/1', () => expect(acumuladoReferencia(PADRAO, 7n)).toEqual(P(5, 1, 1)));
  it('desempate na ordem Thiago, Geice, Gabrielle', () => {
    expect(acumuladoReferencia(P(1, 1, 1), 1n)).toEqual(P(1, 0, 0));
    expect(acumuladoReferencia(P(1, 1, 1), 2n)).toEqual(P(1, 1, 0));
  });
  it('peso zero nunca recebe', () => expect(acumuladoReferencia(P(0, 1, 1), 5n).thiago).toBe(0n));
});

describe('acumulado (otimizado)', () => {
  it('exemplo do spec: R$ 350,00 com 5/1/1 -> 250/50/50', () => {
    expect(acumulado(PADRAO, 35000n)).toEqual(P(25000, 5000, 5000));
  });
  it('todos os pesos zero: só n = 0 permitido', () => {
    expect(acumulado(P(0, 0, 0), 0n)).toEqual(P(0, 0, 0));
    expect(() => acumulado(P(0, 0, 0), 1n)).toThrow();
  });
  it('n negativo é erro', () => expect(() => acumulado(PADRAO, -1n)).toThrow());
  it('equivale ao algoritmo de referência', () => {
    fc.assert(fc.property(arbPesos, fc.integer({ min: 0, max: 3000 }), (pesos, n) => {
      expect(acumulado(pesos, BigInt(n))).toEqual(acumuladoReferencia(pesos, BigInt(n)));
    }), { numRuns: 300 });
  });
  it('propriedades: soma exata, monotonicidade, não negatividade', () => {
    fc.assert(fc.property(arbPesos, fc.integer({ min: 0, max: 100000 }), (pesos, n) => {
      const a = acumulado(pesos, BigInt(n));
      const b = acumulado(pesos, BigInt(n) + 1n);
      expect(soma(a)).toBe(BigInt(n));
      for (const p of ['thiago', 'geice', 'gabrielle'] as const) {
        expect(a[p] >= 0n).toBe(true);
        expect(b[p] >= a[p]).toBe(true);
        if (pesos[p] === 0n) expect(a[p]).toBe(0n);
      }
    }));
  });
});

describe('ratearIntervalo', () => {
  it('fracionar em trechos não altera os totais', () => {
    fc.assert(fc.property(arbPesos, fc.integer({ min: 0, max: 50000 }), fc.integer({ min: 0, max: 50000 }), fc.integer({ min: 0, max: 50000 }),
      (pesos, a, b, c) => {
        const [x, y, z] = [a, b, c].sort((i, j) => i - j).map(BigInt);
        const inteiro = ratearIntervalo(pesos, x, z);
        const p1 = ratearIntervalo(pesos, x, y);
        const p2 = ratearIntervalo(pesos, y, z);
        expect(p1.thiago + p2.thiago).toBe(inteiro.thiago);
        expect(p1.geice + p2.geice).toBe(inteiro.geice);
        expect(p1.gabrielle + p2.gabrielle).toBe(inteiro.gabrielle);
        expect(soma(inteiro)).toBe(z - x);
      }));
  });
  it('rejeita intervalo invertido', () => expect(() => ratearIntervalo(PADRAO, 5n, 3n)).toThrow());
});

describe('validarPesos', () => {
  it('aceita 5/1/1 para 7%', () => expect(() => validarPesos(PADRAO, 700n)).not.toThrow());
  it('rejeita soma diferente do total', () => expect(() => validarPesos(P(500, 100, 50), 700n)).toThrow(ErroValidacao));
  it('rejeita negativo', () => expect(() => validarPesos(P(800, -100, 0), 700n)).toThrow(ErroValidacao));
  it('total zero exige todos zero', () => {
    expect(() => validarPesos(P(0, 0, 0), 0n)).not.toThrow();
  });
});
