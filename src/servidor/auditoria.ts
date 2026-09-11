import type postgres from 'postgres';
import { paraJson } from '@/dominio/json';

export interface EventoAuditoria {
  entidade: string;
  entidadeId: string;
  acao: string;
  responsavelId: string;
  dataEfetiva?: string;
  motivo?: string;
  valoresAnteriores?: unknown;
  valoresNovos?: unknown;
  operacaoId?: string;
}

function paraJsonb(tx: postgres.TransactionSql, valor: unknown) {
  return valor === undefined ? null : tx.json(JSON.parse(paraJson(valor)));
}

export async function registrarAuditoria(
  tx: postgres.TransactionSql,
  evento: EventoAuditoria,
): Promise<void> {
  await tx`
    insert into interno.auditoria_evento
      (entidade, entidade_id, acao, responsavel_id, data_efetiva, motivo, valores_anteriores, valores_novos, operacao_id)
    values (
      ${evento.entidade}, ${evento.entidadeId}, ${evento.acao}, ${evento.responsavelId},
      ${evento.dataEfetiva ?? null}, ${evento.motivo ?? null},
      ${paraJsonb(tx, evento.valoresAnteriores)}, ${paraJsonb(tx, evento.valoresNovos)},
      ${evento.operacaoId ?? null}
    )
  `;
}
