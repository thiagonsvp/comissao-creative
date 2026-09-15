import { describe, it, expect } from 'vitest';
import {
  mesesAnteriores,
  ratearDisponivel,
  resumirComissoes,
  serieMensal,
  type ComponentesOs,
} from '@/dominio/painel';

function os(sobrescrever: Partial<ComponentesOs> = {}): ComponentesOs {
  return {
    osId: 'a',
    valorOs: 1_000_000n,
    percentualComissao: 700n,
    totalPagoCliente: 500_000n,
    comprometido: 0n,
    mesVenda: '2026-09',
    pesos: { thiago: 500n, geice: 100n, gabrielle: 100n },
    ...sobrescrever,
  };
}

describe('resumirComissoes', () => {
  it('soma total, liberada, comprometida e disponível', () => {
    const resumo = resumirComissoes([
      os(),
      os({ osId: 'b', totalPagoCliente: 1_000_000n, comprometido: 35_000n }),
    ]);
    expect(resumo.comissaoTotal).toBe(140_000n);
    expect(resumo.liberada).toBe(105_000n);
    expect(resumo.comprometida).toBe(35_000n);
    expect(resumo.disponivel).toBe(70_000n);
    expect(resumo.valorPendenteClientes).toBe(500_000n);
    expect(resumo.comissaoFutura).toBe(35_000n);
    expect(resumo.quantidadeComDisponivel).toBe(2);
  });

  it('projeta o saldo dos clientes e a comissão que ainda será liberada', () => {
    const resumo = resumirComissoes([
      os({ osId: 'a', totalPagoCliente: 0n }),
      os({ osId: 'b', totalPagoCliente: 250_000n }),
      os({ osId: 'c', totalPagoCliente: 1_000_000n }),
    ]);

    expect(resumo.valorPendenteClientes).toBe(1_750_000n);
    expect(resumo.comissaoFutura).toBe(122_500n);
  });

  it('conta OS por status de recebimento', () => {
    const resumo = resumirComissoes([
      os({ osId: 'a', totalPagoCliente: 0n }),
      os({ osId: 'b', totalPagoCliente: 500_000n }),
      os({ osId: 'c', totalPagoCliente: 1_000_000n }),
    ]);
    expect(resumo.porStatus).toEqual({ aberta: 1, parcial: 1, quitada: 1 });
  });

  it('nunca devolve disponível negativo', () => {
    const resumo = resumirComissoes([os({ totalPagoCliente: 0n, comprometido: 1_000n })]);
    expect(resumo.disponivel).toBe(0n);
  });

  it('lista vazia devolve zeros', () => {
    const resumo = resumirComissoes([]);
    expect(resumo.disponivel).toBe(0n);
    expect(resumo.valorPendenteClientes).toBe(0n);
    expect(resumo.comissaoFutura).toBe(0n);
    expect(resumo.quantidadeComDisponivel).toBe(0);
  });
});

describe('ratearDisponivel', () => {
  it('rateia o próximo trecho de cada OS pelo rateio dela', () => {
    // R$ 350,00 disponíveis com 5/1/1 => 250 / 50 / 50
    expect(ratearDisponivel([os()])).toEqual({
      thiago: 25_000n,
      geice: 5_000n,
      gabrielle: 5_000n,
    });
  });

  it('soma OS com rateios diferentes', () => {
    const resultado = ratearDisponivel([
      os(),
      os({ osId: 'b', pesos: { thiago: 700n, geice: 0n, gabrielle: 0n } }),
    ]);
    expect(resultado).toEqual({ thiago: 60_000n, geice: 5_000n, gabrielle: 5_000n });
  });

  it('parte já comprometida não entra no rateio', () => {
    const resultado = ratearDisponivel([
      os({ totalPagoCliente: 1_000_000n, comprometido: 35_000n }),
    ]);
    expect(resultado).toEqual({ thiago: 25_000n, geice: 5_000n, gabrielle: 5_000n });
  });

  it('ignora OS sem pesos visíveis e OS sem disponível', () => {
    expect(ratearDisponivel([os({ pesos: null })])).toEqual({
      thiago: 0n,
      geice: 0n,
      gabrielle: 0n,
    });
    expect(ratearDisponivel([os({ totalPagoCliente: 0n })])).toEqual({
      thiago: 0n,
      geice: 0n,
      gabrielle: 0n,
    });
  });
});

describe('mesesAnteriores', () => {
  it('devolve a janela em ordem cronológica e atravessa o ano', () => {
    expect(mesesAnteriores('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('serieMensal', () => {
  it('agrupa pela venda, preenche meses sem venda com zero e rotula em português', () => {
    const pontos = serieMensal(
      [os({ mesVenda: '2026-09' }), os({ osId: 'b', mesVenda: '2026-09' }), os({ osId: 'c', mesVenda: '2026-07' })],
      '2026-09',
      3,
    );
    expect(pontos).toEqual([
      { mes: '2026-07', rotulo: 'jul', valor: 70_000n },
      { mes: '2026-08', rotulo: 'ago', valor: 0n },
      { mes: '2026-09', rotulo: 'set', valor: 140_000n },
    ]);
  });

  it('ignora vendas fora da janela', () => {
    const pontos = serieMensal([os({ mesVenda: '2020-01' })], '2026-09', 2);
    expect(pontos.every((p) => p.valor === 0n)).toBe(true);
  });
});
