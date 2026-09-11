import { ErroValidacao } from './erros';

export function normalizarNumeroOs(texto: string): string {
  const normalizado = texto.trim().toUpperCase();
  if (normalizado === '') {
    throw new ErroValidacao('Número da OS é obrigatório', 'numeroOs');
  }
  return normalizado;
}
