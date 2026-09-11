import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export function numeroOsTeste(sufixo: string): string {
  return `TESTE-${sufixo}-${randomUUID().slice(0, 8)}`;
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
