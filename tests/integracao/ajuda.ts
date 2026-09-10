import { randomUUID } from 'node:crypto';

export function numeroOsTeste(sufixo: string): string {
  return `TESTE-${sufixo}-${randomUUID().slice(0, 8)}`;
}
