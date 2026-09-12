import { formatarBRL, type Centavos } from './dinheiro';

export interface LoteQueReserva {
  numero: number;
  estadoConferencia: string;
  valorReservado: Centavos;
}

/**
 * Um lote aprovado é, no fluxo do usuário, um lote pago — por isso ele manda
 * na mensagem, mesmo que haja pendentes junto: é ele que torna a recusa
 * definitiva.
 */
function loteQueManda(lotes: LoteQueReserva[]): LoteQueReserva | null {
  if (lotes.length === 0) return null;
  const aprovados = lotes.filter((l) => l.estadoConferencia === 'aprovado');
  const candidatos = aprovados.length > 0 ? aprovados : lotes;
  return candidatos.reduce((maior, l) => (l.numero > maior.numero ? l : maior));
}

function quantosOutros(lotes: LoteQueReserva[]): string {
  return lotes.length > 1 ? ` (são ${lotes.length} lotes envolvidos)` : '';
}

/**
 * Governa valor e percentual de comissão. Devolve `null` quando a mudança é
 * permitida. Aumentar a comissão nunca é recusado — só a redução que invadiria
 * dinheiro já reservado.
 */
export function motivoDeRecusaPorComissao(
  liberadaNova: Centavos,
  comprometido: Centavos,
  lotes: LoteQueReserva[],
): string | null {
  if (liberadaNova >= comprometido) return null;

  const lote = loteQueManda(lotes);
  if (!lote) {
    return 'Esta mudança reduziria a comissão abaixo do que já foi enviado em lote.';
  }

  const diferenca = comprometido - liberadaNova;

  if (lote.estadoConferencia === 'aprovado') {
    return (
      `O lote ${lote.numero} já foi aprovado, e aprovar é o registro de pagamento. ` +
      `Corrigir agora exigiria acertar ${formatarBRL(diferenca)} com o financeiro, ` +
      `o que este sistema ainda não registra${quantosOutros(lotes)}. ` +
      `Se a aprovação foi engano, desfaça-a no lote ${lote.numero}.`
    );
  }

  return (
    `O lote ${lote.numero} reservou ${formatarBRL(lote.valorReservado)} desta OS` +
    `${quantosOutros(lotes)}. Cancele esse lote para liberar a correção.`
  );
}

/**
 * Governa o rateio. Ele não muda quanto se recebe, só como se divide — mas
 * mudá-lo com lote pendente dividiria a mesma OS por dois acordos diferentes.
 */
export function motivoDeRecusaPorLoteAtivo(lotes: LoteQueReserva[]): string | null {
  const lote = loteQueManda(lotes);
  if (!lote) return null;

  if (lote.estadoConferencia === 'aprovado') {
    return (
      `O lote ${lote.numero} já foi aprovado com o rateio atual` +
      `${quantosOutros(lotes)}. Se a aprovação foi engano, desfaça-a no lote ` +
      `${lote.numero}; senão, o rateio novo só vale para OS futuras.`
    );
  }

  return (
    `O lote ${lote.numero} já levou comissão desta OS com o rateio atual` +
    `${quantosOutros(lotes)}. Cancele esse lote para mudar a divisão.`
  );
}
