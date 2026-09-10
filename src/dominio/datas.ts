import { ErroValidacao } from './erros';

export const FUSO_NEGOCIO = 'America/Sao_Paulo';
const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function hojeNegocio(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_NEGOCIO, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora);
}

export function validarDataIso(texto: string, campo: string): string {
  if (!RE_ISO.test(texto)) throw new ErroValidacao('Data inválida', campo);
  const d = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto) {
    throw new ErroValidacao('Data inválida', campo);
  }
  return texto;
}

export function dataNaoFutura(texto: string, campo: string): string {
  const data = validarDataIso(texto, campo);
  if (data > hojeNegocio()) throw new ErroValidacao('A data não pode ser futura', campo);
  return data;
}

export function formatarDataBr(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
