import { describe, it, expect } from 'vitest';
import {
  motivoDeRecusaPorComissao,
  motivoDeRecusaPorLoteAtivo,
  type LoteQueReserva,
} from '@/dominio/travas';

const enviado: LoteQueReserva = {
  numero: 14,
  estadoConferencia: 'enviado',
  valorReservado: 70_000n,
};
const aprovado: LoteQueReserva = {
  numero: 12,
  estadoConferencia: 'aprovado',
  valorReservado: 50_000n,
};

describe('motivoDeRecusaPorComissao', () => {
  it('permite quando nada está comprometido', () => {
    expect(motivoDeRecusaPorComissao(0n, 0n, [])).toBeNull();
  });

  it('permite quando a liberada nova ainda cobre o comprometido', () => {
    expect(motivoDeRecusaPorComissao(70_000n, 70_000n, [enviado])).toBeNull();
  });

  it('permite aumento de valor mesmo com lote aprovado', () => {
    expect(motivoDeRecusaPorComissao(200_000n, 50_000n, [aprovado])).toBeNull();
  });

  it('recusa quando a liberada nova fica abaixo do comprometido, citando o lote', () => {
    const motivo = motivoDeRecusaPorComissao(42_000n, 70_000n, [enviado]);
    expect(motivo).toContain('lote 14');
    expect(motivo).toContain('R$ 700,00');
    expect(motivo).toContain('Cancele');
  });

  it('quando há lote aprovado, a recusa é definitiva e cita a diferença', () => {
    const motivo = motivoDeRecusaPorComissao(42_000n, 50_000n, [aprovado]);
    expect(motivo).toContain('lote 12');
    expect(motivo).toContain('aprovado');
    expect(motivo).toContain('R$ 80,00');
    expect(motivo).toContain('desfaça');
  });

  it('com vários lotes pendentes, cita o mais recente e a quantidade', () => {
    const outro: LoteQueReserva = {
      numero: 9,
      estadoConferencia: 'enviado',
      valorReservado: 10_000n,
    };
    const motivo = motivoDeRecusaPorComissao(0n, 80_000n, [outro, enviado]);
    expect(motivo).toContain('lote 14');
    expect(motivo).toContain('2 lotes');
  });

  it('lote aprovado tem precedência sobre pendente na mensagem', () => {
    const motivo = motivoDeRecusaPorComissao(0n, 120_000n, [enviado, aprovado]);
    expect(motivo).toContain('lote 12');
    expect(motivo).toContain('aprovado');
  });
});

describe('motivoDeRecusaPorLoteAtivo', () => {
  it('permite sem lote nenhum', () => {
    expect(motivoDeRecusaPorLoteAtivo([])).toBeNull();
  });

  it('recusa com lote pendente, mandando cancelar', () => {
    const motivo = motivoDeRecusaPorLoteAtivo([enviado]);
    expect(motivo).toContain('lote 14');
    expect(motivo).toContain('Cancele');
  });

  it('recusa com lote aprovado, mandando desfazer', () => {
    const motivo = motivoDeRecusaPorLoteAtivo([aprovado]);
    expect(motivo).toContain('lote 12');
    expect(motivo).toContain('desfaça');
  });
});
