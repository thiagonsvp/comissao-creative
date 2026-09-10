import { describe, it, expect } from 'vitest';
import { ErroValidacao, ErroPermissao, ErroConcorrencia, ErroReserva } from '@/dominio/erros';

describe('erros de domínio', () => {
  it('ErroValidacao guarda mensagem e campo', () => {
    const e = new ErroValidacao('Valor inválido', 'valor');
    expect(e.message).toBe('Valor inválido');
    expect(e.campo).toBe('valor');
    expect(e).toBeInstanceOf(Error);
  });
  it('demais erros são instâncias de Error com nome próprio', () => {
    expect(new ErroPermissao().name).toBe('ErroPermissao');
    expect(new ErroConcorrencia().name).toBe('ErroConcorrencia');
    expect(new ErroReserva('x').name).toBe('ErroReserva');
  });
});
