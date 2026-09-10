import { ErroReserva } from './erros';
import type { Centavos } from './dinheiro';

export interface Intervalo { inicio: bigint; fim: bigint }

export function tamanho(i: Intervalo): bigint {
  return i.fim - i.inicio;
}

export function somaTamanhos(lista: Intervalo[]): bigint {
  return lista.reduce((acc, i) => acc + tamanho(i), 0n);
}

export function normalizar(lista: Intervalo[]): Intervalo[] {
  for (const i of lista) {
    if (i.inicio < 0n || i.fim <= i.inicio) {
      throw new ErroReserva(`Intervalo inválido [${i.inicio}, ${i.fim})`);
    }
  }
  const ordenados = [...lista].sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
  const resultado: Intervalo[] = [];
  for (const i of ordenados) {
    const ultimo = resultado[resultado.length - 1];
    if (ultimo && i.inicio < ultimo.fim) {
      throw new ErroReserva(`Intervalos sobrepostos: [${ultimo.inicio}, ${ultimo.fim}) e [${i.inicio}, ${i.fim})`);
    }
    if (ultimo && i.inicio === ultimo.fim) {
      resultado[resultado.length - 1] = { inicio: ultimo.inicio, fim: i.fim };
    } else {
      resultado.push({ ...i });
    }
  }
  return resultado;
}

export function subtrair(universo: Intervalo, reservados: Intervalo[]): Intervalo[] {
  const livres: Intervalo[] = [];
  let cursor = universo.inicio;
  for (const r of normalizar(reservados)) {
    if (r.fim <= cursor) continue;
    if (r.inicio >= universo.fim) break;
    if (r.inicio > cursor) livres.push({ inicio: cursor, fim: r.inicio });
    cursor = r.fim > cursor ? r.fim : cursor;
  }
  if (cursor < universo.fim) livres.push({ inicio: cursor, fim: universo.fim });
  return livres;
}

export function intervalosLivres(liberado: Centavos, reservados: Intervalo[]): Intervalo[] {
  const reservas = normalizar(reservados);
  const ultima = reservas[reservas.length - 1];
  if (ultima && ultima.fim > liberado) {
    throw new ErroReserva(`Reserva até ${ultima.fim} ultrapassa a comissão liberada ${liberado}`);
  }
  if (liberado <= 0n) return [];
  return subtrair({ inicio: 0n, fim: liberado }, reservas);
}
