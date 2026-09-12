import Link from 'next/link';
import { hojeNegocio } from '@/dominio/datas';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterConfiguracao } from '@/servidor/configuracao/servico';
import { FormularioOs } from '../FormularioOs';

export default async function PaginaNovaOs() {
  await sessaoDaPagina('admin');
  const configuracaoAtual = await obterConfiguracao();

  return (
    <main>
      <h1 className="mb-1 text-[1.375rem] font-bold tracking-tight md:text-2xl">Nova OS</h1>
      <p className="mb-6 text-[13.5px] text-texto-2">
        Os percentuais vêm da configuração e podem ser ajustados só para esta OS.
      </p>
      <FormularioOs configuracaoAtual={configuracaoAtual} dataPadrao={hojeNegocio()} />
      <p className="mt-8">
        <Link href="/os" className="text-[13px] text-texto-2 underline">
          ← Voltar para a lista
        </Link>
      </p>
    </main>
  );
}
