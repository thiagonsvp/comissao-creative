import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizar, subtrair, intervalosLivres, somaTamanhos, type Intervalo } from '@/dominio/intervalos';
import { ErroReserva } from '@/dominio/erros';

const iv = (a: number, b: number): Intervalo => ({ inicio: BigInt(a), fim: BigInt(b) });

describe('normalizar', () => {
  it('ordena e funde adjacentes', () => {
    expect(normalizar([iv(50, 70), iv(0, 50)])).toEqual([iv(0, 70)]);
  });
  it('mantém separados os não adjacentes', () => {
    expect(normalizar([iv(60, 70), iv(0, 50)])).toEqual([iv(0, 50), iv(60, 70)]);
  });
  it('rejeita sobreposição e intervalos vazios/negativos', () => {
    expect(() => normalizar([iv(0, 50), iv(49, 60)])).toThrow(ErroReserva);
    expect(() => normalizar([iv(5, 5)])).toThrow(ErroReserva);
    expect(() => normalizar([iv(-1, 5)])).toThrow(ErroReserva);
  });
});

describe('subtrair', () => {
  it('sem reservas devolve o universo', () => expect(subtrair(iv(0, 100), [])).toEqual([iv(0, 100)]));
  it('reserva no meio gera dois livres', () => {
    expect(subtrair(iv(0, 100), [iv(30, 60)])).toEqual([iv(0, 30), iv(60, 100)]);
  });
  it('reserva cobrindo tudo devolve vazio', () => expect(subtrair(iv(0, 100), [iv(0, 100)])).toEqual([]));
  it('reservas fora do universo são ignoradas', () => {
    expect(subtrair(iv(0, 100), [iv(100, 150)])).toEqual([iv(0, 100)]);
  });
});

describe('intervalosLivres', () => {
  it('exemplo do spec: 7000 liberados, [0,3500) reservado -> [3500,7000)', () => {
    expect(intervalosLivres(7000n, [iv(0, 3500)])).toEqual([iv(3500, 7000)]);
  });
  it('liberado zero -> nada', () => expect(intervalosLivres(0n, [])).toEqual([]));
  it('reserva além do liberado é erro de reserva', () => {
    expect(() => intervalosLivres(3000n, [iv(0, 3500)])).toThrow(ErroReserva);
  });
  it('propriedade: livres + reservados = liberado, sem sobreposição', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5000 }),
      fc.array(fc.tuple(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 1, max: 200 })), { maxLength: 10 }),
      (liberado, pares) => {
        // constrói reservas disjuntas dentro de [0, liberado)
        const reservas: Intervalo[] = [];
        let cursor = 0;
        for (const [salto, tam] of pares.sort((a, b) => a[0] - b[0])) {
          const inicio = Math.max(cursor, salto);
          const fim = Math.min(inicio + tam, liberado);
          if (fim > inicio) { reservas.push(iv(inicio, fim)); cursor = fim; }
        }
        const livres = intervalosLivres(BigInt(liberado), reservas);
        expect(somaTamanhos(livres) + somaTamanhos(reservas)).toBe(BigInt(liberado));
        expect(() => normalizar([...livres, ...reservas])).not.toThrow();
      },
    ));
  });
});
