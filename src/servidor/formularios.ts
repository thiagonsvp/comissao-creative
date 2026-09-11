import {
  ErroConcorrencia,
  ErroPermissao,
  ErroReserva,
  ErroValidacao,
} from '@/dominio/erros';

export interface EstadoFormulario {
  erroGeral: string | null;
  errosPorCampo: Record<string, string>;
}

export const ESTADO_INICIAL_FORMULARIO: EstadoFormulario = {
  erroGeral: null,
  errosPorCampo: {},
};

export function tratarErroFormulario(erro: unknown): EstadoFormulario {
  if (erro instanceof ErroValidacao) {
    return erro.campo
      ? { erroGeral: null, errosPorCampo: { [erro.campo]: erro.message } }
      : { erroGeral: erro.message, errosPorCampo: {} };
  }

  if (
    erro instanceof ErroPermissao ||
    erro instanceof ErroConcorrencia ||
    erro instanceof ErroReserva
  ) {
    return { erroGeral: erro.message, errosPorCampo: {} };
  }

  console.error(erro);
  return {
    erroGeral: 'Ocorreu um erro inesperado. Tente novamente.',
    errosPorCampo: {},
  };
}
