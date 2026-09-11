import { describe, it, expect } from 'vitest';
import { calcularItensLote, resumoComissaoOs, totalItens, type OsParaLote } from '@/dominio/lote';
import { ErroValidacao } from '@/dominio/erros';

function os(sobrescrever: Partial<OsParaLote> = {}): OsParaLote {
  return {
    osId: '11111111-1111-1111-1111-111111111111', numeroOs: 'OS-100', numeroOsNormalizado: 'OS-100',
    cliente: 'Cliente A', produto: 'Produto X', valorOs: 1_000_000n, percentualComissao: 700n,
    totalPagoCliente: 500_000n, reservasAtivas: [], pesos: { thiago: 500n, geice: 100n, gabrielle: 100n },
    ...sobrescrever,
  };
}

describe('resumoComissaoOs', () => {
  it('R$ 10.000 com 50% pago: total 700, liberada 350, disponível 350', () => {
    const r = resumoComissaoOs(os());
    expect(r.comissaoTotal).toBe(70_000n);
    expect(r.comissaoLiberada).toBe(35_000n);
    expect(r.comissaoComprometida).toBe(0n);
    expect(r.comissaoDisponivel).toBe(35_000n);
    expect(r.livres).toEqual([{ inicio: 0n, fim: 35_000n }]);
  });
  it('com reserva anterior, disponível é o restante', () => {
    const r = resumoComissaoOs(os({ totalPagoCliente: 1_000_000n, reservasAtivas: [{ inicio: 0n, fim: 35_000n }] }));
    expect(r.comissaoComprometida).toBe(35_000n);
    expect(r.comissaoDisponivel).toBe(35_000n);
    expect(r.livres).toEqual([{ inicio: 35_000n, fim: 70_000n }]);
  });
});

describe('calcularItensLote', () => {
  it('fluxo nominal do spec: item de R$ 350 rateado 250/50/50 com snapshots', () => {
    const [item] = calcularItensLote([os()]);
    expect(item.ordem).toBe(1);
    expect(item.inicio).toBe(0n); expect(item.fim).toBe(35_000n);
    expect(item.valorComissao).toBe(35_000n);
    expect(item.rateio).toEqual({ thiago: 25_000n, geice: 5_000n, gabrielle: 5_000n });
    expect(item.snapshot).toEqual({
      numeroOs: 'OS-100', cliente: 'Cliente A', produto: 'Produto X', valorOs: 1_000_000n, percentualComissao: 700n,
      totalPagoCliente: 500_000n, comissaoLiberada: 35_000n, comissaoComprometidaAnterior: 0n,
    });
  });
  it('segundo envio após quitação reserva só o novo trecho', () => {
    const [item] = calcularItensLote([os({ totalPagoCliente: 1_000_000n, reservasAtivas: [{ inicio: 0n, fim: 35_000n }] })]);
    expect(item.inicio).toBe(35_000n); expect(item.fim).toBe(70_000n);
    expect(item.rateio).toEqual({ thiago: 25_000n, geice: 5_000n, gabrielle: 5_000n });
    expect(item.snapshot.comissaoComprometidaAnterior).toBe(35_000n);
  });
  it('ordena por número normalizado e depois id; ordem sequencial', () => {
    const itens = calcularItensLote([
      os({ osId: 'b', numeroOsNormalizado: 'OS-200', numeroOs: 'OS-200' }),
      os({ osId: 'a', numeroOsNormalizado: 'OS-100' }),
    ]);
    expect(itens.map((i) => [i.ordem, i.snapshot.numeroOs])).toEqual([[1, 'OS-100'], [2, 'OS-200']]);
  });
  it('OS sem disponível é ignorada; nenhuma disponível é erro', () => {
    expect(calcularItensLote([os(), os({ osId: 'z', numeroOsNormalizado: 'Z', totalPagoCliente: 0n })])).toHaveLength(1);
    expect(() => calcularItensLote([os({ totalPagoCliente: 0n })])).toThrow(ErroValidacao);
  });
  it('rateio inválido da OS é rejeitado', () => {
    expect(() => calcularItensLote([os({ pesos: { thiago: 500n, geice: 100n, gabrielle: 0n } })])).toThrow(ErroValidacao);
  });
  it('totalItens soma os itens', () => {
    expect(totalItens(calcularItensLote([os(), os({ osId: 'c', numeroOsNormalizado: 'C' })]))).toBe(70_000n);
  });
});
