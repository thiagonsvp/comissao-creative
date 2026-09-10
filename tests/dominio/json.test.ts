import { describe, it, expect } from 'vitest';
import { paraJson, deJson } from '@/dominio/json';

describe('json com bigint', () => {
  it('serializa bigint como string e desserializa de volta como string', () => {
    const texto = paraJson({ valor: 123n, lista: [1n, 'x'] });
    expect(texto).toBe('{"valor":"123","lista":["1","x"]}');
    expect(deJson(texto)).toEqual({ valor: '123', lista: ['1', 'x'] });
  });
});
