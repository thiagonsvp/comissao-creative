'use client';

import { BotaoLink } from '@/componentes/Botao';
import { EstadoVazio } from '@/componentes/EstadoVazio';

export default function ErroApp({ error }: { error: Error & { digest?: string } }) {
  return (
    <main>
      <EstadoVazio
        titulo="Alguma coisa deu errado"
        descricao={error.message || 'Ocorreu um erro inesperado. Tente novamente.'}
        acao={
          <BotaoLink href="/" variante="secundario">
            Voltar para o início
          </BotaoLink>
        }
      />
    </main>
  );
}
