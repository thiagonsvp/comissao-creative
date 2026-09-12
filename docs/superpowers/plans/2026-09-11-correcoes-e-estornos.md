# Correções, estornos e refazimento de lote — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao admin uma saída dentro do sistema para os quatro erros que acontecem de verdade — digitou errado, o negócio mudou, lançou o pagamento errado, precisa refazer um lote — sem nunca reescrever um documento já entregue ao financeiro.

**Architecture:** Uma única regra governa todas as travas: *uma mudança é recusada se faria a comissão liberada da OS ficar menor que a comissão já comprometida em lotes não cancelados*. Essa decisão vive numa função pura em `src/dominio/travas.ts`; a consulta que levanta os lotes afetados vive em `src/servidor/os/travas.ts`; e os três serviços que mudam dinheiro (`editarOs`, `estornarBaixaCliente`, `cancelarLote`) a consultam antes de escrever. Nenhum documento é reescrito: lote cancelado continua existindo marcado como cancelado, e correção de recebimento é um registro de estorno vinculado, nunca um `update`.

**Tech Stack:** Next.js 15 (App Router), Tailwind v4, `postgres` (postgres.js) contra o Postgres do Supabase, Vitest. **Nenhuma dependência nova e nenhuma migração.**

**Spec:** `docs/superpowers/specs/2026-09-11-correcoes-e-estornos-design.md`

## Global Constraints

- Idioma de interface, mensagens e identificadores: **português do Brasil**. Moeda BRL com duas casas.
- **Nenhum valor monetário passa por `Number` em cálculo.** Centavos em `bigint`, sempre. Nenhuma formatação de real montada à mão — só `formatarBRL` ou `<Moeda>`.
- **Nenhuma migração.** Todas as colunas usadas já existem: `motivo_cancelamento`, `lote_origem_id`, `baixa_origem_id`, `tipo`, `baixa_cliente_estorno_exige_origem_e_motivo`. Se alguma tarefa parecer precisar de `ALTER TABLE`, pare e relate — é sinal de erro de leitura do schema.
- **Nada é apagado, nada é reescrito.** `baixa_cliente` e `lote_item` só aceitam `insert` no banco; lote cancelado mantém seus itens; correção de recebimento é estorno vinculado.
- **Toda mutação numa transação**, sob o bloqueio global de `controle_financeiro` (via `comTransacaoFinanceira`), com `registrarAuditoria`.
- **Toda correção registra o antes e o depois** na auditoria (`valoresAnteriores` e `valoresNovos`). É o que torna a correção auditável.
- **Motivo obrigatório** em estorno, cancelamento de lote e desfazer aprovação.
- **Rateio nunca chega ao papel `financeiro`** — nem em HTML, JSON, erro ou auditoria.
- Todas as ações deste plano são **só `admin`**: páginas usam `sessaoDaPagina('admin')`, server actions usam `exigirPapel('admin')`.
- Data efetiva nunca futura (`dataNaoFutura`).
- **Os 107 testes existentes precisam continuar passando sem alteração.**
- Verificação de cada tarefa: `npx tsc --noEmit` sem erro, `npx next lint --dir src` limpo, `npm run build` com sucesso.
- Testes de integração no padrão do repositório: usuário real do Auth (`criarUsuarioTeste`), cenário montado dentro da transação e desfeito por `throw ROLLBACK_TESTE`. O papel de banco não tem privilégio de exclusão — nenhum teste pode deixar dado commitado.
- Commits pequenos ao final de cada tarefa.

## Estrutura de arquivos

```
src/dominio/travas.ts                 — NOVO, puro: a decisão de recusa e as mensagens
src/servidor/os/travas.ts             — NOVO: consulta dos lotes que reservam comissão de uma OS
src/servidor/os/servico.ts            — editarOs (acrescentado)
src/servidor/os/consultas.ts          — OsDetalhe ganha lotesAtivos e baixas com tipo/motivo
src/servidor/os/acoes.ts              — editarOsAction (acrescentado)
src/servidor/baixas/servico.ts        — estornarBaixaCliente (acrescentado)
src/servidor/baixas/acoes.ts          — estornarBaixaAction (acrescentado)
src/servidor/lotes/servico.ts         — cancelarLote, desfazerAprovacaoLote, loteOrigemId em gerarLote
src/servidor/lotes/consultas.ts       — LoteDetalhe ganha cancelamento e vínculos de substituição
src/servidor/lotes/acoes.ts           — cancelarLoteAction, desfazerAprovacaoAction (acrescentado)

src/app/(app)/os/[id]/editar/page.tsx        — NOVO
src/app/(app)/os/[id]/editar/FormularioEditarOs.tsx — NOVO
src/app/(app)/os/[id]/page.tsx               — ações de editar e estornar; lista com estornos
src/app/(app)/os/[id]/EstornarBaixa.tsx      — NOVO (diálogo de estorno)
src/app/(app)/lotes/[id]/page.tsx            — vínculos de substituição e motivo de cancelamento
src/app/(app)/lotes/[id]/AcoesLote.tsx       — cancelar e desfazer aprovação

tests/dominio/travas.test.ts          — NOVO, puro
tests/integracao/os-editar.test.ts    — NOVO
tests/integracao/baixas-estorno.test.ts — NOVO
tests/integracao/lotes-ciclo.test.ts  — NOVO (cancelar, desfazer, substituir)
```

**Decisão de decomposição registrada:** a trava é um módulo próprio em vez de código repetido nos três serviços, porque os três precisam exatamente da mesma pergunta respondida do mesmo jeito, e porque uma divergência entre eles seria invisível até alguém perder dinheiro.

**Ajuste ao §7 da spec, registrado aqui:** a spec diz que o formulário de edição mostra "os campos travados desabilitados". Isso vale para o rateio, que tem trava binária. **Valor e percentual ficam habilitados**, com um aviso mostrando quanto está reservado — porque a trava deles não é binária: aumentar o valor nunca quebra reserva, e desabilitar impediria uma correção legítima. O servidor faz a checagem exata ao salvar.

---

### Tarefa 1: A decisão de trava, pura

**Files:**
- Create: `src/dominio/travas.ts`
- Test: `tests/dominio/travas.test.ts`

**Interfaces:**
- Consumes: `Centavos` de `./dinheiro`.
- Produces:
  - `interface LoteQueReserva { numero: number; estadoConferencia: string; valorReservado: Centavos }`
  - `function motivoDeRecusaPorComissao(liberadaNova: Centavos, comprometido: Centavos, lotes: LoteQueReserva[]): string | null`
  - `function motivoDeRecusaPorLoteAtivo(lotes: LoteQueReserva[]): string | null`

**Contexto:** estas duas funções concentram as mensagens de recusa do sistema inteiro. Elas não dizem "não pode" — dizem o que fazer. A primeira governa valor e percentual; a segunda, rateio. Devolver `null` significa "pode".

- [ ] **Passo 1: Escrever o teste**

`tests/dominio/travas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  motivoDeRecusaPorComissao,
  motivoDeRecusaPorLoteAtivo,
  type LoteQueReserva,
} from '@/dominio/travas';

const enviado: LoteQueReserva = {
  numero: 14,
  estadoConferencia: 'enviado',
  valorReservado: 70_000n,
};
const aprovado: LoteQueReserva = {
  numero: 12,
  estadoConferencia: 'aprovado',
  valorReservado: 50_000n,
};

describe('motivoDeRecusaPorComissao', () => {
  it('permite quando nada está comprometido', () => {
    expect(motivoDeRecusaPorComissao(0n, 0n, [])).toBeNull();
  });

  it('permite quando a liberada nova ainda cobre o comprometido', () => {
    expect(motivoDeRecusaPorComissao(70_000n, 70_000n, [enviado])).toBeNull();
  });

  it('permite aumento de valor mesmo com lote aprovado', () => {
    expect(motivoDeRecusaPorComissao(200_000n, 50_000n, [aprovado])).toBeNull();
  });

  it('recusa quando a liberada nova fica abaixo do comprometido, citando o lote', () => {
    const motivo = motivoDeRecusaPorComissao(42_000n, 70_000n, [enviado]);
    expect(motivo).toContain('lote 14');
    expect(motivo).toContain('R$ 700,00');
    expect(motivo).toContain('Cancele');
  });

  it('quando há lote aprovado, a recusa é definitiva e cita a diferença', () => {
    const motivo = motivoDeRecusaPorComissao(42_000n, 50_000n, [aprovado]);
    expect(motivo).toContain('lote 12');
    expect(motivo).toContain('aprovado');
    expect(motivo).toContain('R$ 80,00');
    expect(motivo).toContain('desfaça');
  });

  it('com vários lotes pendentes, cita o mais recente e a quantidade', () => {
    const outro: LoteQueReserva = {
      numero: 9,
      estadoConferencia: 'enviado',
      valorReservado: 10_000n,
    };
    const motivo = motivoDeRecusaPorComissao(0n, 80_000n, [outro, enviado]);
    expect(motivo).toContain('lote 14');
    expect(motivo).toContain('2 lotes');
  });

  it('lote aprovado tem precedência sobre pendente na mensagem', () => {
    const motivo = motivoDeRecusaPorComissao(0n, 120_000n, [enviado, aprovado]);
    expect(motivo).toContain('lote 12');
    expect(motivo).toContain('aprovado');
  });
});

describe('motivoDeRecusaPorLoteAtivo', () => {
  it('permite sem lote nenhum', () => {
    expect(motivoDeRecusaPorLoteAtivo([])).toBeNull();
  });

  it('recusa com lote pendente, mandando cancelar', () => {
    const motivo = motivoDeRecusaPorLoteAtivo([enviado]);
    expect(motivo).toContain('lote 14');
    expect(motivo).toContain('Cancele');
  });

  it('recusa com lote aprovado, mandando desfazer', () => {
    const motivo = motivoDeRecusaPorLoteAtivo([aprovado]);
    expect(motivo).toContain('lote 12');
    expect(motivo).toContain('desfaça');
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npm run test:dominio -- travas`
Expected: FAIL — `Cannot find module '@/dominio/travas'`.

- [ ] **Passo 3: Implementar**

`src/dominio/travas.ts`:

```ts
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
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npm run test:dominio -- travas` → PASS.
Run: `npm test` → os 107 anteriores continuam passando, mais os novos.

- [ ] **Passo 5: Commit**

```bash
git add src/dominio/travas.ts tests/dominio/travas.test.ts
git commit -m "feat(dominio): decisao de trava de correcao e mensagens de recusa"
```

---

### Tarefa 2: Levantar os lotes que reservam comissão de uma OS

**Files:**
- Create: `src/servidor/os/travas.ts`
- Test: `tests/integracao/os-travas.test.ts`

**Interfaces:**
- Consumes: `sql`, `Executor` de `@/servidor/db`; `parseDecimal` de `@/dominio/dinheiro`; `LoteQueReserva` de `@/dominio/travas`.
- Produces:
  - `interface SituacaoDaOs { comprometido: Centavos; totalPago: Centavos; valorOs: Centavos; percentualComissao: Percentual; lotes: (LoteQueReserva & { id: string })[] }`
  - `function situacaoDaOs(osId: string, exec?: Executor): Promise<SituacaoDaOs | null>`

**Contexto:** os três serviços que mudam dinheiro precisam da mesma foto da OS antes de decidir: quanto está comprometido, em quais lotes, e os componentes para recalcular a comissão. Uma consulta só, usada por todos, evita que eles divirjam.

Devolve `null` quando a OS não existe.

- [ ] **Passo 1: Escrever o teste**

`tests/integracao/os-travas.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { situacaoDaOs } from '@/servidor/os/travas';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('situacaoDaOs', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  async function osComMetadePaga(tx: postgres.TransactionSql): Promise<string> {
    const { osId } = await cadastrarOs(
      tx,
      {
        numeroOs: numeroOsTeste('TRAVA'),
        cliente: 'Cliente Trava',
        produto: 'Produto Trava',
        tipoPagamento: 'Pix',
        valor: 1_000_000n,
        percentualComissao: 700n,
        dataVenda: '2026-09-01',
        observacao: null,
        rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
      },
      usuario.id,
    );
    await registrarBaixaCliente(
      tx,
      { osId, data: '2026-09-05', valor: 500_000n, observacao: null },
      usuario.id,
    );
    return osId;
  }

  it('sem lote, nada comprometido', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);
        const situacao = await situacaoDaOs(osId, tx);
        expect(situacao).toMatchObject({
          comprometido: 0n,
          totalPago: 500_000n,
          valorOs: 1_000_000n,
          percentualComissao: 700n,
        });
        expect(situacao?.lotes).toEqual([]);
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('com lote enviado, traz o comprometido e o lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);
        const { numero } = await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);

        const situacao = await situacaoDaOs(osId, tx);
        expect(situacao?.comprometido).toBe(35_000n);
        expect(situacao?.lotes).toHaveLength(1);
        expect(situacao?.lotes[0]).toMatchObject({
          numero,
          estadoConferencia: 'enviado',
          valorReservado: 35_000n,
        });
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('OS inexistente devolve null', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        expect(await situacaoDaOs('11111111-1111-1111-1111-111111111111', tx)).toBeNull();
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npm run test:integracao -- os-travas`
Expected: FAIL — `Cannot find module '@/servidor/os/travas'`.

- [ ] **Passo 3: Implementar**

`src/servidor/os/travas.ts`:

```ts
import {
  parseDecimal,
  parsePercentual,
  type Centavos,
  type Percentual,
} from '@/dominio/dinheiro';
import type { LoteQueReserva } from '@/dominio/travas';
import { sql, type Executor } from '@/servidor/db';

export interface LoteReservando extends LoteQueReserva {
  id: string;
}

export interface SituacaoDaOs {
  valorOs: Centavos;
  percentualComissao: Percentual;
  totalPago: Centavos;
  comprometido: Centavos;
  lotes: LoteReservando[];
}

/**
 * Foto da OS antes de qualquer correção: os componentes para recalcular a
 * comissão e os lotes não cancelados que já reservaram parte dela.
 *
 * Nenhuma comissão é calculada aqui — quem calcula é `src/dominio`.
 */
export async function situacaoDaOs(
  osId: string,
  exec: Executor = sql,
): Promise<SituacaoDaOs | null> {
  const [os] = await exec`
    select o.valor, o.percentual_comissao,
      (
        select coalesce(sum(case when b.tipo = 'estorno' then -b.valor else b.valor end), 0)
        from public.baixa_cliente b
        where b.os_id = o.id
      ) as total_pago
    from public.os o
    where o.id = ${osId}
  `;
  if (!os) return null;

  const lotes = await exec`
    select lf.id, lf.numero, lf.estado_conferencia,
      coalesce(sum(li.valor_comissao), 0) as valor_reservado
    from public.lote_item li
    join public.lote_financeiro lf on lf.id = li.lote_id
    where li.os_id = ${osId} and lf.estado_conferencia <> 'cancelado'
    group by lf.id, lf.numero, lf.estado_conferencia
    order by lf.numero
  `;

  const reservando: LoteReservando[] = lotes.map((l) => ({
    id: l.id,
    numero: Number(l.numero),
    estadoConferencia: l.estado_conferencia,
    valorReservado: parseDecimal(l.valor_reservado),
  }));

  return {
    valorOs: parseDecimal(os.valor),
    percentualComissao: parsePercentual(os.percentual_comissao),
    totalPago: parseDecimal(os.total_pago),
    comprometido: reservando.reduce((acc, l) => acc + l.valorReservado, 0n),
    lotes: reservando,
  };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npm run test:integracao -- os-travas` → PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/servidor/os/travas.ts tests/integracao/os-travas.test.ts
git commit -m "feat(servidor): consulta da situacao de uma OS para as travas de correcao"
```

---

### Tarefa 3: Editar OS

**Files:**
- Modify: `src/servidor/os/servico.ts` (extrai validação comum e acrescenta `editarOs`)
- Test: `tests/integracao/os-editar.test.ts`

**Interfaces:**
- Consumes: `situacaoDaOs` (Tarefa 2); `motivoDeRecusaPorComissao`, `motivoDeRecusaPorLoteAtivo` (Tarefa 1); `comissaoTotal`, `comissaoLiberada` de `@/dominio/comissao`; `validarPesos` de `@/dominio/rateio`; `normalizarNumeroOs` de `@/dominio/os`.
- Produces:
  - `interface DadosEdicaoOs` — idêntica a `DadosOs` (mesmos nove campos)
  - `function editarOs(tx: postgres.TransactionSql, osId: string, dados: DadosEdicaoOs, usuarioId: string): Promise<void>`

**Contexto:** `cadastrarOs` já valida cliente/produto/tipo de pagamento não vazios e valor maior que zero. A edição precisa das mesmas regras, então esta tarefa **extrai** essa validação para uma função compartilhada em vez de duplicá-la — duplicação aqui significaria que uma regra nova entraria em um caminho e não no outro.

A trava é a parte delicada: só é consultada quando `valor` ou `percentual_comissao` **de fato mudaram**. Editar só o nome do cliente de uma OS com lote pendente tem que passar.

- [ ] **Passo 1: Escrever o teste**

`tests/integracao/os-editar.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs, editarOs, type DadosOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('editarOs', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  function dados(sobrescrever: Partial<DadosOs> = {}): DadosOs {
    return {
      numeroOs: numeroOsTeste('EDIT'),
      cliente: 'Cliente Original',
      produto: 'Produto Original',
      tipoPagamento: 'Pix',
      valor: 1_000_000n,
      percentualComissao: 700n,
      dataVenda: '2026-09-01',
      observacao: null,
      rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
      ...sobrescrever,
    };
  }

  /** OS com metade paga e, opcionalmente, um lote gerado em cima dela. */
  async function cenario(tx: postgres.TransactionSql, comLote: boolean) {
    const originais = dados();
    const { osId } = await cadastrarOs(tx, originais, usuario.id);
    await registrarBaixaCliente(
      tx,
      { osId, data: '2026-09-05', valor: 500_000n, observacao: null },
      usuario.id,
    );
    if (comLote) {
      await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);
    }
    return { osId, originais };
  }

  it('edita campos livres mesmo com lote pendente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, true);

        await editarOs(
          tx,
          osId,
          { ...originais, cliente: 'Cliente Corrigido', dataVenda: '2026-08-20' },
          usuario.id,
        );

        const [os] = await tx`
          select cliente, to_char(data_venda, 'YYYY-MM-DD') as data_venda, valor
          from public.os where id = ${osId}
        `;
        expect(os.cliente).toBe('Cliente Corrigido');
        expect(os.data_venda).toBe('2026-08-20');
        expect(os.valor).toBe('10000.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('permite aumentar o valor mesmo com lote pendente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, true);

        await editarOs(tx, osId, { ...originais, valor: 2_000_000n }, usuario.id);

        const [os] = await tx`select valor from public.os where id = ${osId}`;
        expect(os.valor).toBe('20000.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa reduzir o valor abaixo do que o lote reservou, dizendo o que fazer', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, true);

        // Comissão liberada cairia de R$ 350,00 para R$ 175,00, mas o lote
        // reservou R$ 350,00.
        await expect(
          editarOs(tx, osId, { ...originais, valor: 500_000n }, usuario.id),
        ).rejects.toThrow(/Cancele esse lote/);

        const [os] = await tx`select valor from public.os where id = ${osId}`;
        expect(os.valor).toBe('10000.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('permite reduzir o valor quando não há lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, false);

        await editarOs(tx, osId, { ...originais, valor: 600_000n }, usuario.id);

        const [os] = await tx`select valor from public.os where id = ${osId}`;
        expect(os.valor).toBe('6000.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa mudar o rateio com lote pendente e permite sem lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const comLote = await cenario(tx, true);
        await expect(
          editarOs(
            tx,
            comLote.osId,
            { ...comLote.originais, rateio: { thiago: 600n, geice: 100n, gabrielle: 0n } },
            usuario.id,
          ),
        ).rejects.toThrow(/rateio|divisão/i);

        const semLote = await cenario(tx, false);
        await editarOs(
          tx,
          semLote.osId,
          { ...semLote.originais, rateio: { thiago: 600n, geice: 100n, gabrielle: 0n } },
          usuario.id,
        );
        const [r] = await tx`
          select rateio_thiago, rateio_gabrielle from interno.os_rateio
          where os_id = ${semLote.osId}
        `;
        expect(r.rateio_thiago).toBe('6.00');
        expect(r.rateio_gabrielle).toBe('0.00');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('aplica as mesmas validações do cadastro e a unicidade do número', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, false);
        const outra = await cadastrarOs(tx, dados(), usuario.id);
        const [outraLinha] = await tx`select numero_os from public.os where id = ${outra.osId}`;

        await expect(
          editarOs(tx, osId, { ...originais, cliente: '   ' }, usuario.id),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          editarOs(tx, osId, { ...originais, valor: 0n }, usuario.id),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          editarOs(
            tx,
            osId,
            { ...originais, rateio: { thiago: 500n, geice: 100n, gabrielle: 50n } },
            usuario.id,
          ),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          editarOs(tx, osId, { ...originais, numeroOs: outraLinha.numero_os }, usuario.id),
        ).rejects.toThrow(/já existe/i);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('registra na auditoria o antes e o depois', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, originais } = await cenario(tx, false);

        await editarOs(tx, osId, { ...originais, valor: 600_000n }, usuario.id);

        const [evento] = await tx`
          select acao, valores_anteriores, valores_novos
          from interno.auditoria_evento
          where entidade = 'os' and entidade_id = ${osId} and acao = 'editar'
        `;
        expect(evento).toBeTruthy();
        expect(evento.valores_anteriores.valor).toBe('1000000');
        expect(evento.valores_novos.valor).toBe('600000');

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa OS inexistente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        await expect(
          editarOs(
            tx,
            '11111111-1111-1111-1111-111111111111',
            dados(),
            usuario.id,
          ),
        ).rejects.toThrow(ErroValidacao);
        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npm run test:integracao -- os-editar`
Expected: FAIL — `editarOs` não é exportado por `@/servidor/os/servico`.

- [ ] **Passo 3: Extrair a validação comum**

Em `src/servidor/os/servico.ts`, acrescentar acima de `cadastrarOs`:

```ts
/** Regras de campo iguais no cadastro e na edição. */
function validarCamposOs(dados: DadosOs): void {
  if (dados.cliente.trim() === '') {
    throw new ErroValidacao('Cliente é obrigatório', 'cliente');
  }
  if (dados.produto.trim() === '') {
    throw new ErroValidacao('Produto é obrigatório', 'produto');
  }
  if (dados.tipoPagamento.trim() === '') {
    throw new ErroValidacao('Tipo de pagamento é obrigatório', 'tipoPagamento');
  }
  if (dados.valor <= 0n) {
    throw new ErroValidacao('Valor deve ser maior que zero', 'valor');
  }
  validarPesos(dados.rateio, dados.percentualComissao);
}
```

E substituir, dentro de `cadastrarOs`, os quatro `if` de validação e a chamada de `validarPesos` por uma linha:

```ts
  validarCamposOs(dados);
```

Nada mais muda em `cadastrarOs`.

- [ ] **Passo 4: Implementar `editarOs`**

Acrescentar ao final de `src/servidor/os/servico.ts`:

```ts
export type DadosEdicaoOs = DadosOs;

export async function editarOs(
  tx: postgres.TransactionSql,
  osId: string,
  dados: DadosEdicaoOs,
  usuarioId: string,
): Promise<void> {
  validarCamposOs(dados);
  const numeroNormalizado = normalizarNumeroOs(dados.numeroOs);

  const [atual] = await tx`
    select numero_os, cliente, produto, tipo_pagamento, valor, percentual_comissao,
      to_char(data_venda, 'YYYY-MM-DD') as data_venda, observacao
    from public.os where id = ${osId} for update
  `;
  if (!atual) throw new ErroValidacao('OS não encontrada', 'osId');

  const [rateioAtual] = await tx`
    select rateio_thiago, rateio_geice, rateio_gabrielle
    from interno.os_rateio where os_id = ${osId}
  `;

  const situacao = await situacaoDaOs(osId, tx);
  if (!situacao) throw new ErroValidacao('OS não encontrada', 'osId');

  const valorMudou = parseDecimal(atual.valor) !== dados.valor;
  const percentualMudou = parsePercentual(atual.percentual_comissao) !== dados.percentualComissao;

  if (valorMudou || percentualMudou) {
    const liberadaNova = comissaoLiberada(
      comissaoTotal(dados.valor, dados.percentualComissao),
      situacao.totalPago,
      dados.valor,
    );
    const motivo = motivoDeRecusaPorComissao(
      liberadaNova,
      situacao.comprometido,
      situacao.lotes,
    );
    if (motivo) throw new ErroValidacao(motivo, 'valor');
  }

  const rateioMudou =
    parsePercentual(rateioAtual.rateio_thiago) !== dados.rateio.thiago ||
    parsePercentual(rateioAtual.rateio_geice) !== dados.rateio.geice ||
    parsePercentual(rateioAtual.rateio_gabrielle) !== dados.rateio.gabrielle;

  if (rateioMudou) {
    const motivo = motivoDeRecusaPorLoteAtivo(situacao.lotes);
    if (motivo) throw new ErroValidacao(motivo, 'rateio_thiago');
  }

  try {
    await tx`
      update public.os
      set numero_os = ${dados.numeroOs.trim()},
          numero_os_normalizado = ${numeroNormalizado},
          cliente = ${dados.cliente.trim()},
          produto = ${dados.produto.trim()},
          tipo_pagamento = ${dados.tipoPagamento.trim()},
          valor = ${paraDecimalDb(dados.valor)},
          percentual_comissao = ${paraPercentualDb(dados.percentualComissao)},
          data_venda = ${dados.dataVenda},
          observacao = ${dados.observacao},
          versao = versao + 1,
          atualizado_por = ${usuarioId}
      where id = ${osId}
    `;
  } catch (erro) {
    if (ehErroUnicidade(erro)) {
      throw new ErroValidacao('Já existe uma OS com este número', 'numeroOs');
    }
    throw erro;
  }

  await tx`
    update interno.os_rateio
    set rateio_thiago = ${paraPercentualDb(dados.rateio.thiago)},
        rateio_geice = ${paraPercentualDb(dados.rateio.geice)},
        rateio_gabrielle = ${paraPercentualDb(dados.rateio.gabrielle)}
    where os_id = ${osId}
  `;

  await registrarAuditoria(tx, {
    entidade: 'os',
    entidadeId: osId,
    acao: 'editar',
    responsavelId: usuarioId,
    dataEfetiva: dados.dataVenda,
    valoresAnteriores: {
      numeroOs: atual.numero_os,
      cliente: atual.cliente,
      produto: atual.produto,
      tipoPagamento: atual.tipo_pagamento,
      valor: parseDecimal(atual.valor),
      percentualComissao: parsePercentual(atual.percentual_comissao),
      dataVenda: atual.data_venda,
      observacao: atual.observacao,
      rateio: {
        thiago: parsePercentual(rateioAtual.rateio_thiago),
        geice: parsePercentual(rateioAtual.rateio_geice),
        gabrielle: parsePercentual(rateioAtual.rateio_gabrielle),
      },
    },
    valoresNovos: dados,
  });
}
```

Acrescentar aos imports do arquivo, sem remover nenhum existente:

```ts
import { comissaoLiberada, comissaoTotal } from '@/dominio/comissao';
import { motivoDeRecusaPorComissao, motivoDeRecusaPorLoteAtivo } from '@/dominio/travas';
import { parseDecimal, parsePercentual } from '@/dominio/dinheiro';
import { situacaoDaOs } from './travas';
```

(`paraDecimalDb`, `paraPercentualDb`, `ErroValidacao`, `normalizarNumeroOs`, `validarPesos`, `registrarAuditoria` e `ehErroUnicidade` já estão no arquivo.)

- [ ] **Passo 5: Rodar e ver passar**

Run: `npm run test:integracao -- os-editar` → PASS.
Run: `npm test` → suíte inteira verde, incluindo os testes antigos de `cadastrarOs`, que exercitam a validação recém-extraída.

- [ ] **Passo 6: Commit**

```bash
git add src/servidor/os/servico.ts tests/integracao/os-editar.test.ts
git commit -m "feat(servidor): edicao de OS com trava por comissao comprometida"
```

---

### Tarefa 4: Estornar recebimento do cliente

**Files:**
- Modify: `src/servidor/baixas/servico.ts` (acrescenta `estornarBaixaCliente`)
- Test: `tests/integracao/baixas-estorno.test.ts`

**Interfaces:**
- Consumes: `situacaoDaOs` (Tarefa 2); `motivoDeRecusaPorComissao` (Tarefa 1); `dataNaoFutura` de `@/dominio/datas`.
- Produces:
  - `interface DadosEstorno { baixaId: string; valor: Centavos; data: string; motivo: string }`
  - `function estornarBaixaCliente(tx: postgres.TransactionSql, dados: DadosEstorno, usuarioId: string): Promise<{ estornoId: string }>`

**Contexto:** o banco só aceita `insert` em `baixa_cliente` — não existe corrigir nem apagar um recebimento. O estorno é uma linha de sinal contrário com `tipo = 'estorno'`, apontando para o original em `baixa_origem_id`, com o motivo em `observacao`. A constraint `baixa_cliente_estorno_exige_origem_e_motivo` já recusa estorno sem esses dois no nível do banco; o serviço valida antes para dar mensagem em português.

Metade do caminho já está pronta desde a Fase 1: `totalPagoCliente` no domínio já subtrai estorno, e todas as consultas SQL já somam com sinal. Esta tarefa só escreve.

- [ ] **Passo 1: Escrever o teste**

`tests/integracao/baixas-estorno.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { estornarBaixaCliente, registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { obterOsPorId } from '@/servidor/os/consultas';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('estornarBaixaCliente', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  async function cenario(tx: postgres.TransactionSql) {
    const { osId } = await cadastrarOs(
      tx,
      {
        numeroOs: numeroOsTeste('ESTORNO'),
        cliente: 'Cliente Estorno',
        produto: 'Produto Estorno',
        tipoPagamento: 'Pix',
        valor: 1_000_000n,
        percentualComissao: 700n,
        dataVenda: '2026-09-01',
        observacao: null,
        rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
      },
      usuario.id,
    );
    const { baixaId } = await registrarBaixaCliente(
      tx,
      { osId, data: '2026-09-05', valor: 500_000n, observacao: null },
      usuario.id,
    );
    return { osId, baixaId };
  }

  it('estorno integral zera o pago e a comissão liberada', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, baixaId } = await cenario(tx);

        const { estornoId } = await estornarBaixaCliente(
          tx,
          { baixaId, valor: 500_000n, data: '2026-09-10', motivo: 'Lancei na OS errada' },
          usuario.id,
        );

        const [linha] = await tx`
          select tipo, valor, baixa_origem_id, observacao
          from public.baixa_cliente where id = ${estornoId}
        `;
        expect(linha.tipo).toBe('estorno');
        expect(linha.valor).toBe('5000.00');
        expect(linha.baixa_origem_id).toBe(baixaId);
        expect(linha.observacao).toBe('Lancei na OS errada');

        const detalhe = await obterOsPorId(osId, false, tx);
        expect(detalhe?.totalPagoCliente).toBe(0n);
        expect(detalhe?.comissaoLiberada).toBe(0n);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('estorno parcial reduz proporcionalmente', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, baixaId } = await cenario(tx);

        await estornarBaixaCliente(
          tx,
          { baixaId, valor: 200_000n, data: '2026-09-10', motivo: 'Cheque voltou' },
          usuario.id,
        );

        const detalhe = await obterOsPorId(osId, false, tx);
        expect(detalhe?.totalPagoCliente).toBe(300_000n);
        // 7% de R$ 10.000 = R$ 700,00; 30% pago libera R$ 210,00
        expect(detalhe?.comissaoLiberada).toBe(21_000n);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa estorno acumulado acima do recebimento original', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { baixaId } = await cenario(tx);

        await estornarBaixaCliente(
          tx,
          { baixaId, valor: 300_000n, data: '2026-09-10', motivo: 'Parcial' },
          usuario.id,
        );
        await expect(
          estornarBaixaCliente(
            tx,
            { baixaId, valor: 300_000n, data: '2026-09-10', motivo: 'Passa do total' },
            usuario.id,
          ),
        ).rejects.toThrow(/ultrapassa|já estornado/i);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa valor não positivo, data futura, motivo vazio e estorno de estorno', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { baixaId } = await cenario(tx);

        await expect(
          estornarBaixaCliente(tx, { baixaId, valor: 0n, data: '2026-09-10', motivo: 'x' }, usuario.id),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          estornarBaixaCliente(tx, { baixaId, valor: 1_000n, data: '2999-01-01', motivo: 'x' }, usuario.id),
        ).rejects.toThrow(ErroValidacao);
        await expect(
          estornarBaixaCliente(tx, { baixaId, valor: 1_000n, data: '2026-09-10', motivo: '   ' }, usuario.id),
        ).rejects.toThrow(/motivo/i);

        const { estornoId } = await estornarBaixaCliente(
          tx,
          { baixaId, valor: 1_000n, data: '2026-09-10', motivo: 'Primeiro' },
          usuario.id,
        );
        await expect(
          estornarBaixaCliente(
            tx,
            { baixaId: estornoId, valor: 500n, data: '2026-09-10', motivo: 'De estorno' },
            usuario.id,
          ),
        ).rejects.toThrow(/recebimento/i);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('recusa estorno que derrubaria a comissão abaixo do lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, baixaId } = await cenario(tx);
        await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);

        await expect(
          estornarBaixaCliente(
            tx,
            { baixaId, valor: 100_000n, data: '2026-09-10', motivo: 'Tentativa' },
            usuario.id,
          ),
        ).rejects.toThrow(/Cancele esse lote/);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npm run test:integracao -- baixas-estorno`
Expected: FAIL — `estornarBaixaCliente` não é exportado.

- [ ] **Passo 3: Implementar**

Acrescentar ao final de `src/servidor/baixas/servico.ts`:

```ts
export interface DadosEstorno {
  baixaId: string;
  valor: Centavos;
  data: string;
  motivo: string;
}

/**
 * Recebimento não se edita nem se apaga — o banco só aceita insert nesta
 * tabela. Corrigir é estornar e lançar de novo, o que deixa na história que
 * houve um erro e quando ele foi percebido.
 */
export async function estornarBaixaCliente(
  tx: postgres.TransactionSql,
  dados: DadosEstorno,
  usuarioId: string,
): Promise<{ estornoId: string }> {
  if (dados.valor <= 0n) {
    throw new ErroValidacao('O valor do estorno deve ser maior que zero', 'valor');
  }
  const motivo = dados.motivo.trim();
  if (motivo === '') {
    throw new ErroValidacao('O motivo do estorno é obrigatório', 'motivo');
  }
  const dataEfetiva = dataNaoFutura(dados.data, 'data');

  const [original] = await tx`
    select id, os_id, tipo, valor from public.baixa_cliente
    where id = ${dados.baixaId} for update
  `;
  if (!original) throw new ErroValidacao('Pagamento não encontrado', 'baixaId');
  if (original.tipo !== 'recebimento') {
    throw new ErroValidacao('Só é possível estornar um recebimento', 'baixaId');
  }

  const [{ estornado }] = await tx`
    select coalesce(sum(valor), 0) as estornado
    from public.baixa_cliente
    where baixa_origem_id = ${dados.baixaId} and tipo = 'estorno'
  `;
  const jaEstornado = parseDecimal(estornado);
  if (jaEstornado + dados.valor > parseDecimal(original.valor)) {
    throw new ErroValidacao(
      'O estorno ultrapassa o valor do recebimento original',
      'valor',
    );
  }

  const situacao = await situacaoDaOs(original.os_id, tx);
  if (!situacao) throw new ErroValidacao('OS não encontrada', 'baixaId');

  const liberadaNova = comissaoLiberada(
    comissaoTotal(situacao.valorOs, situacao.percentualComissao),
    situacao.totalPago - dados.valor,
    situacao.valorOs,
  );
  const recusa = motivoDeRecusaPorComissao(
    liberadaNova,
    situacao.comprometido,
    situacao.lotes,
  );
  if (recusa) throw new ErroValidacao(recusa, 'valor');

  const [linha] = await tx`
    insert into public.baixa_cliente
      (os_id, tipo, baixa_origem_id, data_efetiva, valor, observacao, criado_por)
    values (
      ${original.os_id}, 'estorno', ${dados.baixaId}, ${dataEfetiva},
      ${paraDecimalDb(dados.valor)}, ${motivo}, ${usuarioId}
    )
    returning id
  `;

  await registrarAuditoria(tx, {
    entidade: 'baixa_cliente',
    entidadeId: linha.id,
    acao: 'estornar',
    responsavelId: usuarioId,
    dataEfetiva,
    motivo,
    valoresAnteriores: {
      baixaOrigemId: dados.baixaId,
      valorOriginal: parseDecimal(original.valor),
      jaEstornado,
    },
    valoresNovos: { osId: original.os_id, valor: dados.valor },
  });

  return { estornoId: linha.id };
}
```

Acrescentar aos imports, sem remover os existentes:

```ts
import { comissaoLiberada, comissaoTotal } from '@/dominio/comissao';
import { motivoDeRecusaPorComissao } from '@/dominio/travas';
import { situacaoDaOs } from '@/servidor/os/travas';
```

(`dataNaoFutura`, `paraDecimalDb`, `parseDecimal`, `Centavos`, `ErroValidacao` e `registrarAuditoria` já estão no arquivo.)

- [ ] **Passo 4: Rodar e ver passar**

Run: `npm run test:integracao -- baixas-estorno` → PASS.
Run: `npm test` → suíte inteira verde.

- [ ] **Passo 5: Commit**

```bash
git add src/servidor/baixas/servico.ts tests/integracao/baixas-estorno.test.ts
git commit -m "feat(servidor): estorno de recebimento do cliente com motivo obrigatorio"
```

---

### Tarefa 5: Cancelar lote, desfazer aprovação e gerar substituto

**Files:**
- Modify: `src/servidor/lotes/servico.ts` (acrescenta duas funções e um campo opcional em `gerarLote`)
- Test: `tests/integracao/lotes-ciclo.test.ts`

**Interfaces:**
- Produces:
  - `function cancelarLote(tx: postgres.TransactionSql, loteId: string, motivo: string, usuarioId: string): Promise<void>`
  - `function desfazerAprovacaoLote(tx: postgres.TransactionSql, loteId: string, motivo: string, usuarioId: string): Promise<void>`
  - `DadosGerarLote` ganha `loteOrigemId?: string`
- Consumes: nada novo — usa `registrarAuditoria` e `ErroValidacao`, já importados.

**Contexto:** cancelar é a peça que destrava todo o resto. **Nenhuma linha de `lote_item` é apagada** — o banco nem permitiria, e o documento precisa continuar existindo marcado como cancelado. A liberação das reservas é consequência automática: todos os cálculos de comissão comprometida já filtram `estado_conferencia <> 'cancelado'`, desde a Fase 1. Não há nada a mudar neles.

"Desfazer aprovação" existe porque aprovar é um clique e, no fluxo do usuário, equivale a declarar que o dinheiro entrou. Sem ele, um clique errado empurra a OS para o caso que a spec deixou fora de escopo, sem saída.

- [ ] **Passo 1: Escrever o teste**

`tests/integracao/lotes-ciclo.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { ErroValidacao } from '@/dominio/erros';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { editarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import {
  aprovarLote,
  cancelarLote,
  desfazerAprovacaoLote,
  gerarLote,
} from '@/servidor/lotes/servico';
import { obterOsPorId } from '@/servidor/os/consultas';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('ciclo de vida do lote', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  function dadosOs() {
    return {
      numeroOs: numeroOsTeste('CICLO'),
      cliente: 'Cliente Ciclo',
      produto: 'Produto Ciclo',
      tipoPagamento: 'Pix',
      valor: 1_000_000n,
      percentualComissao: 700n,
      dataVenda: '2026-09-01',
      observacao: null,
      rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
    };
  }

  async function osComLote(tx: postgres.TransactionSql) {
    const dados = dadosOs();
    const { osId } = await cadastrarOs(tx, dados, usuario.id);
    await registrarBaixaCliente(
      tx,
      { osId, data: '2026-09-05', valor: 500_000n, observacao: null },
      usuario.id,
    );
    const lote = await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);
    return { osId, dados, lote };
  }

  it('cancelar devolve a comissão para disponível sem apagar o lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, lote } = await osComLote(tx);

        const antes = await obterOsPorId(osId, false, tx);
        expect(antes?.comissaoDisponivel).toBe(0n);

        await cancelarLote(tx, lote.loteId, 'Faltou uma OS', usuario.id);

        const depois = await obterOsPorId(osId, false, tx);
        expect(depois?.comissaoDisponivel).toBe(35_000n);

        const [linha] = await tx`
          select estado_conferencia, motivo_cancelamento from public.lote_financeiro
          where id = ${lote.loteId}
        `;
        expect(linha.estado_conferencia).toBe('cancelado');
        expect(linha.motivo_cancelamento).toBe('Faltou uma OS');

        const itens = await tx`
          select count(*)::int as total from public.lote_item where lote_id = ${lote.loteId}
        `;
        expect(itens[0].total).toBe(1);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('cancelar exige motivo e só vale a partir de enviado', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { lote } = await osComLote(tx);

        await expect(
          cancelarLote(tx, lote.loteId, '   ', usuario.id),
        ).rejects.toThrow(/motivo/i);

        await aprovarLote(tx, lote.loteId, usuario.id);
        await expect(
          cancelarLote(tx, lote.loteId, 'Depois de aprovado', usuario.id),
        ).rejects.toThrow(ErroValidacao);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('desfazer aprovação volta para enviado e limpa quem aprovou', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { lote } = await osComLote(tx);
        await aprovarLote(tx, lote.loteId, usuario.id);

        await desfazerAprovacaoLote(tx, lote.loteId, 'Cliquei sem querer', usuario.id);

        const [linha] = await tx`
          select estado_conferencia, aprovado_em, aprovado_por
          from public.lote_financeiro where id = ${lote.loteId}
        `;
        expect(linha.estado_conferencia).toBe('enviado');
        expect(linha.aprovado_em).toBeNull();
        expect(linha.aprovado_por).toBeNull();

        await expect(
          desfazerAprovacaoLote(tx, lote.loteId, 'De novo', usuario.id),
        ).rejects.toThrow(ErroValidacao);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('ciclo completo: cancelar, corrigir a OS e gerar o substituto vinculado', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const { osId, dados, lote } = await osComLote(tx);

        await cancelarLote(tx, lote.loteId, 'Valor errado', usuario.id);
        await editarOs(tx, osId, { ...dados, valor: 600_000n }, usuario.id);

        const substituto = await gerarLote(
          tx,
          { osIds: [osId], observacao: null, loteOrigemId: lote.loteId },
          usuario.id,
        );

        // 7% de R$ 6.000 = R$ 420,00; metade paga (R$ 500 de R$ 600) libera
        // R$ 350,00 — o cliente já pagou mais de 80% do valor corrigido.
        const detalhe = await obterOsPorId(osId, false, tx);
        expect(detalhe?.comissaoTotal).toBe(42_000n);
        expect(substituto.valorTotal).toBe(detalhe!.comissaoLiberada);

        const [novo] = await tx`
          select lote_origem_id from public.lote_financeiro where id = ${substituto.loteId}
        `;
        expect(novo.lote_origem_id).toBe(lote.loteId);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  afterAll(async () => {
    await usuario.remover();
    await sql.end();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npm run test:integracao -- lotes-ciclo`
Expected: FAIL — `cancelarLote` e `desfazerAprovacaoLote` não são exportados.

- [ ] **Passo 3: Aceitar `loteOrigemId` em `gerarLote`**

Em `src/servidor/lotes/servico.ts`, na interface `DadosGerarLote`, acrescentar:

```ts
  /** Preenchido quando este lote substitui um lote cancelado. */
  loteOrigemId?: string;
```

E no `insert into public.lote_financeiro`, acrescentar a coluna e o valor:

```sql
      (estado_conferencia, data_envio, enviado_em, enviado_por,
       valor_total_original, observacao, lote_origem_id, criado_por, atualizado_por)
    values (
      'enviado', ${dataEnvio}, now(), ${usuarioId},
      ${paraDecimalDb(valorTotal)}, ${dados.observacao},
      ${dados.loteOrigemId ?? null}, ${usuarioId}, ${usuarioId}
    )
```

- [ ] **Passo 4: Implementar as duas ações**

Acrescentar ao final de `src/servidor/lotes/servico.ts`:

```ts
/**
 * Cancelar não apaga nada: o lote continua existindo, marcado como cancelado,
 * e os itens permanecem. A liberação das reservas é automática — todo cálculo
 * de comissão comprometida já ignora lotes cancelados.
 */
export async function cancelarLote(
  tx: postgres.TransactionSql,
  loteId: string,
  motivo: string,
  usuarioId: string,
): Promise<void> {
  const motivoLimpo = motivo.trim();
  if (motivoLimpo === '') {
    throw new ErroValidacao('O motivo do cancelamento é obrigatório', 'motivo');
  }

  const [lote] = await tx`
    select estado_conferencia from public.lote_financeiro
    where id = ${loteId} for update
  `;
  if (!lote) throw new ErroValidacao('Lote não encontrado');
  if (lote.estado_conferencia !== 'enviado') {
    throw new ErroValidacao(
      lote.estado_conferencia === 'aprovado'
        ? 'Este lote já foi aprovado. Desfaça a aprovação antes de cancelar.'
        : 'Só é possível cancelar um lote que está aguardando conferência.',
    );
  }

  await tx`
    update public.lote_financeiro
    set estado_conferencia = 'cancelado',
        motivo_cancelamento = ${motivoLimpo},
        versao = versao + 1,
        atualizado_por = ${usuarioId}
    where id = ${loteId}
  `;

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro',
    entidadeId: loteId,
    acao: 'cancelar',
    responsavelId: usuarioId,
    motivo: motivoLimpo,
    valoresAnteriores: { estadoConferencia: lote.estado_conferencia },
    valoresNovos: { estadoConferencia: 'cancelado' },
  });
}

/**
 * Aprovar é, no fluxo do usuário, o registro de que o dinheiro entrou. Desfazer
 * existe para que um clique errado não vire um beco sem saída.
 */
export async function desfazerAprovacaoLote(
  tx: postgres.TransactionSql,
  loteId: string,
  motivo: string,
  usuarioId: string,
): Promise<void> {
  const motivoLimpo = motivo.trim();
  if (motivoLimpo === '') {
    throw new ErroValidacao('O motivo é obrigatório', 'motivo');
  }

  const [lote] = await tx`
    select estado_conferencia, aprovado_em from public.lote_financeiro
    where id = ${loteId} for update
  `;
  if (!lote) throw new ErroValidacao('Lote não encontrado');
  if (lote.estado_conferencia !== 'aprovado') {
    throw new ErroValidacao('Só é possível desfazer a aprovação de um lote aprovado.');
  }

  await tx`
    update public.lote_financeiro
    set estado_conferencia = 'enviado',
        aprovado_em = null,
        aprovado_por = null,
        versao = versao + 1,
        atualizado_por = ${usuarioId}
    where id = ${loteId}
  `;

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro',
    entidadeId: loteId,
    acao: 'desfazer_aprovacao',
    responsavelId: usuarioId,
    motivo: motivoLimpo,
    valoresAnteriores: { estadoConferencia: 'aprovado', aprovadoEm: lote.aprovado_em },
    valoresNovos: { estadoConferencia: 'enviado' },
  });
}
```

- [ ] **Passo 5: Rodar e ver passar**

Run: `npm run test:integracao -- lotes-ciclo` → PASS.
Run: `npm test` → suíte inteira verde.

- [ ] **Passo 6: Commit**

```bash
git add src/servidor/lotes/servico.ts tests/integracao/lotes-ciclo.test.ts
git commit -m "feat(servidor): cancelar lote, desfazer aprovacao e vincular substituto"
```

---

### Tarefa 6: Consultas — pagamentos com estorno e vínculos do lote

**Files:**
- Modify: `src/servidor/os/consultas.ts` (a lista `baixas` de `OsDetalhe`)
- Modify: `src/servidor/lotes/consultas.ts` (`LoteDetalhe`)
- Test: `tests/integracao/os-consultas.test.ts` e `tests/integracao/lotes-consultas.test.ts` (acrescentar asserções aos casos existentes)

**Interfaces:**
- Produces (ampliação de `OsDetalhe`):
  - `baixas: { id: string; data: string; valor: Centavos; tipo: 'recebimento' | 'estorno'; motivo: string | null; estornado: Centavos }[]`
- Produces (ampliação de `LoteDetalhe`):
  - `motivoCancelamento: string | null`
  - `loteOrigem: { id: string; numero: number } | null`
  - `loteSubstituto: { id: string; numero: number } | null`

**Contexto:** a tela precisa distinguir um recebimento de um estorno, mostrar o motivo do estorno, e saber quanto de um recebimento já foi estornado — é isso que decide se o botão "Estornar" ainda faz sentido naquela linha. `estornado` é sempre `0n` numa linha que já é estorno.

Os vínculos do lote são os dois lados da substituição: `loteOrigem` é para onde este lote aponta, e `loteSubstituto` é quem aponta para ele.

- [ ] **Passo 1: Escrever as asserções que falham**

Em `tests/integracao/os-consultas.test.ts`, dentro do caso `'lista e detalha uma OS com pagamento parcial'`, logo depois do `expect(semRateio?.baixas).toHaveLength(1);`, acrescentar:

```ts
        expect(semRateio?.baixas[0]).toMatchObject({
          tipo: 'recebimento',
          motivo: null,
          estornado: 0n,
        });
```

Em `tests/integracao/lotes-consultas.test.ts`, dentro do caso `'lista o lote enviado e detalha com e sem rateio'`, logo depois do `expect(semRateio?.observacao).toBe('lote de teste');`, acrescentar:

```ts
        expect(semRateio).toMatchObject({
          motivoCancelamento: null,
          loteOrigem: null,
          loteSubstituto: null,
        });
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npm run test:integracao -- os-consultas`
Expected: FAIL — as propriedades não existem (o TypeScript acusa antes).

- [ ] **Passo 3: Ampliar `obterOsPorId`**

Em `src/servidor/os/consultas.ts`, na interface `OsDetalhe`, substituir a linha de `baixas` por:

```ts
  baixas: {
    id: string;
    data: string;
    valor: Centavos;
    tipo: 'recebimento' | 'estorno';
    motivo: string | null;
    estornado: Centavos;
  }[];
```

Substituir a consulta de baixas por:

```ts
  const baixas = await exec`
    select b.id, to_char(b.data_efetiva, 'YYYY-MM-DD') as data_efetiva,
      b.valor, b.tipo, b.observacao,
      (
        select coalesce(sum(e.valor), 0)
        from public.baixa_cliente e
        where e.baixa_origem_id = b.id and e.tipo = 'estorno'
      ) as estornado
    from public.baixa_cliente b
    where b.os_id = ${osId}
    order by b.data_efetiva, b.criado_em
  `;
```

E o `map` final de baixas por:

```ts
    baixas: baixas.map((b) => ({
      id: b.id,
      data: b.data_efetiva,
      valor: parseDecimal(b.valor),
      tipo: b.tipo as 'recebimento' | 'estorno',
      motivo: b.observacao,
      estornado: parseDecimal(b.estornado),
    })),
```

- [ ] **Passo 4: Ampliar `obterLotePorId`**

Em `src/servidor/lotes/consultas.ts`, na interface `LoteDetalhe`, acrescentar depois de `observacao`:

```ts
  motivoCancelamento: string | null;
  loteOrigem: { id: string; numero: number } | null;
  loteSubstituto: { id: string; numero: number } | null;
```

Na consulta do cabeçalho do lote, acrescentar as colunas e os vínculos:

```ts
  const [lote] = await exec`
    select lf.id, lf.numero, lf.estado_conferencia,
      to_char(lf.data_envio, 'YYYY-MM-DD') as data_envio,
      lf.valor_total_original, lf.observacao, lf.motivo_cancelamento,
      origem.id as origem_id, origem.numero as origem_numero,
      substituto.id as substituto_id, substituto.numero as substituto_numero
    from public.lote_financeiro lf
    left join public.lote_financeiro origem on origem.id = lf.lote_origem_id
    left join public.lote_financeiro substituto on substituto.lote_origem_id = lf.id
    where lf.id = ${loteId}
  `;
```

E no objeto devolvido, acrescentar depois de `observacao: lote.observacao,`:

```ts
    motivoCancelamento: lote.motivo_cancelamento,
    loteOrigem: lote.origem_id
      ? { id: lote.origem_id, numero: Number(lote.origem_numero) }
      : null,
    loteSubstituto: lote.substituto_id
      ? { id: lote.substituto_id, numero: Number(lote.substituto_numero) }
      : null,
```

- [ ] **Passo 5: Rodar e ver passar**

Run: `npm test` → suíte inteira verde.

- [ ] **Passo 6: Commit**

```bash
git add src/servidor/os/consultas.ts src/servidor/lotes/consultas.ts tests/integracao/os-consultas.test.ts tests/integracao/lotes-consultas.test.ts
git commit -m "feat(servidor): pagamentos com tipo e estorno, e vinculos de substituicao do lote"
```

---

### Tarefa 7: Server actions das quatro correções

**Files:**
- Modify: `src/servidor/os/acoes.ts`, `src/servidor/baixas/acoes.ts`, `src/servidor/lotes/acoes.ts`

**Interfaces:**
- Produces:
  - `editarOsAction(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>` — redireciona para `/os/[id]` em sucesso
  - `estornarBaixaAction(_estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>` — permanece na página da OS
  - `cancelarLoteAction(loteId: string, motivo: string): Promise<{ erro: string | null }>`
  - `desfazerAprovacaoAction(loteId: string, motivo: string): Promise<{ erro: string | null }>`

**Contexto:** todas seguem o padrão já estabelecido no projeto — `exigirPapel('admin')` dentro do `try`, `comTransacaoFinanceira` para a mutação, `tratarErroFormulario` no `catch`, e o `redirect()` **fora** do `try`, porque ele sinaliza por exceção e seria capturado.

As duas ações de lote devolvem `{ erro }` em vez de `EstadoFormulario` para acompanhar a `aprovarLoteAction` que já existe no arquivo.

- [ ] **Passo 1: Acrescentar `editarOsAction` a `src/servidor/os/acoes.ts`**

```ts
export async function editarOsAction(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const osId = String(formData.get('osId') ?? '');
  try {
    const sessao = await exigirPapel('admin');
    const dados = {
      numeroOs: String(formData.get('numeroOs') ?? ''),
      cliente: String(formData.get('cliente') ?? ''),
      produto: String(formData.get('produto') ?? ''),
      tipoPagamento: String(formData.get('tipoPagamento') ?? ''),
      valor: parseDecimal(String(formData.get('valor') ?? '')),
      percentualComissao: parsePercentual(String(formData.get('percentualComissao') ?? '')),
      dataVenda: validarDataIso(String(formData.get('dataVenda') ?? ''), 'dataVenda'),
      observacao: String(formData.get('observacao') ?? '').trim() || null,
      rateio: {
        thiago: parsePercentual(String(formData.get('rateioThiago') ?? '')),
        geice: parsePercentual(String(formData.get('rateioGeice') ?? '')),
        gabrielle: parsePercentual(String(formData.get('rateioGabrielle') ?? '')),
      },
    };
    await comTransacaoFinanceira((tx) => editarOs(tx, osId, dados, sessao.userId));
  } catch (erro) {
    return tratarErroFormulario(erro);
  }

  // Fora do try: redirect() sinaliza por exceção e não pode ser capturado aqui.
  revalidatePath('/os');
  revalidatePath(`/os/${osId}`);
  revalidatePath('/');
  redirect(`/os/${osId}`);
}
```

Acrescentar `editarOs` ao import de `./servico`, sem remover `cadastrarOs`.

- [ ] **Passo 2: Acrescentar `estornarBaixaAction` a `src/servidor/baixas/acoes.ts`**

```ts
export async function estornarBaixaAction(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const osId = String(formData.get('osId') ?? '');
  try {
    const sessao = await exigirPapel('admin');
    await comTransacaoFinanceira((tx) =>
      estornarBaixaCliente(
        tx,
        {
          baixaId: String(formData.get('baixaId') ?? ''),
          valor: parseDecimal(String(formData.get('valor') ?? '')),
          data: String(formData.get('data') ?? ''),
          motivo: String(formData.get('motivo') ?? ''),
        },
        sessao.userId,
      ),
    );
  } catch (erro) {
    return tratarErroFormulario(erro);
  }

  revalidatePath('/os');
  revalidatePath(`/os/${osId}`);
  revalidatePath('/');
  return ESTADO_INICIAL_FORMULARIO;
}
```

Acrescentar `estornarBaixaCliente` ao import de `./servico` e `ESTADO_INICIAL_FORMULARIO` ao import de `@/servidor/formularios`.

- [ ] **Passo 3: Acrescentar as duas ações de lote a `src/servidor/lotes/acoes.ts`**

```ts
async function mudarEstadoDoLote(
  loteId: string,
  motivo: string,
  acao: (tx: Parameters<typeof cancelarLote>[0], usuarioId: string) => Promise<void>,
): Promise<{ erro: string | null }> {
  try {
    const sessao = await exigirPapel('admin');
    await comTransacaoFinanceira((tx) => acao(tx, sessao.userId));
  } catch (erro) {
    if (erro instanceof ErroValidacao || erro instanceof ErroPermissao) {
      return { erro: erro.message };
    }
    console.error(erro);
    return { erro: 'Ocorreu um erro inesperado. Tente novamente.' };
  }

  revalidatePath('/lotes');
  revalidatePath(`/lotes/${loteId}`);
  revalidatePath('/os');
  revalidatePath('/');
  return { erro: null };
}

export async function cancelarLoteAction(
  loteId: string,
  motivo: string,
): Promise<{ erro: string | null }> {
  return mudarEstadoDoLote(loteId, motivo, (tx, usuarioId) =>
    cancelarLote(tx, loteId, motivo, usuarioId),
  );
}

export async function desfazerAprovacaoAction(
  loteId: string,
  motivo: string,
): Promise<{ erro: string | null }> {
  return mudarEstadoDoLote(loteId, motivo, (tx, usuarioId) =>
    desfazerAprovacaoLote(tx, loteId, motivo, usuarioId),
  );
}
```

Acrescentar `cancelarLote` e `desfazerAprovacaoLote` ao import de `./servico`.

**Nota:** `revalidatePath('/os')` e `revalidatePath('/')` aparecem nas quatro ações porque qualquer uma delas muda a comissão disponível — que a lista de OS e o painel exibem. Esquecer isso faria o painel mostrar número velho até o próximo recarregamento forçado.

- [ ] **Passo 4: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.

- [ ] **Passo 5: Commit**

```bash
git add src/servidor/os/acoes.ts src/servidor/baixas/acoes.ts src/servidor/lotes/acoes.ts
git commit -m "feat(servidor): acoes de editar OS, estornar recebimento, cancelar e desfazer lote"
```

---

### Tarefa 8: Tela de editar OS

**Files:**
- Create: `src/app/(app)/os/[id]/editar/page.tsx`, `src/app/(app)/os/[id]/editar/FormularioEditarOs.tsx`

**Interfaces:**
- Consumes: `obterOsPorId`, `situacaoDaOs`, `editarOsAction`, `sessaoDaPagina`; `Botao`, `Campo`, `CampoTexto`, `CampoMoeda`, `CampoPercentual`, `CLASSE_ENTRADA`, `Moeda`.

**Contexto:** a trava aparece **antes** de tentar salvar, não só depois. Quando há lote reservando comissão, o formulário mostra um aviso com o valor reservado e **desabilita o rateio** — cuja trava é binária. Valor e percentual ficam habilitados, porque aumentá-los nunca quebra reserva; o servidor faz a checagem exata ao salvar.

- [ ] **Passo 1: Criar `src/app/(app)/os/[id]/editar/FormularioEditarOs.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { Campo, CampoTexto, CLASSE_ENTRADA } from '@/componentes/Campo';
import { CampoMoeda, CampoPercentual } from '@/componentes/CampoMoeda';
import { Moeda } from '@/componentes/Moeda';
import { formatarPercentual, type Centavos, type Percentual } from '@/dominio/dinheiro';
import { editarOsAction } from '@/servidor/os/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

function paraTexto(percentual: Percentual): string {
  return formatarPercentual(percentual).replace('%', '');
}

export interface ValoresIniciaisOs {
  numeroOs: string;
  cliente: string;
  produto: string;
  tipoPagamento: string;
  dataVenda: string;
  observacao: string;
  valor: string;
  percentualComissao: Percentual;
  rateio: { thiago: Percentual; geice: Percentual; gabrielle: Percentual };
}

export function FormularioEditarOs({
  osId,
  iniciais,
  comprometido,
  numerosDeLote,
}: {
  osId: string;
  iniciais: ValoresIniciaisOs;
  comprometido: Centavos;
  numerosDeLote: number[];
}) {
  const [estado, acao, emAndamento] = useActionState(
    editarOsAction,
    ESTADO_INICIAL_FORMULARIO,
  );
  const travado = comprometido > 0n;

  return (
    <form action={acao} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="osId" value={osId} />

      {travado && (
        <p className="rounded-xl border border-destaque bg-destaque-suave p-3.5 text-[13px] text-texto">
          <strong>
            <Moeda valor={comprometido} />
          </strong>{' '}
          desta OS já estão reservados{' '}
          {numerosDeLote.length === 1
            ? `no lote ${numerosDeLote[0]}`
            : `nos lotes ${numerosDeLote.join(', ')}`}
          . Você pode aumentar o valor, mas não reduzi-lo abaixo do necessário para
          cobrir essa reserva — e o rateio só muda depois de cancelar o lote.
        </p>
      )}

      <CampoTexto
        nome="numeroOs"
        id="numeroOs"
        rotulo="Número da OS"
        defaultValue={iniciais.numeroOs}
        required
        erro={estado.errosPorCampo.numeroOs}
      />
      <CampoTexto
        nome="cliente"
        id="cliente"
        rotulo="Cliente"
        defaultValue={iniciais.cliente}
        required
        erro={estado.errosPorCampo.cliente}
      />
      <CampoTexto
        nome="produto"
        id="produto"
        rotulo="Produto"
        defaultValue={iniciais.produto}
        required
        erro={estado.errosPorCampo.produto}
      />
      <CampoTexto
        nome="tipoPagamento"
        id="tipoPagamento"
        rotulo="Tipo de pagamento"
        defaultValue={iniciais.tipoPagamento}
        required
        erro={estado.errosPorCampo.tipoPagamento}
      />
      <CampoMoeda
        nome="valor"
        id="valor"
        rotulo="Valor da OS"
        valorInicial={iniciais.valor}
        obrigatorio
        erro={estado.errosPorCampo.valor}
      />
      <Campo rotulo="Data da venda" htmlFor="dataVenda" erro={estado.errosPorCampo.dataVenda}>
        <input
          type="date"
          name="dataVenda"
          id="dataVenda"
          defaultValue={iniciais.dataVenda}
          required
          className={`num ${CLASSE_ENTRADA}`}
        />
      </Campo>
      <CampoPercentual
        nome="percentualComissao"
        id="percentualComissao"
        rotulo="% de comissão total"
        valorInicial={paraTexto(iniciais.percentualComissao)}
        obrigatorio
        erro={estado.errosPorCampo.percentualComissao}
      />

      <fieldset
        disabled={travado}
        className={`rounded-xl border border-borda bg-superficie p-4 ${
          travado ? 'opacity-60' : ''
        }`}
      >
        <legend className="rotulo px-1">
          Rateio {travado ? '· travado por lote pendente' : '· precisa somar o percentual total'}
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoPercentual
            nome="rateioThiago"
            id="rateioThiago"
            rotulo="Thiago"
            valorInicial={paraTexto(iniciais.rateio.thiago)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_thiago}
          />
          <CampoPercentual
            nome="rateioGeice"
            id="rateioGeice"
            rotulo="Geice"
            valorInicial={paraTexto(iniciais.rateio.geice)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_geice}
          />
          <CampoPercentual
            nome="rateioGabrielle"
            id="rateioGabrielle"
            rotulo="Gabrielle"
            valorInicial={paraTexto(iniciais.rateio.gabrielle)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_gabrielle}
          />
        </div>
      </fieldset>

      <Campo rotulo="Observação" htmlFor="observacao">
        <textarea
          name="observacao"
          id="observacao"
          rows={3}
          defaultValue={iniciais.observacao}
          className={CLASSE_ENTRADA}
        />
      </Campo>

      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal className="sm:w-fit">
        Salvar correção
      </Botao>
    </form>
  );
}
```

**Atenção a um detalhe que quebra silenciosamente:** um `<fieldset disabled>` faz o navegador **não enviar** os campos de dentro. Com o rateio travado, o `FormData` chegaria sem `rateioThiago` e o servidor leria `''`, que `parsePercentual` recusa. Por isso o Passo 2 acrescenta três campos ocultos com os valores atuais do rateio, fora do fieldset, que garantem o envio. Eles são ignorados quando o fieldset está habilitado, porque o campo visível vem depois no formulário e prevalece na leitura por `formData.get`.

- [ ] **Passo 2: Garantir o envio do rateio travado**

Ainda em `FormularioEditarOs.tsx`, logo **acima** do `<fieldset>`, acrescentar:

```tsx
      {travado && (
        <>
          <input type="hidden" name="rateioThiago" value={paraTexto(iniciais.rateio.thiago)} />
          <input type="hidden" name="rateioGeice" value={paraTexto(iniciais.rateio.geice)} />
          <input
            type="hidden"
            name="rateioGabrielle"
            value={paraTexto(iniciais.rateio.gabrielle)}
          />
        </>
      )}
```

- [ ] **Passo 3: Criar `src/app/(app)/os/[id]/editar/page.tsx`**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { paraDecimalDb } from '@/dominio/dinheiro';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterOsPorId } from '@/servidor/os/consultas';
import { situacaoDaOs } from '@/servidor/os/travas';
import { FormularioEditarOs } from './FormularioEditarOs';

export default async function PaginaEditarOs({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await sessaoDaPagina('admin');
  const { id } = await params;
  const os = await obterOsPorId(id, true);
  const situacao = await situacaoDaOs(id);
  if (!os || !os.rateio || !situacao) notFound();

  return (
    <main>
      <h1 className="mb-1 text-[1.375rem] font-bold tracking-tight md:text-2xl">
        Editar OS <span className="num text-destaque">{os.numeroOs}</span>
      </h1>
      <p className="mb-6 max-w-xl text-[13.5px] text-texto-2">
        Correções ficam registradas na auditoria com o valor antigo e o novo. Os lotes
        já emitidos não mudam — eles guardam a própria cópia dos dados.
      </p>

      <FormularioEditarOs
        osId={os.id}
        comprometido={situacao.comprometido}
        numerosDeLote={situacao.lotes.map((l) => l.numero)}
        iniciais={{
          numeroOs: os.numeroOs,
          cliente: os.cliente,
          produto: os.produto,
          tipoPagamento: os.tipoPagamento,
          dataVenda: os.dataVenda,
          observacao: '',
          valor: paraDecimalDb(os.valor).replace('.', ','),
          percentualComissao: os.percentualComissao,
          rateio: os.rateio,
        }}
      />

      <p className="mt-8">
        <Link href={`/os/${os.id}`} className="text-[13px] text-texto-2 underline">
          ← Voltar sem salvar
        </Link>
      </p>
    </main>
  );
}
```

**Nota sobre `observacao`:** `OsDetalhe` não projeta a observação hoje, então o formulário abre com o campo vazio e salvar sem preencher a apaga. Para não perder dado, o Passo 4 acrescenta a coluna à consulta.

- [ ] **Passo 4: Projetar `observacao` em `obterOsPorId`**

Em `src/servidor/os/consultas.ts`: acrescentar `observacao: string | null;` à interface `OsDetalhe`, acrescentar `o.observacao` à lista de colunas da função `projecaoOs`, acrescentar `observacao: string | null;` à interface `LinhaOs`, e `observacao: linha.observacao,` ao objeto devolvido por `obterOsPorId`.

Depois, em `editar/page.tsx`, trocar `observacao: ''` por `observacao: os.observacao ?? ''`.

- [ ] **Passo 5: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso, com a rota `/os/[id]/editar` na lista.
Run: `npm test` → suíte inteira verde.

- [ ] **Passo 6: Commit**

```bash
git add "src/app/(app)/os/[id]/editar" src/servidor/os/consultas.ts
git commit -m "feat(visual): tela de editar OS com aviso de comissao reservada"
```

---

### Tarefa 9: Detalhe da OS — editar e estornar

**Files:**
- Create: `src/app/(app)/os/[id]/EstornarBaixa.tsx`
- Modify: `src/app/(app)/os/[id]/page.tsx`

**Interfaces:**
- Consumes: `estornarBaixaAction`; `Botao`, `BotaoLink`, `Campo`, `CampoMoeda`, `CampoTexto`, `CLASSE_ENTRADA`, `Moeda`; `hojeNegocio`, `formatarDataBr`, `paraDecimalDb`.

**Contexto:** cada recebimento ganha "Estornar", que abre um formulário embutido na própria linha — valor (já preenchido com o saldo ainda não estornado), data e motivo. O botão some quando o recebimento já foi totalmente estornado. Estornos aparecem como linha negativa, com o motivo à vista.

- [ ] **Passo 1: Criar `src/app/(app)/os/[id]/EstornarBaixa.tsx`**

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Botao } from '@/componentes/Botao';
import { Campo, CampoTexto, CLASSE_ENTRADA } from '@/componentes/Campo';
import { CampoMoeda } from '@/componentes/CampoMoeda';
import { estornarBaixaAction } from '@/servidor/baixas/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

export function EstornarBaixa({
  osId,
  baixaId,
  saldoEstornavel,
  dataPadrao,
}: {
  osId: string;
  baixaId: string;
  /** Já formatado para o campo, ex.: "5000,00". */
  saldoEstornavel: string;
  dataPadrao: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, emAndamento] = useActionState(
    estornarBaixaAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="min-h-11 px-1 text-[12.5px] text-texto-2 underline"
      >
        Estornar
      </button>
    );
  }

  return (
    <form action={acao} className="mt-3 flex flex-col gap-3 rounded-xl border border-borda bg-superficie-2 p-3.5">
      <input type="hidden" name="osId" value={osId} />
      <input type="hidden" name="baixaId" value={baixaId} />
      <p className="text-[12.5px] text-texto-2">
        O recebimento não é apagado: o estorno entra como um lançamento de sinal
        contrário, vinculado a ele.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoMoeda
          nome="valor"
          id={`valor-${baixaId}`}
          rotulo="Valor a estornar"
          valorInicial={saldoEstornavel}
          obrigatorio
          erro={estado.errosPorCampo.valor}
        />
        <Campo rotulo="Data" htmlFor={`data-${baixaId}`} erro={estado.errosPorCampo.data}>
          <input
            type="date"
            name="data"
            id={`data-${baixaId}`}
            defaultValue={dataPadrao}
            required
            className={`num ${CLASSE_ENTRADA}`}
          />
        </Campo>
      </div>
      <CampoTexto
        nome="motivo"
        id={`motivo-${baixaId}`}
        rotulo="Motivo"
        required
        erro={estado.errosPorCampo.motivo}
      />
      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={emAndamento}>
          Confirmar estorno
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
```

- [ ] **Passo 2: Acrescentar "Editar" ao cabeçalho em `src/app/(app)/os/[id]/page.tsx`**

Trocar o bloco da ação do cabeçalho por:

```tsx
        {ehAdmin && (
          <div className="flex flex-wrap gap-2">
            <BotaoLink href={`/os/${os.id}/editar`} variante="secundario">
              Editar
            </BotaoLink>
            <BotaoLink href={`/os/${os.id}/baixas/nova`}>Registrar pagamento</BotaoLink>
          </div>
        )}
```

- [ ] **Passo 3: Reescrever a seção de pagamentos no mesmo arquivo**

Substituir a `<section>` de "Pagamentos do cliente" por:

```tsx
      <section className="mb-4 rounded-xl border border-borda bg-superficie p-4">
        <h2 className="mb-3 text-sm font-semibold">Pagamentos do cliente</h2>
        {os.baixas.length === 0 ? (
          <p className="text-[13.5px] text-texto-2">
            Nenhum pagamento registrado ainda. Enquanto o cliente não pagar, nenhuma
            comissão é liberada.
          </p>
        ) : (
          <ul>
            {os.baixas.map((baixa) => {
              const ehEstorno = baixa.tipo === 'estorno';
              const saldo = baixa.valor - baixa.estornado;
              return (
                <li key={baixa.id} className="border-b border-borda py-3 last:border-b-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13.5px]">
                    <span className="num">
                      {formatarDataBr(baixa.data)}
                      {ehEstorno && <span className="ml-2 text-erro">estorno</span>}
                    </span>
                    <span className={ehEstorno ? 'text-erro' : ''}>
                      {ehEstorno && '− '}
                      <Moeda valor={baixa.valor} className="font-medium" />
                    </span>
                  </div>
                  {baixa.motivo && (
                    <p className="mt-1 text-[12.5px] text-texto-2">{baixa.motivo}</p>
                  )}
                  {!ehEstorno && baixa.estornado > 0n && (
                    <p className="mt-1 text-[12.5px] text-texto-2">
                      Estornado: <Moeda valor={baixa.estornado} />
                    </p>
                  )}
                  {ehAdmin && !ehEstorno && saldo > 0n && (
                    <EstornarBaixa
                      osId={os.id}
                      baixaId={baixa.id}
                      saldoEstornavel={paraDecimalDb(saldo).replace('.', ',')}
                      dataPadrao={hojeNegocio()}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
```

Acrescentar aos imports do arquivo: `BotaoLink` já vem de `@/componentes/Botao`; acrescentar `hojeNegocio` a `@/dominio/datas`, `paraDecimalDb` a `@/dominio/dinheiro`, e `import { EstornarBaixa } from './EstornarBaixa';`.

- [ ] **Passo 4: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.

- [ ] **Passo 5: Commit**

```bash
git add "src/app/(app)/os/[id]/EstornarBaixa.tsx" "src/app/(app)/os/[id]/page.tsx"
git commit -m "feat(visual): acoes de editar OS e estornar recebimento no detalhe"
```

---

### Tarefa 10: Detalhe do lote — cancelar, desfazer e substituto

**Files:**
- Modify: `src/app/(app)/lotes/[id]/AcoesLote.tsx`, `src/app/(app)/lotes/[id]/page.tsx`

**Interfaces:**
- Consumes: `aprovarLoteAction`, `cancelarLoteAction`, `desfazerAprovacaoAction`; `Botao`, `BotaoLink`, `CLASSE_ENTRADA`.

**Contexto:** as três ações mudam estado e todas menos aprovar exigem motivo. O componente mostra apenas as ações válidas para o estado atual: `enviado` → aprovar e cancelar; `aprovado` → desfazer aprovação; `cancelado` → nenhuma, mais o atalho para gerar o substituto.

- [ ] **Passo 1: Substituir `src/app/(app)/lotes/[id]/AcoesLote.tsx` inteiro**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/Botao';
import { CLASSE_ENTRADA } from '@/componentes/Campo';
import {
  aprovarLoteAction,
  cancelarLoteAction,
  desfazerAprovacaoAction,
} from '@/servidor/lotes/acoes';

type ComMotivo = 'cancelar' | 'desfazer';

const TEXTOS: Record<ComMotivo, { botao: string; titulo: string; confirmar: string }> = {
  cancelar: {
    botao: 'Cancelar lote',
    titulo:
      'Cancelar devolve a comissão deste lote para "disponível". O documento continua existindo, marcado como cancelado.',
    confirmar: 'Confirmar cancelamento',
  },
  desfazer: {
    botao: 'Desfazer aprovação',
    titulo:
      'O lote volta para "aguardando conferência". Use se a aprovação foi por engano.',
    confirmar: 'Confirmar',
  },
};

export function AcoesLote({
  loteId,
  estadoConferencia,
}: {
  loteId: string;
  estadoConferencia: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<ComMotivo | null>(null);
  const [motivo, setMotivo] = useState('');
  const [pendente, iniciarTransicao] = useTransition();

  function executar(promessa: Promise<{ erro: string | null }>) {
    iniciarTransicao(async () => {
      const resultado = await promessa;
      setErro(resultado.erro);
      if (!resultado.erro) {
        setAberto(null);
        setMotivo('');
      }
    });
  }

  if (aberto) {
    const texto = TEXTOS[aberto];
    return (
      <div className="flex max-w-md flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
        <p className="text-[13px] text-texto-2">{texto.titulo}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-texto-2">Motivo</span>
          <input
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            className={CLASSE_ENTRADA}
          />
        </label>
        {erro && (
          <p role="alert" className="text-[13px] text-erro">
            {erro}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            variante={aberto === 'cancelar' ? 'destrutivo' : 'primario'}
            carregando={pendente}
            disabled={motivo.trim() === ''}
            onClick={() =>
              executar(
                aberto === 'cancelar'
                  ? cancelarLoteAction(loteId, motivo)
                  : desfazerAprovacaoAction(loteId, motivo),
              )
            }
          >
            {texto.confirmar}
          </Botao>
          <Botao
            type="button"
            variante="secundario"
            onClick={() => {
              setAberto(null);
              setErro(null);
            }}
          >
            Voltar
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {estadoConferencia === 'enviado' && (
          <>
            <Botao
              type="button"
              carregando={pendente}
              onClick={() => executar(aprovarLoteAction(loteId))}
            >
              Marcar como aprovado pelo financeiro
            </Botao>
            <Botao type="button" variante="destrutivo" onClick={() => setAberto('cancelar')}>
              {TEXTOS.cancelar.botao}
            </Botao>
          </>
        )}
        {estadoConferencia === 'aprovado' && (
          <Botao type="button" variante="secundario" onClick={() => setAberto('desfazer')}>
            {TEXTOS.desfazer.botao}
          </Botao>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-[13px] text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Passo 2: Mostrar cancelamento e vínculos em `src/app/(app)/lotes/[id]/page.tsx`**

Logo abaixo do parágrafo que mostra total e data de envio, acrescentar:

```tsx
      {lote.motivoCancelamento && (
        <p className="mb-4 rounded-xl border border-erro bg-erro-suave p-3.5 text-[13px]">
          <strong>Lote cancelado.</strong> {lote.motivoCancelamento}
          {lote.loteSubstituto && (
            <>
              {' '}
              Substituído pelo{' '}
              <Link
                href={`/lotes/${lote.loteSubstituto.id}`}
                className="font-semibold underline"
              >
                lote {lote.loteSubstituto.numero}
              </Link>
              .
            </>
          )}
        </p>
      )}

      {lote.loteOrigem && (
        <p className="mb-4 text-[13px] text-texto-2">
          Substitui o{' '}
          <Link href={`/lotes/${lote.loteOrigem.id}`} className="underline">
            lote {lote.loteOrigem.numero}
          </Link>
          , que foi cancelado.
        </p>
      )}

      {ehAdmin && lote.estadoConferencia === 'cancelado' && !lote.loteSubstituto && (
        <div className="mb-6">
          <BotaoLink href={`/lotes/gerar?origem=${lote.id}`}>Gerar lote substituto</BotaoLink>
        </div>
      )}
```

Acrescentar `BotaoLink` ao import de `@/componentes/Botao`.

- [ ] **Passo 3: Aceitar `origem` na tela de gerar lote**

Em `src/app/(app)/lotes/gerar/page.tsx`, aceitar o parâmetro e repassá-lo:

```tsx
export default async function PaginaGerarLote({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string }>;
}) {
  await sessaoDaPagina('admin');
  const { origem } = await searchParams;
  const osElegiveis = await listarOsComComissaoDisponivel();
  // ... resto igual, passando loteOrigemId={origem ?? null} ao formulário
```

Em `FormularioGerarLote.tsx`, aceitar `loteOrigemId: string | null` nas props e, quando não for nulo, renderizar dentro do `<form>`:

```tsx
      {loteOrigemId && <input type="hidden" name="loteOrigemId" value={loteOrigemId} />}
```

E em `gerarLoteAction` (`src/servidor/lotes/acoes.ts`), ler o campo e repassá-lo:

```ts
  const loteOrigemId = String(formData.get('loteOrigemId') ?? '') || undefined;
```
passando `loteOrigemId` no objeto entregue a `gerarLote`.

- [ ] **Passo 4: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.
Run: `npm test` → suíte inteira verde.

- [ ] **Passo 5: Commit**

```bash
git add "src/app/(app)/lotes" src/servidor/lotes/acoes.ts
git commit -m "feat(visual): cancelar lote, desfazer aprovacao e gerar substituto na tela"
```

---

### Tarefa 11: Verificação final

**Files:** nenhum arquivo novo.

- [ ] **Passo 1: Suíte, tipos, lint e build**

Run: `npm test` → todos verdes (107 anteriores mais os novos de `travas`, `os-travas`, `os-editar`, `baixas-estorno`, `lotes-ciclo`).
Run: `npx tsc --noEmit` · `npx next lint --dir src` · `npm run build` → limpos.

- [ ] **Passo 2: Conferir que nenhuma migração entrou**

Run: `git diff --stat master -- supabase/`
Expected: **sem saída**. Qualquer arquivo aqui significa que alguém precisou de `ALTER TABLE` — o que contradiz a premissa do plano e precisa ser relatado, não commitado.

- [ ] **Passo 3: Conferir que nada foi apagado**

Run: `grep -rniE "delete from|drop table|truncate" src/`
Expected: sem resultado. O sistema corrige por registro novo, nunca por exclusão.

- [ ] **Passo 4: Conferir a privacidade do rateio**

As telas novas (`editar`, `EstornarBaixa`, `AcoesLote`) são de admin. Confirmar que `editar/page.tsx` usa `sessaoDaPagina('admin')` e que nenhuma delas é alcançável pelo papel `financeiro`:

Run: `grep -rn "sessaoDaPagina" "src/app/(app)/os/[id]/editar/page.tsx"`
Expected: `sessaoDaPagina('admin')`.

- [ ] **Passo 5: Verificação no navegador**

Subir a aplicação e percorrer o ciclo inteiro com dado real, nos dois temas e nas duas larguras:

1. Abrir uma OS sem lote, editar o cliente e o valor, conferir que o painel e a lista refletem o valor novo.
2. Gerar um lote com essa OS. Voltar à OS e tentar reduzir o valor — conferir a mensagem citando o número do lote.
3. Cancelar o lote com motivo. Conferir que a comissão volta a "disponível" na OS e no painel.
4. Corrigir o valor agora, e gerar o lote substituto pelo atalho da tela do lote cancelado. Conferir os dois vínculos ("substituído pelo" e "substitui o").
5. Aprovar o lote, tentar cancelá-lo (deve recusar mandando desfazer), desfazer a aprovação, e então cancelar.
6. Registrar um pagamento, estornar parte dele com motivo, conferir a linha negativa com o motivo e a queda proporcional da comissão liberada.
7. Entrar como `financeiro` e confirmar que nenhuma das ações novas aparece.

- [ ] **Passo 6: Commit**

```bash
git add -A
git commit -m "chore: verificacao final das correcoes e estornos"
```

---

## Auto-revisão do plano

**Cobertura da spec:**

- §3.1 campos sempre editáveis → Tarefa 3 (o serviço não trava nenhum deles) e Tarefa 8 (o formulário os mostra habilitados).
- §3.2 travas de valor, percentual e rateio → Tarefas 1 e 3.
- §3.3 as duas mensagens de recusa → Tarefa 1, com teste de cada uma.
- §3.4 divergência da v2.0 → implícita na Tarefa 3: não existe checagem de `primeiro_envio_em` em lugar nenhum.
- §4.1 cancelar → Tarefa 5. §4.2 desfazer aprovação → Tarefa 5. §4.3 substituto → Tarefas 5 (o campo) e 10 (o atalho e os vínculos).
- §5 estorno → Tarefa 4, com os cinco casos de recusa.
- §6 as nove invariantes → distribuídas: 1, 2 e 4 na Tarefa 3; 3, 4, 8 e 9 na Tarefa 4; 5, 6 e 8 na Tarefa 5; 7 nas Tarefas 7 e 11.
- §7 telas → Tarefas 8, 9 e 10, com o ajuste registrado na Estrutura de arquivos.
- §8 nenhuma migração → verificado mecanicamente na Tarefa 11, Passo 2.
- §9 verificação → Tarefa 11.

**Correções aplicadas durante a revisão:**

- A Tarefa 8 ganhou os campos ocultos do rateio (Passo 2). Sem eles, um `<fieldset disabled>` não envia os campos internos, o servidor receberia string vazia e `parsePercentual` recusaria a edição — com uma mensagem sobre percentual que não teria nada a ver com a causa real.
- A Tarefa 8 ganhou o Passo 4. `OsDetalhe` não projetava `observacao`, então o formulário de edição abriria com o campo vazio e salvar apagaria a observação existente — perda silenciosa de dado.
- As quatro ações da Tarefa 7 revalidam `/os` e `/` além da própria página, porque todas mudam a comissão disponível que a lista e o painel exibem.

**Consistência de tipos:** `LoteQueReserva` é definido na Tarefa 1 e estendido por `LoteReservando` na Tarefa 2; `SituacaoDaOs` vem da Tarefa 2 e é consumido nas Tarefas 3, 4 e 8; `DadosEdicaoOs` é apelido de `DadosOs`, que já existe; `DadosEstorno` é definido na Tarefa 4 e consumido na 7. `Centavos` e `Percentual` vêm sempre de `@/dominio/dinheiro`.

**Ordem de execução:** 1 → 2 → (3, 4, 5 em qualquer ordem) → 6 → 7 → (8, 9, 10 em qualquer ordem) → 11. As Tarefas 3, 4 e 5 dependem das duas primeiras e de mais nada entre si.
