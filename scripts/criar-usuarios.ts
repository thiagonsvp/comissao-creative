import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chaveServico) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios em .env.local',
  );
}

const admin = createClient(url, chaveServico, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface UsuarioParaCriar {
  email: string;
  senha: string;
  papel: 'admin' | 'financeiro';
}

async function criarOuAtualizarUsuario(usuario: UsuarioParaCriar) {
  const { data: existentes, error: erroBusca } = await admin.auth.admin.listUsers();
  if (erroBusca) throw erroBusca;

  const existente = existentes.users.find((item) => item.email === usuario.email);
  if (existente) {
    const { error } = await admin.auth.admin.updateUserById(existente.id, {
      app_metadata: { role: usuario.papel },
    });
    if (error) throw error;
    console.log(`Papel atualizado: ${usuario.email} -> ${usuario.papel}`);
    return;
  }

  const { error } = await admin.auth.admin.createUser({
    email: usuario.email,
    password: usuario.senha,
    email_confirm: true,
    app_metadata: { role: usuario.papel },
  });
  if (error) throw error;
  console.log(`Usuário criado: ${usuario.email} (${usuario.papel})`);
}

function lerCredencial(argumento: string) {
  const separador = argumento.indexOf(':');
  const email = separador >= 0 ? argumento.slice(0, separador) : '';
  const senha = separador >= 0 ? argumento.slice(separador + 1) : '';
  if (!email || !senha) {
    throw new Error(`Formato inválido: "${argumento}", use email:senha`);
  }
  return { email, senha };
}

async function main() {
  const usuarios = process.argv.slice(2);
  if (usuarios.length !== 2) {
    console.error(
      'Uso: tsx scripts/criar-usuarios.ts <email-thiago>:<senha-thiago> <email-financeiro>:<senha-financeiro>',
    );
    process.exitCode = 1;
    return;
  }

  const [thiago, financeiro] = usuarios.map(lerCredencial);
  await criarOuAtualizarUsuario({ ...thiago, papel: 'admin' });
  await criarOuAtualizarUsuario({ ...financeiro, papel: 'financeiro' });
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exitCode = 1;
});
