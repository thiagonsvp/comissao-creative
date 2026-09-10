export function paraJson(valor: unknown): string {
  return JSON.stringify(valor, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

export function deJson(texto: string): unknown {
  return JSON.parse(texto);
}
