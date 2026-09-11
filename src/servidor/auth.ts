import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/dominio/erros';
import { criarClienteServidor } from './supabase/servidor';

export type Papel = 'admin' | 'financeiro';

export interface Sessao {
  userId: string;
  email: string;
  papel: Papel;
}

export function papelDoUsuario(appMetadata: Record<string, unknown>): Papel | null {
  const role = appMetadata.role;
  return role === 'admin' || role === 'financeiro' ? role : null;
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const papel = papelDoUsuario(user.app_metadata ?? {});
  if (!papel) return null;
  return { userId: user.id, email: user.email, papel };
}

export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) throw new ErroPermissao('É necessário entrar no sistema');
  return sessao;
}

export async function exigirPapel(papel: Papel): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel !== papel) {
    throw new ErroPermissao('Você não tem permissão para esta ação');
  }
  return sessao;
}

/**
 * Versão para páginas (Server Components). Em produção o Next.js oculta a
 * mensagem de qualquer erro lançado na renderização e devolve 500, então
 * lançar `ErroPermissao` numa página viraria um erro técnico ilegível.
 * Aqui redirecionamos para telas próprias; nas server actions continua
 * valendo `exigirSessao`/`exigirPapel`, cujo erro o formulário exibe.
 */
export async function sessaoDaPagina(papel?: Papel): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  if (papel && sessao.papel !== papel) redirect('/sem-permissao');
  return sessao;
}
