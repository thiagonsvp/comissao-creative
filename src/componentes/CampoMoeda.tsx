import { Campo, CLASSE_ENTRADA } from './Campo';

interface PropsCampoNumerico {
  nome: string;
  id: string;
  rotulo: string;
  valorInicial?: string;
  erro?: string;
  obrigatorio?: boolean;
  ajuda?: string;
}

/** Dinheiro: prefixo fixo, monoespaçada enquanto digita, teclado numérico no celular. */
export function CampoMoeda({
  nome,
  id,
  rotulo,
  valorInicial,
  erro,
  obrigatorio,
  ajuda,
}: PropsCampoNumerico) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} erro={erro} ajuda={ajuda}>
      <div className="relative">
        <span
          aria-hidden="true"
          className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-rotulo"
        >
          R$
        </span>
        <input
          name={nome}
          id={id}
          inputMode="decimal"
          placeholder="0,00"
          required={obrigatorio}
          defaultValue={valorInicial}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className={`num pl-10 ${erro ? `${CLASSE_ENTRADA} border-erro` : CLASSE_ENTRADA}`}
        />
      </div>
    </Campo>
  );
}

export function CampoPercentual({
  nome,
  id,
  rotulo,
  valorInicial,
  erro,
  obrigatorio,
  ajuda,
}: PropsCampoNumerico) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} erro={erro} ajuda={ajuda}>
      <div className="relative">
        <input
          name={nome}
          id={id}
          inputMode="decimal"
          required={obrigatorio}
          defaultValue={valorInicial}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className={`num pr-8 ${erro ? `${CLASSE_ENTRADA} border-erro` : CLASSE_ENTRADA}`}
        />
        <span
          aria-hidden="true"
          className="num pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-rotulo"
        >
          %
        </span>
      </div>
    </Campo>
  );
}
