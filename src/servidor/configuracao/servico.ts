import type postgres from 'postgres';
import { validarPesos } from '@/dominio/rateio';
import { paraPercentualDb, type Percentual } from '@/dominio/dinheiro';
import { registrarAuditoria } from '@/servidor/auditoria';
import { sql } from '@/servidor/db';

export interface Configuracao {
  percentualComissaoPadrao: Percentual;
  rateioThiagoPadrao: Percentual;
  rateioGeicePadrao: Percentual;
  rateioGabriellePadrao: Percentual;
}

export async function obterConfiguracao(): Promise<Configuracao> {
  const [linha] = await sql`
    select
      cc.percentual_comissao_padrao,
      cr.rateio_thiago_padrao,
      cr.rateio_geice_padrao,
      cr.rateio_gabrielle_padrao
    from public.configuracao_comercial cc
    join interno.configuracao_rateio cr on cr.configuracao_id = cc.id
    where cc.id = 1
  `;
  return {
    percentualComissaoPadrao: BigInt(
      Math.round(Number(linha.percentual_comissao_padrao) * 100),
    ),
    rateioThiagoPadrao: BigInt(Math.round(Number(linha.rateio_thiago_padrao) * 100)),
    rateioGeicePadrao: BigInt(Math.round(Number(linha.rateio_geice_padrao) * 100)),
    rateioGabriellePadrao: BigInt(
      Math.round(Number(linha.rateio_gabrielle_padrao) * 100),
    ),
  };
}

export async function atualizarConfiguracao(
  tx: postgres.TransactionSql,
  dados: Configuracao,
  usuarioId: string,
): Promise<void> {
  validarPesos(
    {
      thiago: dados.rateioThiagoPadrao,
      geice: dados.rateioGeicePadrao,
      gabrielle: dados.rateioGabriellePadrao,
    },
    dados.percentualComissaoPadrao,
  );

  await tx`
    update public.configuracao_comercial
    set percentual_comissao_padrao = ${paraPercentualDb(dados.percentualComissaoPadrao)},
        atualizado_em = now(),
        atualizado_por = ${usuarioId}
    where id = 1
  `;
  await tx`
    update interno.configuracao_rateio
    set rateio_thiago_padrao = ${paraPercentualDb(dados.rateioThiagoPadrao)},
        rateio_geice_padrao = ${paraPercentualDb(dados.rateioGeicePadrao)},
        rateio_gabrielle_padrao = ${paraPercentualDb(dados.rateioGabriellePadrao)},
        atualizado_em = now(),
        atualizado_por = ${usuarioId}
    where configuracao_id = 1
  `;
  await registrarAuditoria(tx, {
    entidade: 'configuracao_comercial',
    entidadeId: '00000000-0000-0000-0000-000000000001',
    acao: 'atualizar',
    responsavelId: usuarioId,
    valoresNovos: dados,
  });
}
