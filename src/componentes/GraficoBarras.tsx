import { formatarBRL } from '@/dominio/dinheiro';

export interface PontoGrafico {
  rotulo: string;
  valor: bigint;
}

/**
 * Barras proporcionais ao maior valor da série. A razão é calculada em bigint
 * (pontos-base) e só a proporção adimensional vira número, para altura em CSS.
 */
export function GraficoBarras({
  pontos,
  descricao,
}: {
  pontos: PontoGrafico[];
  descricao: string;
}) {
  const maior = pontos.reduce((acc, p) => (p.valor > acc ? p.valor : acc), 0n);
  const altura = (valor: bigint): string =>
    maior <= 0n ? '2%' : `${Math.max(2, Number((valor * 10000n) / maior) / 100)}%`;
  const indiceMaior = maior > 0n ? pontos.findIndex((p) => p.valor === maior) : -1;

  return (
    <figure className="m-0">
      <div className="flex h-32 gap-1.5" aria-hidden="true">
        {pontos.map((ponto, indice) => (
          <div key={ponto.rotulo} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <span
              className={`w-full rounded-t-sm ${
                indice === indiceMaior ? 'bg-destaque' : 'bg-borda-forte'
              }`}
              style={{ height: altura(ponto.valor) }}
            />
            <span className="text-[9.5px] text-rotulo">{ponto.rotulo}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        {descricao}
        <table>
          <tbody>
            {pontos.map((ponto) => (
              <tr key={ponto.rotulo}>
                <th scope="row">{ponto.rotulo}</th>
                <td>{formatarBRL(ponto.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
