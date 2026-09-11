import { ErroValidacao } from './erros';

export type Centavos = bigint;
export type Percentual = bigint; // centésimos de ponto percentual: 7,00% => 700n

const RE_DECIMAL = /^-?\d+(\.\d{1,2})?$/;

function normalizarTexto(texto: string): string {
  const t = texto.trim();
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
}

function parseDuasCasas(texto: string, rotulo: string): bigint {
  const n = normalizarTexto(texto);
  if (!RE_DECIMAL.test(n)) throw new ErroValidacao(`${rotulo} inválido: "${texto}"`);
  const negativo = n.startsWith('-');
  const [inteiro, fracao = ''] = n.replace('-', '').split('.');
  const valor = BigInt(inteiro) * 100n + BigInt(fracao.padEnd(2, '0'));
  return negativo ? -valor : valor;
}

export function parseDecimal(texto: string): Centavos {
  return parseDuasCasas(texto, 'Valor');
}

export function paraDecimalDb(c: bigint): string {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  return `${neg ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

export function formatarBRL(c: Centavos): string {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  const inteiro = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}R$ ${inteiro},${(abs % 100n).toString().padStart(2, '0')}`;
}

export function parsePercentual(texto: string): Percentual {
  const p = parseDuasCasas(texto, 'Percentual');
  if (p < 0n || p > 10000n) throw new ErroValidacao('Percentual deve estar entre 0 e 100');
  return p;
}

export function paraPercentualDb(p: Percentual): string {
  return paraDecimalDb(p);
}

export function formatarPercentual(p: Percentual): string {
  return `${p / 100n},${(p % 100n).toString().padStart(2, '0')}%`;
}

export function dividirHalfUp(numerador: bigint, denominador: bigint): bigint {
  if (denominador <= 0n) throw new Error('Denominador deve ser positivo');
  if (numerador < 0n) throw new Error('Numerador não pode ser negativo');
  return (numerador * 2n + denominador) / (denominador * 2n);
}
