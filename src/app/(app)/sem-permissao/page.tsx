import { BotaoLink } from '@/componentes/Botao';
import { EstadoVazio } from '@/componentes/EstadoVazio';

export default function PaginaSemPermissao() {
  return (
    <main>
      <EstadoVazio
        titulo="Acesso não autorizado"
        descricao="Seu usuário não tem permissão para abrir esta tela."
        acao={
          <BotaoLink href="/os" variante="secundario">
            Voltar para as OS
          </BotaoLink>
        }
      />
    </main>
  );
}
