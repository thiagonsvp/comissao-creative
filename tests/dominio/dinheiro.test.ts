import { describe, it, expect } from 'vitest';
import {
  parseDecimal, paraDecimalDb, formatarBRL, parsePercentual,
  paraPercentualDb, formatarPercentual, dividirHalfUp,
} from '@/dominio/dinheiro';
import { ErroValidacao } from '@/dominio/erros';

describe('parseDecimal', () => {
  it('lê formato do banco', () => expect(parseDecimal('1234.56')).toBe(123456n));
  it('lê formato brasileiro', () => expect(parseDecimal('1.234,56')).toBe(123456n));
  it('lê inteiro e uma casa', () => {
    expect(parseDecimal('10')).toBe(1000n);
    expect(parseDecimal('10,5')).toBe(1050n);
  });
  it('rejeita três casas e lixo', () => {
    expect(() => parseDecimal('1,234')).toThrow(ErroValidacao);
    expect(() => parseDecimal('abc')).toThrow(ErroValidacao);
    expect(() => parseDecimal('')).toThrow(ErroValidacao);
  });
});

describe('formatação', () => {
  it('paraDecimalDb', () => {
    expect(paraDecimalDb(123456n)).toBe('1234.56');
    expect(paraDecimalDb(5n)).toBe('0.05');
    expect(paraDecimalDb(-5n)).toBe('-0.05');
  });
  it('formatarBRL', () => {
    expect(formatarBRL(123456789n)).toBe('R$ 1.234.567,89');
    expect(formatarBRL(0n)).toBe('R$ 0,00');
    expect(formatarBRL(-150n)).toBe('-R$ 1,50');
  });
});

describe('percentual', () => {
  it('parse e format', () => {
    expect(parsePercentual('7')).toBe(700n);
    expect(parsePercentual('7,00')).toBe(700n);
    expect(parsePercentual('0.5')).toBe(50n);
    expect(paraPercentualDb(700n)).toBe('7.00');
    expect(formatarPercentual(700n)).toBe('7,00%');
  });
  it('rejeita fora de 0..100', () => {
    expect(() => parsePercentual('100,01')).toThrow(ErroValidacao);
    expect(() => parsePercentual('-1')).toThrow(ErroValidacao);
  });
});

describe('dividirHalfUp', () => {
  it('arredonda meio para cima', () => {
    expect(dividirHalfUp(5n, 2n)).toBe(3n);
    expect(dividirHalfUp(4n, 2n)).toBe(2n);
    expect(dividirHalfUp(1n, 3n)).toBe(0n);
    expect(dividirHalfUp(2n, 3n)).toBe(1n);
    expect(dividirHalfUp(0n, 7n)).toBe(0n);
  });
  it('rejeita denominador não positivo e numerador negativo', () => {
    expect(() => dividirHalfUp(1n, 0n)).toThrow();
    expect(() => dividirHalfUp(-1n, 2n)).toThrow();
  });
});
