import { describe, expect, it, vi } from 'vitest';
import { ErroPermissao, ErroValidacao } from '@/dominio/erros';
import {
  ESTADO_INICIAL_FORMULARIO,
  tratarErroFormulario,
} from '@/servidor/formularios';

describe('tratarErroFormulario', () => {
  it('erro de validação com campo vira erro daquele campo', () => {
    const resultado = tratarErroFormulario(new ErroValidacao('Valor inválido', 'valor'));
    expect(resultado.errosPorCampo).toEqual({ valor: 'Valor inválido' });
    expect(resultado.erroGeral).toBeNull();
  });

  it('erro de validação sem campo vira erro geral', () => {
    const resultado = tratarErroFormulario(new ErroValidacao('Nenhuma comissão disponível'));
    expect(resultado.erroGeral).toBe('Nenhuma comissão disponível');
    expect(resultado.errosPorCampo).toEqual({});
  });

  it('erro de permissão vira erro geral', () => {
    expect(tratarErroFormulario(new ErroPermissao()).erroGeral).toBe(
      'Acesso não autorizado',
    );
  });

  it('erro desconhecido vira mensagem genérica', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(tratarErroFormulario(new Error('boom')).erroGeral).toBe(
      'Ocorreu um erro inesperado. Tente novamente.',
    );
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('estado inicial não tem erros', () => {
    expect(ESTADO_INICIAL_FORMULARIO).toEqual({ erroGeral: null, errosPorCampo: {} });
  });
});
