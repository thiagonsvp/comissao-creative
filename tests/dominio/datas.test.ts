import { describe, it, expect } from 'vitest';
import { hojeNegocio, validarDataIso, dataNaoFutura } from '@/dominio/datas';
import { ErroValidacao } from '@/dominio/erros';

describe('datas do negócio', () => {
  it('hojeNegocio usa America/Sao_Paulo (UTC-3): 2026-03-01T01:00Z ainda é 28/02', () => {
    expect(hojeNegocio(new Date('2026-03-01T01:00:00Z'))).toBe('2026-02-28');
  });
  it('validarDataIso aceita YYYY-MM-DD válido e rejeita inválido', () => {
    expect(validarDataIso('2026-09-10', 'data')).toBe('2026-09-10');
    expect(() => validarDataIso('2026-13-01', 'data')).toThrow(ErroValidacao);
    expect(() => validarDataIso('10/09/2026', 'data')).toThrow(ErroValidacao);
  });
  it('dataNaoFutura rejeita amanhã', () => {
    const hoje = hojeNegocio();
    expect(dataNaoFutura(hoje, 'data')).toBe(hoje);
    const amanha = new Date(`${hoje}T12:00:00Z`); amanha.setUTCDate(amanha.getUTCDate() + 1);
    expect(() => dataNaoFutura(amanha.toISOString().slice(0, 10), 'data')).toThrow(ErroValidacao);
  });
});
