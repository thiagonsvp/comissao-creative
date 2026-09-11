import { sessaoDaPagina } from '@/servidor/auth';
import { obterConfiguracao } from '@/servidor/configuracao/servico';
import { FormularioConfiguracao } from './FormularioConfiguracao';

export default async function PaginaConfiguracao() {
  await sessaoDaPagina('admin');
  const configuracaoAtual = await obterConfiguracao();

  return (
    <main>
      <h1 className="mb-1 text-[1.375rem] font-bold tracking-tight md:text-2xl">Configuração</h1>
      <p className="mb-6 max-w-lg text-[13.5px] text-texto-2">
        Estes valores só valem para OS novas. As OS já cadastradas mantêm os percentuais
        que tinham quando foram criadas.
      </p>
      <FormularioConfiguracao configuracaoAtual={configuracaoAtual} />
    </main>
  );
}
