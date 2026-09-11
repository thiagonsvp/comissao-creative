import { describe, expect, it } from 'vitest';
import { papelDoUsuario } from '@/servidor/auth';

describe('papelDoUsuario', () => {
  it('reconhece admin e financeiro', () => {
    expect(papelDoUsuario({ role: 'admin' })).toBe('admin');
    expect(papelDoUsuario({ role: 'financeiro' })).toBe('financeiro');
  });

  it('rejeita papel desconhecido ou ausente', () => {
    expect(papelDoUsuario({ role: 'outro' })).toBeNull();
    expect(papelDoUsuario({})).toBeNull();
  });
});
