export class ErroValidacao extends Error {
  readonly campo: string | null;
  constructor(mensagem: string, campo?: string) {
    super(mensagem);
    this.name = 'ErroValidacao';
    this.campo = campo ?? null;
  }
}

export class ErroPermissao extends Error {
  constructor(mensagem = 'Acesso não autorizado') {
    super(mensagem);
    this.name = 'ErroPermissao';
  }
}

export class ErroConcorrencia extends Error {
  constructor(mensagem = 'O registro foi alterado por outro usuário. Recarregue e tente novamente.') {
    super(mensagem);
    this.name = 'ErroConcorrencia';
  }
}

export class ErroReserva extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroReserva';
  }
}
