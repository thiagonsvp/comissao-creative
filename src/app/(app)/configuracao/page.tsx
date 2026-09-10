import { exigirPapel } from '@/servidor/auth';
import { obterConfiguracao } from '@/servidor/configuracao/servico';
import { FormularioConfiguracao } from './FormularioConfiguracao';

export default async function PaginaConfiguracao() {
  await exigirPapel('admin');
  const configuracaoAtual = await obterConfiguracao();

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Configuração</h1>
      <FormularioConfiguracao configuracaoAtual={configuracaoAtual} />
    </main>
  );
}
