import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Executor } from '@/servidor/db';

export function numeroOsTeste(sufixo: string): string {
  return `TESTE-${sufixo}-${randomUUID().slice(0, 8)}`;
}

/**
 * Embrulha um executor SQL para registrar, em ordem, o texto literal de cada
 * comando emitido — a consulta continua rodando de verdade contra o Postgres,
 * só é observada no caminho. Existe para provar a AUSÊNCIA de uma tabela ou
 * coluna no SQL que de fato saiu, em vez de confiar no mapeamento em
 * TypeScript que converte a ausência em `null`: esse booleano não pegaria uma
 * consulta que passasse a sempre fazer o join e escondesse o rateio só na
 * hora de montar o objeto de retorno.
 *
 * Só cobre o uso de `exec` como tag de template (é assim que todas as
 * consultas do sistema o chamam); não embrulha outros métodos do postgres.js.
 */
export function espiaoSql(tx: Executor): { exec: Executor; consultas: string[] } {
  const consultas: string[] = [];
  const executarBruto = tx as unknown as (
    strings: TemplateStringsArray,
    ...valores: unknown[]
  ) => unknown;

  function exec(strings: TemplateStringsArray, ...valores: unknown[]): unknown {
    consultas.push(strings.join(''));
    return executarBruto(strings, ...valores);
  }

  return { exec: exec as unknown as Executor, consultas };
}

export async function criarUsuarioTeste(): Promise<{
  id: string;
  remover: () => Promise<void>;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chaveServico) {
    throw new Error('Credenciais do Supabase ausentes para criar o usuário de teste');
  }

  const admin = createClient(url, chaveServico, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const identificador = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email: `teste-integracao-${identificador}@example.invalid`,
    password: `Teste${identificador.replaceAll('-', '')}`,
    email_confirm: true,
    app_metadata: { role: 'admin', teste: true },
  });
  if (error) throw error;

  return {
    id: data.user.id,
    remover: async () => {
      const { error: erroRemocao } = await admin.auth.admin.deleteUser(data.user.id);
      if (erroRemocao) throw erroRemocao;
    },
  };
}
