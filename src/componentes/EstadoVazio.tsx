/** Todo estado vazio explica por que está vazio e oferece o próximo passo. */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-borda-forte px-5 py-9 text-center">
      <p className="font-medium">{titulo}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-texto-2">{descricao}</p>
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}
