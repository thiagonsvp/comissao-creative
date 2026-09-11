import { hojeNegocio } from '@/dominio/datas';
import { ratearDisponivel, resumirComissoes, serieMensal } from '@/dominio/painel';
import { sessaoDaPagina } from '@/servidor/auth';
import { componentesPorOs, resumoLotes } from '@/servidor/painel/consultas';
import { PainelAdmin } from './PainelAdmin';
import { PainelFinanceiro } from './PainelFinanceiro';

export default async function PaginaInicial() {
  const sessao = await sessaoDaPagina();
  const lotes = await resumoLotes();

  // O financeiro não carrega dados de OS nem de rateio: a pergunta dele é outra.
  if (sessao.papel !== 'admin') {
    return <PainelFinanceiro lotes={lotes} />;
  }

  const linhas = await componentesPorOs(true);
  const mesAtual = hojeNegocio().slice(0, 7);

  return (
    <PainelAdmin
      resumo={resumirComissoes(linhas)}
      serie={serieMensal(linhas, mesAtual, 12)}
      rateio={ratearDisponivel(linhas)}
      lotes={lotes}
    />
  );
}
