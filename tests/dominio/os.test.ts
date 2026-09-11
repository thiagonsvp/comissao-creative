import { describe, expect, it } from 'vitest';
import { ErroValidacao } from '@/dominio/erros';
import { normalizarNumeroOs } from '@/dominio/os';

describe('normalizarNumeroOs', () => {
  it('remove espaços das pontas e coloca em maiúsculas', () => {
    expect(normalizarNumeroOs('  os-100 ')).toBe('OS-100');
  });

  it('preserva zeros à esquerda e caracteres internos', () => {
    expect(normalizarNumeroOs('OS-0007')).toBe('OS-0007');
    expect(normalizarNumeroOs('os 100/2026')).toBe('OS 100/2026');
  });

  it('rejeita vazio', () => {
    expect(() => normalizarNumeroOs('   ')).toThrow(ErroValidacao);
  });
});
