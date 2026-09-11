export const CLASSE_ENTRADA =
  'min-h-11 w-full rounded-lg border border-borda-forte bg-superficie px-3 py-2.5 text-[15px] text-texto placeholder:text-rotulo';

export function Campo({
  rotulo,
  htmlFor,
  erro,
  ajuda,
  children,
}: {
  rotulo: string;
  htmlFor: string;
  erro?: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-texto-2">
        {rotulo}
      </label>
      {children}
      {ajuda && !erro && <span className="text-[12.5px] text-texto-2">{ajuda}</span>}
      {erro && (
        <span id={`${htmlFor}-erro`} className="text-[12.5px] text-erro">
          {erro}
        </span>
      )}
    </div>
  );
}

export function CampoTexto({
  nome,
  id,
  rotulo,
  erro,
  ajuda,
  ...resto
}: React.InputHTMLAttributes<HTMLInputElement> & {
  nome: string;
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: string;
}) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} erro={erro} ajuda={ajuda}>
      <input
        {...resto}
        name={nome}
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className={erro ? `${CLASSE_ENTRADA} border-erro` : CLASSE_ENTRADA}
      />
    </Campo>
  );
}
