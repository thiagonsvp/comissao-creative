import { hojeNegocio } from '@/dominio/datas';
import { exigirPapel } from '@/servidor/auth';
import { obterConfiguracao } from '@/servidor/configuracao/servico';
import { FormularioOs } from '../FormularioOs';

export default async function PaginaNovaOs() {
  await exigirPapel('admin');
  const configuracaoAtual = await obterConfiguracao();

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Nova OS</h1>
      <FormularioOs configuracaoAtual={configuracaoAtual} dataPadrao={hojeNegocio()} />
    </main>
  );
}
