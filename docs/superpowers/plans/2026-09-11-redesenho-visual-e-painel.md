# Redesenho Visual e Painel — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao sistema uma linguagem visual própria (direção "Cofre": grafite frio, azul-ciano, valores em monoespaçada, temas claro/escuro) em todas as telas, com celular de primeira classe, e transformar a rota `/` num painel que responde "como estão minhas comissões agora".

**Architecture:** Tokens como variáveis CSS em `globals.css` dentro de `@theme` (Tailwind v4), consumidos por uma biblioteca pequena de componentes em `src/componentes/`. As telas em `src/app/` só compõem esses componentes. O painel ganha duas consultas novas em `src/servidor/painel/consultas.ts` que devolvem **componentes crus por OS**; toda soma de dinheiro acontece em TypeScript, num módulo puro novo `src/dominio/painel.ts`, reusando `comissaoTotal`/`comissaoLiberada`/`ratearIntervalo`. Nenhuma regra financeira é reimplementada em SQL.

**Tech Stack:** Next.js 15 (App Router), Tailwind v4 (`@theme`, `@custom-variant`), `next/font/google` (Bricolage Grotesque + JetBrains Mono), `postgres` (postgres.js), Vitest. **Nenhuma dependência nova de runtime.** Gráficos em SVG escrito à mão.

**Spec:** `docs/superpowers/specs/2026-09-11-redesenho-visual-e-painel-design.md`

## Global Constraints

- Idioma de interface, mensagens e identificadores: **português do Brasil**. Moeda BRL com duas casas.
- **Nenhum valor monetário passa por `Number` em cálculo.** Centavos em `bigint`, sempre.
- **Nenhuma reimplementação de regra financeira em SQL.** Consultas devolvem componentes crus (`valor`, `percentual_comissao`, total pago, comprometido); a soma é feita em TypeScript com as funções de `src/dominio`.
- **Rateio nunca chega ao papel `financeiro`** — nem em HTML, JSON, erro ou auditoria. Consultas com rateio recebem `incluirRateio: boolean` e, quando falso, **não tocam** `interno.os_rateio` nem `interno.lote_item_rateio`.
- **Os 90 testes existentes precisam continuar passando sem nenhuma alteração.** Se um quebrar, o trabalho saiu do escopo.
- **Arquivos existentes de `src/dominio` e `src/servidor` quase não são tocados.** Adições novas: `src/dominio/painel.ts` (Tarefa 16) e `src/servidor/painel/consultas.ts` (Tarefa 17). Única modificação permitida em arquivo existente do servidor: `src/servidor/lotes/consultas.ts` ganha três campos de snapshot no `ItemLote` (Tarefa 15), sem mudar cálculo nenhum. Qualquer outro arquivo desses diretórios aparecer no diff é sinal de escopo estourado — a Tarefa 20 verifica isso mecanicamente.
- **Regra do destaque:** o ciano aparece em no máximo **um lugar por bloco visual** — ação primária, número em foco, ou status pendente. Nunca em texto corrido.
- **Status sempre com cor + texto + ponto sólido**, os três juntos. Nunca só cor.
- **Alvo de toque mínimo de 44 px** em tudo que é clicável.
- **Impressão:** sempre tema claro, sem ciano, sem rateio, independente do tema da tela.
- Paleta e tipografia exatas: ver §3.1 e §3.2 da spec. Os valores aparecem na íntegra na Tarefa 1.
- Autorização inalterada: páginas usam `sessaoDaPagina()`, server actions usam `exigirSessao`/`exigirPapel`.
- Verificação de cada tarefa de interface: `npx tsc --noEmit` sem erro, `npx next lint --dir src` limpo, `npm run build` com sucesso.
- Commits pequenos ao final de cada tarefa.

## Estrutura de arquivos

```
src/app/globals.css                      — tokens, variantes de tema, classes .tabela e de impressão
src/app/layout.tsx                       — fontes, lang pt-BR, script anti-flash de tema

src/componentes/Botao.tsx                — Botao, BotaoLink
src/componentes/Selo.tsx                 — Selo, seloDeStatusOs, seloDeEstadoLote
src/componentes/Campo.tsx                — Campo (reescrito), CampoTexto
src/componentes/CampoMoeda.tsx           — CampoMoeda, CampoPercentual
src/componentes/Moeda.tsx                — Moeda (corrigido)
src/componentes/CartaoValor.tsx          — CartaoValor
src/componentes/BarraEmpilhada.tsx       — BarraEmpilhada
src/componentes/GraficoBarras.tsx        — GraficoBarras (SVG)
src/componentes/CartaoLista.tsx          — CartaoLista (linha de lista no celular)
src/componentes/EstadoVazio.tsx          — EstadoVazio
src/componentes/AlternadorTema.tsx       — AlternadorTema (client)
src/componentes/NavTopo.tsx              — navegação de computador
src/componentes/NavRodape.tsx            — barra fixa de celular

src/dominio/painel.ts                    — NOVO, puro: resumirComissoes, serieMensal, ratearDisponivel
src/servidor/painel/consultas.ts         — NOVO: componentesPorOs, resumoLotes

src/app/(app)/layout.tsx                 — usa NavTopo + NavRodape + AlternadorTema
src/app/(app)/page.tsx                   — painel (deixa de ser redirect)
src/app/(app)/PainelAdmin.tsx            — visão do admin
src/app/(app)/PainelFinanceiro.tsx       — visão do financeiro
src/app/(app)/error.tsx, sem-permissao/page.tsx
src/app/login/page.tsx, login/FormularioLogin.tsx
src/app/(app)/os/page.tsx, nova/page.tsx, FormularioOs.tsx, [id]/page.tsx
src/app/(app)/os/[id]/baixas/nova/page.tsx, FormularioBaixa.tsx
src/app/(app)/configuracao/page.tsx, FormularioConfiguracao.tsx
src/app/(app)/lotes/page.tsx, gerar/page.tsx, gerar/FormularioGerarLote.tsx
src/app/(app)/lotes/[id]/page.tsx, AcoesLote.tsx, imprimir/page.tsx, imprimir/ConteudoImpressao.tsx

tests/dominio/painel.test.ts             — NOVO, puro
tests/integracao/painel.test.ts          — NOVO, com rollback
```

**Decisão de decomposição registrada:** não existe componente genérico de tabela. As quatro listas (OS, lotes, itens do lote, gerar lote) renderizam uma `<table class="tabela">` escondida no celular e uma lista de `CartaoLista` escondida no computador. Uma tabela genérica com definição de colunas em TypeScript custaria mais complexidade do que economiza em quatro usos.

---

### Tarefa 1: Tokens, tipografia e correção do Arial

**Files:**
- Modify: `src/app/globals.css` (reescrita completa)
- Modify: `src/app/layout.tsx` (reescrita completa)

**Interfaces:**
- Produces: variáveis CSS `--cor-*` em ambos os temas; variante Tailwind `escuro:`; classes utilitárias `.tabela`, `.num`, `.rotulo`; variáveis de fonte `--fonte-interface` e `--fonte-numeros` aplicadas em `font-sans` / `font-mono`.

**Contexto para quem executa:** hoje `globals.css` termina com `body { font-family: Arial, Helvetica, sans-serif; }`, que sobrescreve a fonte carregada pelo `layout.tsx`. O sistema inteiro renderiza em Arial. Esta tarefa corrige isso.

- [ ] **Passo 1: Substituir `src/app/globals.css` inteiro**

```css
@import "tailwindcss";

/* Tema escuro por atributo no <html>, aplicado pelo script anti-flash da Tarefa 2. */
@custom-variant escuro (&:where([data-tema="escuro"], [data-tema="escuro"] *));

:root {
  --cor-fundo: #F7F8FA;
  --cor-superficie: #FFFFFF;
  --cor-superficie-2: #EFF1F5;
  --cor-borda: #DFE3EA;
  --cor-borda-forte: #CBD2DD;
  --cor-texto: #131720;
  --cor-texto-2: #5A6373;
  --cor-rotulo: #8A93A3;
  --cor-destaque: #0F72B5;
  --cor-destaque-hover: #0B5B91;
  --cor-destaque-suave: #E1F0F9;
  --cor-sobre-destaque: #FFFFFF;
  --cor-sucesso: #2F7D52;
  --cor-sucesso-suave: #E4F0E8;
  --cor-erro: #B4301F;
  --cor-erro-suave: #FBE9E6;
}

[data-tema="escuro"] {
  --cor-fundo: #0E1116;
  --cor-superficie: #171B22;
  --cor-superficie-2: #1D222B;
  --cor-borda: #262C37;
  --cor-borda-forte: #333A47;
  --cor-texto: #EEF1F6;
  --cor-texto-2: #9AA3B2;
  --cor-rotulo: #6E7788;
  --cor-destaque: #49C2F0;
  --cor-destaque-hover: #74D2F5;
  --cor-destaque-suave: #0C222C;
  --cor-sobre-destaque: #062029;
  --cor-sucesso: #5FCB8C;
  --cor-sucesso-suave: #15241B;
  --cor-erro: #F0705C;
  --cor-erro-suave: #2A1512;
}

@theme inline {
  --color-fundo: var(--cor-fundo);
  --color-superficie: var(--cor-superficie);
  --color-superficie-2: var(--cor-superficie-2);
  --color-borda: var(--cor-borda);
  --color-borda-forte: var(--cor-borda-forte);
  --color-texto: var(--cor-texto);
  --color-texto-2: var(--cor-texto-2);
  --color-rotulo: var(--cor-rotulo);
  --color-destaque: var(--cor-destaque);
  --color-destaque-hover: var(--cor-destaque-hover);
  --color-destaque-suave: var(--cor-destaque-suave);
  --color-sobre-destaque: var(--cor-sobre-destaque);
  --color-sucesso: var(--cor-sucesso);
  --color-sucesso-suave: var(--cor-sucesso-suave);
  --color-erro: var(--cor-erro);
  --color-erro-suave: var(--cor-erro-suave);
  --font-sans: var(--fonte-interface);
  --font-mono: var(--fonte-numeros);
}

body {
  background: var(--cor-fundo);
  color: var(--cor-texto);
  font-family: var(--fonte-interface), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Todo número de dinheiro, percentual, data e OS usa isto. */
.num {
  font-family: var(--fonte-numeros), ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.rotulo {
  font-size: 0.6875rem;
  line-height: 1rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--cor-rotulo);
}

/* Tabela de listagem (só aparece a partir de md; no celular usamos CartaoLista). */
.tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  background: var(--cor-superficie);
  border: 1px solid var(--cor-borda);
  border-radius: 0.75rem;
  overflow: hidden;
}
.tabela th {
  text-align: left;
  font-size: 0.625rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--cor-rotulo);
  background: var(--cor-superficie-2);
  padding: 0.625rem 0.75rem;
}
.tabela td {
  padding: 0.6875rem 0.75rem;
  border-top: 1px solid var(--cor-borda);
}
.tabela td.direita, .tabela th.direita { text-align: right; }

/* Foco visível e consistente em tudo que recebe teclado. */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--cor-destaque);
  outline-offset: 2px;
  border-radius: 0.375rem;
}

/* O relatório imprime sempre claro, sem ciano e sem fundo. */
@media print {
  :root, [data-tema="escuro"] {
    --cor-fundo: #FFFFFF;
    --cor-superficie: #FFFFFF;
    --cor-superficie-2: #FFFFFF;
    --cor-borda: #E4E4E4;
    --cor-borda-forte: #9A9A9A;
    --cor-texto: #141414;
    --cor-texto-2: #585858;
    --cor-rotulo: #585858;
    --cor-destaque: #141414;
    --cor-destaque-suave: #FFFFFF;
    --cor-sobre-destaque: #FFFFFF;
  }
  body { background: #FFFFFF; }
  .sem-impressao { display: none !important; }
  @page { size: A4; margin: 1.8cm; }
}
```

- [ ] **Passo 2: Substituir `src/app/layout.tsx` inteiro**

```tsx
import type { Metadata } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const fonteInterface = Bricolage_Grotesque({
  variable: '--fonte-interface',
  subsets: ['latin'],
  display: 'swap',
});

const fonteNumeros = JetBrains_Mono({
  variable: '--fonte-numeros',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Controle de Comissão',
  description: 'Controle de comissões, lotes e conferência do financeiro',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${fonteInterface.variable} ${fonteNumeros.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Passo 3: Verificar que compila e que a fonte trocou**

Run: `npx tsc --noEmit`
Expected: sem saída (código 0).

Run: `npm run build`
Expected: sucesso, e no log aparece o download das duas fontes.

Run: `grep -c "Arial" src/app/globals.css`
Expected: `0` — o Arial não existe mais em lugar nenhum.

- [ ] **Passo 4: Garantir que a suíte existente não foi afetada**

Run: `npm test`
Expected: `20 passed (20)` / `90 passed (90)`. Esta tarefa não toca domínio nem serviços; se algum teste falhar, algo saiu do escopo.

- [ ] **Passo 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(visual): tokens de cor, tipografia Bricolage/JetBrains e correção do Arial"
```

---

### Tarefa 2: Alternador de tema sem flash

**Files:**
- Create: `src/componentes/AlternadorTema.tsx`
- Modify: `src/app/layout.tsx` (adicionar o script anti-flash no `<head>`)

**Interfaces:**
- Consumes: variável CSS e variante `escuro:` da Tarefa 1.
- Produces: `export function AlternadorTema(): JSX.Element` — três estados (`sistema` | `claro` | `escuro`), persistidos em `localStorage` sob a chave `tema`.

**Contexto:** o script precisa rodar **antes da primeira pintura**, senão a página aparece clara por um instante e pisca para escura. Por isso ele vai inline no `<head>`, não num `useEffect`. Como ele altera o `<html>` antes da hidratação, o `<html>` precisa de `suppressHydrationWarning`.

- [ ] **Passo 1: Criar `src/componentes/AlternadorTema.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';

type Preferencia = 'sistema' | 'claro' | 'escuro';

const OPCOES: { valor: Preferencia; rotulo: string }[] = [
  { valor: 'sistema', rotulo: 'Sistema' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

function aplicar(preferencia: Preferencia): void {
  const escuroDoSistema = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const escuro = preferencia === 'escuro' || (preferencia === 'sistema' && escuroDoSistema);
  document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
}

export function AlternadorTema() {
  const [preferencia, setPreferencia] = useState<Preferencia>('sistema');

  useEffect(() => {
    const guardada = window.localStorage.getItem('tema') as Preferencia | null;
    if (guardada === 'claro' || guardada === 'escuro' || guardada === 'sistema') {
      setPreferencia(guardada);
    }
  }, []);

  // Enquanto a preferência for "sistema", seguir o sistema operacional ao vivo.
  useEffect(() => {
    if (preferencia !== 'sistema') return;
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => aplicar('sistema');
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, [preferencia]);

  function escolher(valor: Preferencia) {
    setPreferencia(valor);
    window.localStorage.setItem('tema', valor);
    aplicar(valor);
  }

  return (
    <div
      role="group"
      aria-label="Tema da interface"
      className="inline-flex gap-0.5 rounded-full border border-borda bg-superficie-2 p-0.5"
    >
      {OPCOES.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          aria-pressed={preferencia === opcao.valor}
          onClick={() => escolher(opcao.valor)}
          className={
            preferencia === opcao.valor
              ? 'rounded-full bg-destaque px-3 py-1.5 text-xs font-medium text-sobre-destaque'
              : 'rounded-full px-3 py-1.5 text-xs font-medium text-texto-2 hover:text-texto'
          }
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Passo 2: Adicionar o script anti-flash ao `src/app/layout.tsx`**

Substituir o `return` do `RootLayout` por:

```tsx
  return (
    <html
      lang="pt-BR"
      className={`${fonteInterface.variable} ${fonteNumeros.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Roda antes da primeira pintura: sem isto a tela pisca clara antes de ficar escura. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var p=localStorage.getItem('tema')||'sistema';" +
              "var s=window.matchMedia('(prefers-color-scheme: dark)').matches;" +
              "document.documentElement.dataset.tema=(p==='escuro'||(p==='sistema'&&s))?'escuro':'claro';" +
              "}catch(e){document.documentElement.dataset.tema='claro';}})();",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
```

- [ ] **Passo 3: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → `✔ No ESLint warnings or errors`.
Run: `npm run build` → sucesso.

- [ ] **Passo 4: Commit**

```bash
git add src/componentes/AlternadorTema.tsx src/app/layout.tsx
git commit -m "feat(visual): alternador de tema com três estados e sem flash no carregamento"
```

---

### Tarefa 3: Botões e selos de status

**Files:**
- Create: `src/componentes/Botao.tsx`, `src/componentes/Selo.tsx`

**Interfaces:**
- Consumes: tokens da Tarefa 1; `StatusRecebimento` de `@/dominio/comissao`.
- Produces:
  - `type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'destrutivo'`
  - `function Botao(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; carregando?: boolean; larguraTotal?: boolean })`
  - `function BotaoLink(props: { href: string; variante?: VarianteBotao; larguraTotal?: boolean; target?: string; children: React.ReactNode })`
  - `type TomSelo = 'neutro' | 'destaque' | 'sucesso' | 'erro'`
  - `function Selo({ tom, children }: { tom: TomSelo; children: React.ReactNode })`
  - `function seloDeStatusOs(status: StatusRecebimento): { tom: TomSelo; rotulo: string }`
  - `function seloDeEstadoLote(estado: string): { tom: TomSelo; rotulo: string }`

- [ ] **Passo 1: Criar `src/componentes/Botao.tsx`**

```tsx
import Link from 'next/link';

export type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'destrutivo';

// min-h-11 = 44px: alvo de toque confortável no celular.
const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-destaque text-sobre-destaque hover:bg-destaque-hover',
  secundario: 'border border-borda-forte bg-superficie text-texto hover:bg-superficie-2',
  fantasma: 'text-texto-2 hover:bg-superficie-2 hover:text-texto',
  destrutivo: 'border border-erro bg-transparent text-erro hover:bg-erro-suave',
};

function classes(variante: VarianteBotao, larguraTotal: boolean, extra?: string): string {
  return [BASE, VARIANTES[variante], larguraTotal ? 'w-full' : '', extra ?? ''].join(' ').trim();
}

export function Botao({
  variante = 'primario',
  carregando = false,
  larguraTotal = false,
  className,
  children,
  disabled,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  carregando?: boolean;
  larguraTotal?: boolean;
}) {
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={classes(variante, larguraTotal, className)}
    >
      {carregando && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}

export function BotaoLink({
  href,
  variante = 'primario',
  larguraTotal = false,
  target,
  children,
}: {
  href: string;
  variante?: VarianteBotao;
  larguraTotal?: boolean;
  target?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} target={target} className={classes(variante, larguraTotal)}>
      {children}
    </Link>
  );
}
```

- [ ] **Passo 2: Criar `src/componentes/Selo.tsx`**

```tsx
import type { StatusRecebimento } from '@/dominio/comissao';

export type TomSelo = 'neutro' | 'destaque' | 'sucesso' | 'erro';

const TONS: Record<TomSelo, string> = {
  neutro: 'border-borda bg-superficie-2 text-texto-2',
  destaque: 'border-destaque bg-destaque-suave text-destaque',
  sucesso: 'border-sucesso bg-sucesso-suave text-sucesso',
  erro: 'border-erro bg-erro-suave text-erro',
};

/**
 * Status sempre com cor + texto + ponto. Quem não distingue bem as cores
 * continua lendo o estado pelo rótulo.
 */
export function Selo({ tom, children }: { tom: TomSelo; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONS[tom]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function seloDeStatusOs(status: StatusRecebimento): { tom: TomSelo; rotulo: string } {
  if (status === 'quitada') return { tom: 'sucesso', rotulo: 'Quitada' };
  if (status === 'parcial') return { tom: 'destaque', rotulo: 'Parcial' };
  return { tom: 'neutro', rotulo: 'Aberta' };
}

export function seloDeEstadoLote(estado: string): { tom: TomSelo; rotulo: string } {
  if (estado === 'aprovado') return { tom: 'sucesso', rotulo: 'Aprovado' };
  if (estado === 'enviado') return { tom: 'destaque', rotulo: 'Aguardando conferência' };
  if (estado === 'cancelado') return { tom: 'erro', rotulo: 'Cancelado' };
  return { tom: 'neutro', rotulo: 'Rascunho' };
}
```

- [ ] **Passo 3: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.

- [ ] **Passo 4: Commit**

```bash
git add src/componentes/Botao.tsx src/componentes/Selo.tsx
git commit -m "feat(visual): componentes de botão e selo de status"
```

---

### Tarefa 4: Campos de formulário e exibição de moeda

**Files:**
- Modify: `src/componentes/Campo.tsx` (reescrita completa)
- Create: `src/componentes/CampoMoeda.tsx`
- Modify: `src/componentes/Moeda.tsx` (reescrita completa)
- Modify: `src/app/(app)/configuracao/FormularioConfiguracao.tsx` (só a renomeação de prop, ver Passo 4)

**Interfaces:**
- Produces:
  - `function Campo({ rotulo, htmlFor, erro, ajuda, children })` — **atenção: a prop mudou de `label` para `rotulo`.**
  - `function CampoTexto(props)` — input de texto já estilizado, com estado de erro.
  - `function CampoMoeda({ nome, id, rotulo, valorInicial, erro, obrigatorio, ajuda })` — prefixo `R$` fixo, monoespaçada, `inputMode="decimal"`.
  - `function CampoPercentual({ nome, id, rotulo, valorInicial, erro, obrigatorio, ajuda })` — sufixo `%`.
  - `function Moeda({ valor, className }: { valor: bigint; className?: string })` — **corrige o nome da prop, que hoje é `classeName` e por isso nunca aplicou classe nenhuma.**
  - `const CLASSE_ENTRADA: string` — classes compartilhadas de input.

**Contexto:** `src/componentes/Moeda.tsx` hoje declara `classeName` e repassa para `className`. Qualquer chamador que escrevesse `className` seria rejeitado pelo TypeScript. Como o componente é usado em poucos lugares, a correção é segura.

- [ ] **Passo 1: Substituir `src/componentes/Campo.tsx` inteiro**

```tsx
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
```

- [ ] **Passo 2: Criar `src/componentes/CampoMoeda.tsx`**

```tsx
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
```

- [ ] **Passo 3: Substituir `src/componentes/Moeda.tsx` inteiro**

```tsx
import { formatarBRL } from '@/dominio/dinheiro';

export function Moeda({ valor, className }: { valor: bigint; className?: string }) {
  return <span className={className ? `num ${className}` : 'num'}>{formatarBRL(valor)}</span>;
}
```

- [ ] **Passo 4: Manter a árvore compilando**

Run: `npx tsc --noEmit`
Expected: **erros esperados** em `src/app/(app)/configuracao/FormularioConfiguracao.tsx`, que ainda passa `label=` para `Campo`.

Nesse arquivo, e só nele, troque cada `label="..."` por `rotulo="..."` nas quatro chamadas de `Campo`. Não mexa em mais nada — a tela inteira é reescrita na Tarefa 12.

Run: `npx tsc --noEmit` de novo → sem erro.
Run: `npm run build` → sucesso.

- [ ] **Passo 5: Commit**

```bash
git add src/componentes/Campo.tsx src/componentes/CampoMoeda.tsx src/componentes/Moeda.tsx "src/app/(app)/configuracao/FormularioConfiguracao.tsx"
git commit -m "feat(visual): campos de formulário, campo de moeda e correção da prop de Moeda"
```

---

### Tarefa 5: Cartão de valor, barra empilhada, cartão de lista e estado vazio

**Files:**
- Create: `src/componentes/CartaoValor.tsx`, `src/componentes/BarraEmpilhada.tsx`, `src/componentes/CartaoLista.tsx`, `src/componentes/EstadoVazio.tsx`

**Interfaces:**
- Consumes: `formatarBRL` de `@/dominio/dinheiro`; `Selo` e `TomSelo` da Tarefa 3.
- Produces:
  - `function CartaoValor({ rotulo, valor, detalhe, destaque, children })`
  - `interface SegmentoBarra { rotulo: string; valor: bigint; tom: 'destaque' | 'sucesso' | 'neutro' }`
  - `function BarraEmpilhada({ segmentos }: { segmentos: SegmentoBarra[] })`
  - `function CartaoLista({ href, titulo, selo, descricao, rotuloValor, valor })`
  - `function EstadoVazio({ titulo, descricao, acao })`

**Contexto sobre `bigint` e largura:** a Global Constraint proíbe `Number` em **cálculo de dinheiro**. Converter uma proporção já calculada em `bigint` para virar `width: %` é apresentação, não cálculo — a divisão acontece em `bigint` (pontos-base) e só o resultado adimensional vira `Number`.

- [ ] **Passo 1: Criar `src/componentes/CartaoValor.tsx`**

```tsx
import { formatarBRL } from '@/dominio/dinheiro';

export function CartaoValor({
  rotulo,
  valor,
  detalhe,
  destaque = false,
  children,
}: {
  rotulo: string;
  valor: bigint;
  detalhe?: string;
  destaque?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-borda bg-superficie p-4 ${
        destaque ? 'border-t-2 border-t-destaque' : ''
      }`}
    >
      <p className="rotulo">{rotulo}</p>
      <p
        className={`num mt-2 font-bold leading-none ${
          destaque ? 'text-[2.25rem] text-destaque sm:text-[2.75rem]' : 'text-[1.5rem]'
        }`}
      >
        {formatarBRL(valor)}
      </p>
      {detalhe && <p className="mt-1.5 text-[12.5px] text-texto-2">{detalhe}</p>}
      {children}
    </div>
  );
}
```

- [ ] **Passo 2: Criar `src/componentes/BarraEmpilhada.tsx`**

```tsx
import { formatarBRL } from '@/dominio/dinheiro';

export interface SegmentoBarra {
  rotulo: string;
  valor: bigint;
  tom: 'destaque' | 'sucesso' | 'neutro';
}

const FUNDOS: Record<SegmentoBarra['tom'], string> = {
  destaque: 'bg-destaque',
  sucesso: 'bg-sucesso',
  neutro: 'bg-borda-forte',
};

export function BarraEmpilhada({ segmentos }: { segmentos: SegmentoBarra[] }) {
  const total = segmentos.reduce((acc, s) => acc + s.valor, 0n);
  if (total <= 0n) return null;

  // A divisão acontece em bigint (pontos-base); só a proporção adimensional vira número.
  const largura = (valor: bigint): string => `${Number((valor * 10000n) / total) / 100}%`;
  const visiveis = segmentos.filter((s) => s.valor > 0n);

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-superficie-2">
        {visiveis.map((s) => (
          <span key={s.rotulo} className={FUNDOS[s.tom]} style={{ width: largura(s.valor) }} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-texto-2">
        {visiveis.map((s) => (
          <li key={s.rotulo} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2 rounded-sm ${FUNDOS[s.tom]}`} />
            {s.rotulo} · <span className="num">{formatarBRL(s.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Passo 3: Criar `src/componentes/CartaoLista.tsx`**

```tsx
import Link from 'next/link';
import { formatarBRL } from '@/dominio/dinheiro';
import { Selo, type TomSelo } from './Selo';

/** Uma linha de lista no celular. No computador as mesmas listas viram <table class="tabela">. */
export function CartaoLista({
  href,
  titulo,
  selo,
  descricao,
  rotuloValor,
  valor,
}: {
  href: string;
  titulo: string;
  selo: { tom: TomSelo; rotulo: string };
  descricao: string;
  rotuloValor: string;
  valor: bigint;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-borda bg-superficie p-3.5 active:bg-superficie-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="num text-sm font-bold">{titulo}</span>
        <Selo tom={selo.tom}>{selo.rotulo}</Selo>
      </div>
      <p className="mt-1 mb-2.5 text-[13px] text-texto-2">{descricao}</p>
      <div className="flex items-baseline justify-between border-t border-borda pt-2">
        <span className="rotulo">{rotuloValor}</span>
        <span className="num text-[15px] font-bold text-destaque">{formatarBRL(valor)}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Passo 4: Criar `src/componentes/EstadoVazio.tsx`**

```tsx
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
```

- [ ] **Passo 5: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.

- [ ] **Passo 6: Commit**

```bash
git add src/componentes/CartaoValor.tsx src/componentes/BarraEmpilhada.tsx src/componentes/CartaoLista.tsx src/componentes/EstadoVazio.tsx
git commit -m "feat(visual): cartão de valor, barra empilhada, cartão de lista e estado vazio"
```

---

### Tarefa 6: Gráfico de barras sem biblioteca

**Files:**
- Create: `src/componentes/GraficoBarras.tsx`

**Interfaces:**
- Produces:
  - `interface PontoGrafico { rotulo: string; valor: bigint }`
  - `function GraficoBarras({ pontos, descricao }: { pontos: PontoGrafico[]; descricao: string })`

**Contexto:** sem dependência nova. Uma biblioteca de gráficos custaria cerca de 100 KB no navegador para desenhar retângulos e traria a estética dela em vez da nossa. O gráfico é decorativo para leitor de tela, então acompanha uma tabela visualmente escondida com os mesmos números.

- [ ] **Passo 1: Criar `src/componentes/GraficoBarras.tsx`**

```tsx
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
      <div className="flex h-32 items-end gap-1.5" role="presentation">
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
```

- [ ] **Passo 2: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.

- [ ] **Passo 3: Commit**

```bash
git add src/componentes/GraficoBarras.tsx
git commit -m "feat(visual): gráfico de barras sem dependência externa"
```

---

### Tarefa 7: Navegação de computador e de celular

**Files:**
- Create: `src/componentes/NavTopo.tsx`, `src/componentes/NavRodape.tsx`
- Modify: `src/app/(app)/layout.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `AlternadorTema` (Tarefa 2); `sessaoDaPagina` e o tipo `Papel` de `@/servidor/auth`; `sairAction` de `@/servidor/auth-acoes`.
- Produces:
  - `interface Destino { href: string; rotulo: string; icone: string; somenteAdmin?: boolean }`
  - `const DESTINOS: Destino[]`
  - `function destinosDoPapel(papel: Papel): Destino[]`
  - `function ehAtivo(caminho: string, href: string): boolean`
  - `function NavTopo({ papel, email }: { papel: Papel; email: string })`
  - `function NavRodape({ papel }: { papel: Papel })`

**Contexto:** no celular são só quatro destinos, então barra fixa no rodapé bate menu hambúrguer — fica no alcance do polegar e mostra onde você está o tempo todo. `NavTopo` e `NavRodape` são Client Components porque usam `usePathname()` para marcar o item ativo; o `layout.tsx` continua Server Component e passa papel e e-mail como props.

- [ ] **Passo 1: Criar `src/componentes/NavTopo.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Papel } from '@/servidor/auth';
import { AlternadorTema } from './AlternadorTema';

export interface Destino {
  href: string;
  rotulo: string;
  icone: string;
  somenteAdmin?: boolean;
}

export const DESTINOS: Destino[] = [
  { href: '/', rotulo: 'Início', icone: '▣' },
  { href: '/os', rotulo: 'OS', icone: '≡' },
  { href: '/lotes', rotulo: 'Lotes', icone: '▤' },
  { href: '/configuracao', rotulo: 'Configuração', icone: '⚙', somenteAdmin: true },
];

export function destinosDoPapel(papel: Papel): Destino[] {
  return DESTINOS.filter((destino) => !destino.somenteAdmin || papel === 'admin');
}

export function ehAtivo(caminho: string, href: string): boolean {
  return href === '/' ? caminho === '/' : caminho.startsWith(href);
}

export function NavTopo({ papel, email }: { papel: Papel; email: string }) {
  const caminho = usePathname();

  return (
    <nav className="hidden border-b border-borda bg-superficie px-6 md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex gap-6">
          {destinosDoPapel(papel).map((destino) => {
            const ativo = ehAtivo(caminho, destino.href);
            return (
              <Link
                key={destino.href}
                href={destino.href}
                aria-current={ativo ? 'page' : undefined}
                className={`relative block py-4 text-sm ${
                  ativo
                    ? 'font-semibold text-texto after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-destaque'
                    : 'text-texto-2 hover:text-texto'
                }`}
              >
                {destino.rotulo}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          <AlternadorTema />
          <span className="text-[12.5px] text-texto-2">
            {email} ({papel})
          </span>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Passo 2: Criar `src/componentes/NavRodape.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Papel } from '@/servidor/auth';
import { destinosDoPapel, ehAtivo } from './NavTopo';

/** Barra fixa no rodapé: quatro destinos, no alcance do polegar. Só no celular. */
export function NavRodape({ papel }: { papel: Papel }) {
  const caminho = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
      {destinosDoPapel(papel).map((destino) => {
        const ativo = ehAtivo(caminho, destino.href);
        return (
          <Link
            key={destino.href}
            href={destino.href}
            aria-current={ativo ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] ${
              ativo ? 'text-destaque' : 'text-rotulo'
            }`}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {destino.icone}
            </span>
            {destino.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Passo 3: Substituir `src/app/(app)/layout.tsx` inteiro**

```tsx
import { AlternadorTema } from '@/componentes/AlternadorTema';
import { NavRodape } from '@/componentes/NavRodape';
import { NavTopo } from '@/componentes/NavTopo';
import { sessaoDaPagina } from '@/servidor/auth';
import { sairAction } from '@/servidor/auth-acoes';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoDaPagina();

  return (
    <div className="min-h-screen">
      <NavTopo papel={sessao.papel} email={sessao.email} />

      {/* Cabeçalho de celular: papel, tema e sair. A navegação fica no rodapé. */}
      <header className="flex items-center justify-between gap-3 border-b border-borda bg-superficie px-4 py-2.5 md:hidden">
        <span className="text-[12.5px] text-texto-2">{sessao.papel}</span>
        <div className="flex items-center gap-3">
          <AlternadorTema />
          <form action={sairAction}>
            <button type="submit" className="min-h-11 px-1 text-[12.5px] underline">
              Sair
            </button>
          </form>
        </div>
      </header>

      {/* pb-24 no celular abre espaço para a barra fixa não cobrir o conteúdo. */}
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-10">{children}</div>

      <div className="mx-auto hidden max-w-6xl px-6 pb-8 md:block">
        <form action={sairAction}>
          <button type="submit" className="text-[12.5px] text-texto-2 underline">
            Sair
          </button>
        </form>
      </div>

      <NavRodape papel={sessao.papel} />
    </div>
  );
}
```

- [ ] **Passo 4: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.

- [ ] **Passo 5: Commit**

```bash
git add src/componentes/NavTopo.tsx src/componentes/NavRodape.tsx "src/app/(app)/layout.tsx"
git commit -m "feat(visual): navegação de topo no computador e barra fixa no celular"
```

---

### Tarefa 8: Login, acesso negado e boundary de erro

**Files:**
- Modify: `src/app/login/page.tsx`, `src/app/login/FormularioLogin.tsx`
- Modify: `src/app/(app)/sem-permissao/page.tsx`, `src/app/(app)/error.tsx`

**Interfaces:**
- Consumes: `Botao` (Tarefa 3), `Campo`/`CampoTexto` (Tarefa 4), `EstadoVazio` (Tarefa 5), `AlternadorTema` (Tarefa 2), `entrarAction` de `@/servidor/auth-acoes`.

**Contexto:** a tela de login está **fora** do grupo `(app)`, então não herda o layout autenticado nem o alternador de tema. Ela precisa do seu próprio alternador, senão quem prefere tema escuro leva uma tela branca na cara antes de entrar.

- [ ] **Passo 1: Substituir `src/app/login/FormularioLogin.tsx` inteiro**

```tsx
'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { CampoTexto } from '@/componentes/Campo';
import { entrarAction } from '@/servidor/auth-acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

export function FormularioLogin() {
  const [estado, acao, emAndamento] = useActionState(
    entrarAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  return (
    <form action={acao} className="flex w-full flex-col gap-4">
      <CampoTexto
        nome="email"
        id="email"
        rotulo="E-mail"
        type="email"
        autoComplete="username"
        required
        erro={estado.errosPorCampo.email}
      />
      <CampoTexto
        nome="senha"
        id="senha"
        rotulo="Senha"
        type="password"
        autoComplete="current-password"
        required
        erro={estado.errosPorCampo.senha}
      />
      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal>
        Entrar
      </Botao>
      <p className="text-xs text-texto-2">
        Esqueceu a senha? Peça para o responsável pelo sistema redefinir no Supabase.
      </p>
    </form>
  );
}
```

- [ ] **Passo 2: Substituir `src/app/login/page.tsx` inteiro**

```tsx
import { AlternadorTema } from '@/componentes/AlternadorTema';
import { FormularioLogin } from './FormularioLogin';

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-xs">
        <p className="rotulo">Controle de</p>
        <h1 className="mt-1 mb-7 text-[1.75rem] font-bold leading-none tracking-tight">
          Comissão
        </h1>
        <FormularioLogin />
        <div className="mt-8 flex justify-center">
          <AlternadorTema />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Passo 3: Substituir `src/app/(app)/sem-permissao/page.tsx` inteiro**

```tsx
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
```

- [ ] **Passo 4: Substituir `src/app/(app)/error.tsx` inteiro**

```tsx
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
```

- [ ] **Passo 5: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.

- [ ] **Passo 6: Commit**

```bash
git add src/app/login "src/app/(app)/sem-permissao/page.tsx" "src/app/(app)/error.tsx"
git commit -m "feat(visual): login, acesso negado e boundary de erro na linguagem nova"
```

---

### Tarefa 9: Lista de OS — tabela no computador, cartões no celular

**Files:**
- Modify: `src/app/(app)/os/page.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `listarOs` e `OsListada` de `@/servidor/os/consultas`; `sessaoDaPagina`; `BotaoLink`, `Selo`, `seloDeStatusOs`, `CartaoLista`, `EstadoVazio`, `Moeda`.

**Contexto:** `listarOs({ busca })` já existe e devolve `{ id, numeroOs, cliente, produto, valor, status, comissaoLiberada, comissaoDisponivel }`. Esta tarefa não muda consulta nenhuma — só a apresentação. A mesma lista aparece duas vezes no HTML: `<table class="tabela">` com `hidden md:table`, e a lista de `CartaoLista` com `md:hidden`.

- [ ] **Passo 1: Substituir `src/app/(app)/os/page.tsx` inteiro**

```tsx
import { BotaoLink } from '@/componentes/Botao';
import { CartaoLista } from '@/componentes/CartaoLista';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeStatusOs } from '@/componentes/Selo';
import { CLASSE_ENTRADA } from '@/componentes/Campo';
import { sessaoDaPagina } from '@/servidor/auth';
import { listarOs } from '@/servidor/os/consultas';

export default async function PaginaListaOs({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sessao = await sessaoDaPagina();
  const { q } = await searchParams;
  const lista = await listarOs({ busca: q });
  const ehAdmin = sessao.papel === 'admin';

  return (
    <main>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">
          Ordens de serviço
        </h1>
        {ehAdmin && <BotaoLink href="/os/nova">Nova OS</BotaoLink>}
      </div>

      <form className="mb-5">
        <label htmlFor="q" className="sr-only">
          Buscar ordens de serviço
        </label>
        <input
          type="search"
          name="q"
          id="q"
          defaultValue={q ?? ''}
          placeholder="Buscar número, cliente ou produto"
          className={`${CLASSE_ENTRADA} md:max-w-sm`}
        />
      </form>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma OS encontrada"
          descricao={
            q
              ? 'Nenhuma ordem de serviço corresponde a essa busca. Tente outro número, cliente ou produto.'
              : 'Ainda não há ordens de serviço cadastradas.'
          }
          acao={ehAdmin && !q ? <BotaoLink href="/os/nova">Cadastrar a primeira OS</BotaoLink> : undefined}
        />
      ) : (
        <>
          {/* Celular: cartões, sem rolagem lateral. */}
          <ul className="flex flex-col gap-2.5 md:hidden">
            {lista.map((os) => (
              <li key={os.id}>
                <CartaoLista
                  href={`/os/${os.id}`}
                  titulo={os.numeroOs}
                  selo={seloDeStatusOs(os.status)}
                  descricao={`${os.cliente} · ${os.produto}`}
                  rotuloValor="Disponível"
                  valor={os.comissaoDisponivel}
                />
              </li>
            ))}
          </ul>

          {/* Computador: tabela. */}
          <table className="tabela hidden md:table">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Cliente</th>
                <th scope="col">Produto</th>
                <th scope="col" className="direita">Valor</th>
                <th scope="col">Status</th>
                <th scope="col" className="direita">Comissão disponível</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((os) => (
                <tr key={os.id}>
                  <td>
                    <a href={`/os/${os.id}`} className="num font-bold text-destaque underline">
                      {os.numeroOs}
                    </a>
                  </td>
                  <td>{os.cliente}</td>
                  <td className="text-texto-2">{os.produto}</td>
                  <td className="direita"><Moeda valor={os.valor} /></td>
                  <td>
                    <Selo tom={seloDeStatusOs(os.status).tom}>
                      {seloDeStatusOs(os.status).rotulo}
                    </Selo>
                  </td>
                  <td className="direita font-semibold">
                    <Moeda valor={os.comissaoDisponivel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
```

- [ ] **Passo 2: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.

- [ ] **Passo 3: Commit**

```bash
git add "src/app/(app)/os/page.tsx"
git commit -m "feat(visual): lista de OS com tabela no computador e cartões no celular"
```

---

### Tarefa 10: Detalhe da OS

**Files:**
- Modify: `src/app/(app)/os/[id]/page.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `obterOsPorId` de `@/servidor/os/consultas`; `CartaoValor`, `BarraEmpilhada`, `Selo`, `seloDeStatusOs`, `BotaoLink`, `Moeda`; `formatarDataBr` de `@/dominio/datas`; `formatarPercentual` de `@/dominio/dinheiro`.

**Contexto:** `OsDetalhe` traz `comissaoTotal`, `comissaoLiberada` e `comissaoDisponivel`. A parte comprometida em lotes é `comissaoLiberada − comissaoDisponivel`, e a parte ainda presa ao que o cliente não pagou é `comissaoTotal − comissaoLiberada`. Os três somam a comissão total e alimentam a barra empilhada.

A hierarquia é deliberada: *disponível para lote* é o único número em ciano e o maior da tela; os outros dois cartões têm o mesmo corpo entre si e não competem.

- [ ] **Passo 1: Substituir `src/app/(app)/os/[id]/page.tsx` inteiro**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarraEmpilhada } from '@/componentes/BarraEmpilhada';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoValor } from '@/componentes/CartaoValor';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeStatusOs } from '@/componentes/Selo';
import { formatarDataBr } from '@/dominio/datas';
import { formatarPercentual } from '@/dominio/dinheiro';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterOsPorId } from '@/servidor/os/consultas';

export default async function PaginaDetalheOs({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await sessaoDaPagina();
  const { id } = await params;
  const ehAdmin = sessao.papel === 'admin';
  const os = await obterOsPorId(id, ehAdmin);
  if (!os) notFound();

  const comprometida = os.comissaoLiberada - os.comissaoDisponivel;
  const presa = os.comissaoTotal - os.comissaoLiberada;
  const selo = seloDeStatusOs(os.status);
  const saldo = os.valor - os.totalPagoCliente;

  return (
    <main>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">
              OS <span className="num text-destaque">{os.numeroOs}</span>
            </h1>
            <Selo tom={selo.tom}>{selo.rotulo}</Selo>
          </div>
          <p className="mt-1 text-[13.5px] text-texto-2">
            {os.cliente} · {os.produto} · venda em {formatarDataBr(os.dataVenda)}
          </p>
        </div>
        {ehAdmin && (
          <BotaoLink href={`/os/${os.id}/baixas/nova`}>Registrar pagamento</BotaoLink>
        )}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <CartaoValor
          rotulo="Valor da OS"
          valor={os.valor}
          detalhe={`comissão de ${formatarPercentual(os.percentualComissao)} · ${os.tipoPagamento}`}
        />
        <CartaoValor
          rotulo="Pago pelo cliente"
          valor={os.totalPagoCliente}
          detalhe={saldo > 0n ? `ainda faltam ${saldo / 100n > 0n ? '' : ''}R$ ${(saldo / 100n).toString()},${(saldo % 100n).toString().padStart(2, '0')}` : 'quitada'}
        />
        <CartaoValor
          rotulo="Disponível para lote"
          valor={os.comissaoDisponivel}
          destaque
          detalhe={comprometida > 0n ? 'o restante já foi enviado em lote' : 'nada comprometido ainda'}
        />
      </div>

      <section className="mb-4 rounded-xl border border-borda bg-superficie p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Comissão</h2>
          <span className="text-[12px] text-texto-2">
            total de <Moeda valor={os.comissaoTotal} />
          </span>
        </div>
        <BarraEmpilhada
          segmentos={[
            { rotulo: 'Liberada e disponível', valor: os.comissaoDisponivel, tom: 'destaque' },
            { rotulo: 'Já enviada em lote', valor: comprometida, tom: 'sucesso' },
            { rotulo: 'Presa ao que o cliente não pagou', valor: presa, tom: 'neutro' },
          ]}
        />
      </section>

      <section className="mb-4 rounded-xl border border-borda bg-superficie p-4">
        <h2 className="mb-3 text-sm font-semibold">Pagamentos do cliente</h2>
        {os.baixas.length === 0 ? (
          <p className="text-[13.5px] text-texto-2">
            Nenhum pagamento registrado ainda. Enquanto o cliente não pagar, nenhuma
            comissão é liberada.
          </p>
        ) : (
          <ul>
            {os.baixas.map((baixa) => (
              <li
                key={baixa.id}
                className="flex items-baseline justify-between border-b border-borda py-2.5 text-[13.5px] last:border-b-0"
              >
                <span className="num">{formatarDataBr(baixa.data)}</span>
                <Moeda valor={baixa.valor} className="font-medium" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {os.rateio && (
        <section className="mb-4 border-l-2 border-destaque pl-3.5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-destaque">
            Visível só para admin
          </p>
          <h2 className="mb-3 text-sm font-semibold">Rateio da comissão</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { nome: 'Thiago', peso: os.rateio.thiago },
              { nome: 'Geice', peso: os.rateio.geice },
              { nome: 'Gabrielle', peso: os.rateio.gabrielle },
            ].map((pessoa) => (
              <div key={pessoa.nome} className="rounded-lg bg-superficie-2 px-3 py-2.5">
                <p className="text-[12px] text-texto-2">{pessoa.nome}</p>
                <p className="num text-[15px] font-bold">{formatarPercentual(pessoa.peso)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link href="/os" className="text-[13px] text-texto-2 underline">
        ← Voltar para a lista
      </Link>
    </main>
  );
}
```

- [ ] **Passo 2: Simplificar o detalhe do saldo**

O `detalhe` do cartão "Pago pelo cliente" no Passo 1 monta a string de saldo à mão, o que duplica formatação. Substitua aquele `CartaoValor` por:

```tsx
        <CartaoValor
          rotulo="Pago pelo cliente"
          valor={os.totalPagoCliente}
          detalhe={saldo > 0n ? 'ainda falta receber o saldo abaixo' : 'cliente quitou a OS'}
        >
          {saldo > 0n && (
            <p className="mt-1.5 text-[12.5px] text-texto-2">
              Saldo a receber: <Moeda valor={saldo} />
            </p>
          )}
        </CartaoValor>
```

E remova o `detalhe` improvisado. Motivo: `formatarBRL` já é a única formatação de moeda do sistema; montar string de real na mão numa página seria uma segunda formatação a manter.

- [ ] **Passo 3: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.
Run: `grep -n "padStart" "src/app/(app)/os/[id]/page.tsx"` → sem resultado (a formatação improvisada saiu).

- [ ] **Passo 4: Commit**

```bash
git add "src/app/(app)/os/[id]/page.tsx"
git commit -m "feat(visual): detalhe da OS com hierarquia de valores e barra de composição da comissão"
```

---

### Tarefa 11: Formulários de OS e de pagamento

**Files:**
- Modify: `src/app/(app)/os/FormularioOs.tsx` (reescrita completa)
- Modify: `src/app/(app)/os/nova/page.tsx` (reescrita completa)
- Modify: `src/app/(app)/os/[id]/baixas/nova/FormularioBaixa.tsx` (reescrita completa)
- Modify: `src/app/(app)/os/[id]/baixas/nova/page.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `Botao`, `CampoTexto`, `CampoMoeda`, `CampoPercentual`, `Campo`, `CLASSE_ENTRADA`, `CartaoValor`, `Moeda`; `cadastrarOsAction` e `registrarBaixaAction`; `obterConfiguracao`; `hojeNegocio`; `formatarPercentual`.

**Contexto:** as chaves de erro por campo vêm do domínio e **não** batem com os nomes dos inputs no caso do rateio: `validarPesos` emite `rateio_thiago`, `rateio_geice`, `rateio_gabrielle`, enquanto os inputs se chamam `rateioThiago` etc. Isso já é assim hoje e precisa continuar, senão o erro não aparece.

- [ ] **Passo 1: Substituir `src/app/(app)/os/FormularioOs.tsx` inteiro**

```tsx
'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { Campo, CampoTexto, CLASSE_ENTRADA } from '@/componentes/Campo';
import { CampoMoeda, CampoPercentual } from '@/componentes/CampoMoeda';
import { formatarPercentual, type Percentual } from '@/dominio/dinheiro';
import { cadastrarOsAction } from '@/servidor/os/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

function paraTexto(percentual: Percentual): string {
  return formatarPercentual(percentual).replace('%', '');
}

export function FormularioOs({
  configuracaoAtual,
  dataPadrao,
}: {
  configuracaoAtual: {
    percentualComissaoPadrao: Percentual;
    rateioThiagoPadrao: Percentual;
    rateioGeicePadrao: Percentual;
    rateioGabriellePadrao: Percentual;
  };
  dataPadrao: string;
}) {
  const [estado, acao, emAndamento] = useActionState(
    cadastrarOsAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  return (
    <form action={acao} className="flex max-w-lg flex-col gap-4">
      <CampoTexto
        nome="numeroOs"
        id="numeroOs"
        rotulo="Número da OS"
        required
        erro={estado.errosPorCampo.numeroOs}
      />
      <CampoTexto
        nome="cliente"
        id="cliente"
        rotulo="Cliente"
        required
        erro={estado.errosPorCampo.cliente}
      />
      <CampoTexto
        nome="produto"
        id="produto"
        rotulo="Produto"
        required
        erro={estado.errosPorCampo.produto}
      />
      <CampoTexto
        nome="tipoPagamento"
        id="tipoPagamento"
        rotulo="Tipo de pagamento"
        required
        erro={estado.errosPorCampo.tipoPagamento}
      />
      <CampoMoeda
        nome="valor"
        id="valor"
        rotulo="Valor da OS"
        obrigatorio
        erro={estado.errosPorCampo.valor}
      />
      <Campo rotulo="Data da venda" htmlFor="dataVenda" erro={estado.errosPorCampo.dataVenda}>
        <input
          type="date"
          name="dataVenda"
          id="dataVenda"
          defaultValue={dataPadrao}
          required
          className={`num ${CLASSE_ENTRADA}`}
        />
      </Campo>
      <CampoPercentual
        nome="percentualComissao"
        id="percentualComissao"
        rotulo="% de comissão total"
        valorInicial={paraTexto(configuracaoAtual.percentualComissaoPadrao)}
        obrigatorio
        erro={estado.errosPorCampo.percentualComissao}
      />

      <fieldset className="rounded-xl border border-borda bg-superficie p-4">
        <legend className="rotulo px-1">Rateio · precisa somar o percentual total</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoPercentual
            nome="rateioThiago"
            id="rateioThiago"
            rotulo="Thiago"
            valorInicial={paraTexto(configuracaoAtual.rateioThiagoPadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_thiago}
          />
          <CampoPercentual
            nome="rateioGeice"
            id="rateioGeice"
            rotulo="Geice"
            valorInicial={paraTexto(configuracaoAtual.rateioGeicePadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_geice}
          />
          <CampoPercentual
            nome="rateioGabrielle"
            id="rateioGabrielle"
            rotulo="Gabrielle"
            valorInicial={paraTexto(configuracaoAtual.rateioGabriellePadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateio_gabrielle}
          />
        </div>
      </fieldset>

      <Campo rotulo="Observação" htmlFor="observacao">
        <textarea name="observacao" id="observacao" rows={3} className={CLASSE_ENTRADA} />
      </Campo>

      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal className="sm:w-fit">
        Cadastrar OS
      </Botao>
    </form>
  );
}
```

- [ ] **Passo 2: Substituir `src/app/(app)/os/nova/page.tsx` inteiro**

```tsx
import Link from 'next/link';
import { hojeNegocio } from '@/dominio/datas';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterConfiguracao } from '@/servidor/configuracao/servico';
import { FormularioOs } from '../FormularioOs';

export default async function PaginaNovaOs() {
  await sessaoDaPagina('admin');
  const configuracaoAtual = await obterConfiguracao();

  return (
    <main>
      <h1 className="mb-1 text-[1.375rem] font-bold tracking-tight md:text-2xl">Nova OS</h1>
      <p className="mb-6 text-[13.5px] text-texto-2">
        Os percentuais vêm da configuração e podem ser ajustados só para esta OS.
      </p>
      <FormularioOs configuracaoAtual={configuracaoAtual} dataPadrao={hojeNegocio()} />
      <p className="mt-8">
        <Link href="/os" className="text-[13px] text-texto-2 underline">
          ← Voltar para a lista
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Passo 3: Substituir `src/app/(app)/os/[id]/baixas/nova/FormularioBaixa.tsx` inteiro**

```tsx
'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { Campo, CampoTexto, CLASSE_ENTRADA } from '@/componentes/Campo';
import { CampoMoeda } from '@/componentes/CampoMoeda';
import { registrarBaixaAction } from '@/servidor/baixas/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

export function FormularioBaixa({
  osId,
  dataPadrao,
}: {
  osId: string;
  dataPadrao: string;
}) {
  const [estado, acao, emAndamento] = useActionState(
    registrarBaixaAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  return (
    <form action={acao} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="osId" value={osId} />
      <Campo rotulo="Data do pagamento" htmlFor="data" erro={estado.errosPorCampo.data}>
        <input
          type="date"
          name="data"
          id="data"
          defaultValue={dataPadrao}
          required
          className={`num ${CLASSE_ENTRADA}`}
        />
      </Campo>
      <CampoMoeda
        nome="valor"
        id="valor"
        rotulo="Valor pago"
        obrigatorio
        erro={estado.errosPorCampo.valor}
      />
      <CampoTexto nome="observacao" id="observacao" rotulo="Observação" />
      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal className="sm:w-fit">
        Registrar pagamento
      </Botao>
    </form>
  );
}
```

- [ ] **Passo 4: Substituir `src/app/(app)/os/[id]/baixas/nova/page.tsx` inteiro**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CartaoValor } from '@/componentes/CartaoValor';
import { hojeNegocio } from '@/dominio/datas';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterOsPorId } from '@/servidor/os/consultas';
import { FormularioBaixa } from './FormularioBaixa';

export default async function PaginaNovaBaixa({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await sessaoDaPagina('admin');
  const { id } = await params;
  const os = await obterOsPorId(id, false);
  if (!os) notFound();

  const saldo = os.valor - os.totalPagoCliente;

  return (
    <main>
      <h1 className="mb-1 text-[1.375rem] font-bold tracking-tight md:text-2xl">
        Registrar pagamento
      </h1>
      <p className="mb-5 text-[13.5px] text-texto-2">
        OS <span className="num">{os.numeroOs}</span> · {os.cliente}
      </p>

      <div className="mb-6 max-w-sm">
        <CartaoValor
          rotulo="Saldo a receber"
          valor={saldo}
          destaque
          detalhe="o pagamento não pode ultrapassar este valor"
        />
      </div>

      <FormularioBaixa osId={os.id} dataPadrao={hojeNegocio()} />

      <p className="mt-8">
        <Link href={`/os/${os.id}`} className="text-[13px] text-texto-2 underline">
          ← Voltar para a OS
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Passo 5: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.

- [ ] **Passo 6: Commit**

```bash
git add "src/app/(app)/os"
git commit -m "feat(visual): formulários de OS e de pagamento com campos táteis e de moeda"
```

---

### Tarefa 12: Configuração comercial

**Files:**
- Modify: `src/app/(app)/configuracao/FormularioConfiguracao.tsx` (reescrita completa)
- Modify: `src/app/(app)/configuracao/page.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `Botao`, `CampoPercentual`; `salvarConfiguracaoAction`; `obterConfiguracao`; `sessaoDaPagina`.

**Contexto:** a Tarefa 4 já trocou `label=` por `rotulo=` neste arquivo só para manter a compilação. Agora ele é reescrito de verdade. As chaves de erro aqui são os próprios nomes dos campos (`percentualComissaoPadrao`, `rateioThiagoPadrao`, …), porque `atualizarConfiguracao` valida com `validarPesos` mas o formulário mapeia para esses nomes — confira `src/servidor/configuracao/acoes.ts` antes de mexer e mantenha as chaves como estão.

- [ ] **Passo 1: Substituir `src/app/(app)/configuracao/FormularioConfiguracao.tsx` inteiro**

```tsx
'use client';

import { useActionState } from 'react';
import { Botao } from '@/componentes/Botao';
import { CampoPercentual } from '@/componentes/CampoMoeda';
import { formatarPercentual, type Percentual } from '@/dominio/dinheiro';
import { salvarConfiguracaoAction } from '@/servidor/configuracao/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

function paraTexto(percentual: Percentual): string {
  return formatarPercentual(percentual).replace('%', '');
}

export function FormularioConfiguracao({
  configuracaoAtual,
}: {
  configuracaoAtual: {
    percentualComissaoPadrao: Percentual;
    rateioThiagoPadrao: Percentual;
    rateioGeicePadrao: Percentual;
    rateioGabriellePadrao: Percentual;
  };
}) {
  const [estado, acao, emAndamento] = useActionState(
    salvarConfiguracaoAction,
    ESTADO_INICIAL_FORMULARIO,
  );

  return (
    <form action={acao} className="flex max-w-md flex-col gap-4">
      <CampoPercentual
        nome="percentualComissaoPadrao"
        id="percentualComissaoPadrao"
        rotulo="% de comissão padrão"
        valorInicial={paraTexto(configuracaoAtual.percentualComissaoPadrao)}
        obrigatorio
        erro={estado.errosPorCampo.percentualComissaoPadrao}
      />

      <fieldset className="rounded-xl border border-borda bg-superficie p-4">
        <legend className="rotulo px-1">Rateio padrão · precisa somar o percentual acima</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoPercentual
            nome="rateioThiagoPadrao"
            id="rateioThiagoPadrao"
            rotulo="Thiago"
            valorInicial={paraTexto(configuracaoAtual.rateioThiagoPadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateioThiagoPadrao}
          />
          <CampoPercentual
            nome="rateioGeicePadrao"
            id="rateioGeicePadrao"
            rotulo="Geice"
            valorInicial={paraTexto(configuracaoAtual.rateioGeicePadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateioGeicePadrao}
          />
          <CampoPercentual
            nome="rateioGabriellePadrao"
            id="rateioGabriellePadrao"
            rotulo="Gabrielle"
            valorInicial={paraTexto(configuracaoAtual.rateioGabriellePadrao)}
            obrigatorio
            erro={estado.errosPorCampo.rateioGabriellePadrao}
          />
        </div>
      </fieldset>

      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}
      <Botao type="submit" carregando={emAndamento} larguraTotal className="sm:w-fit">
        Salvar
      </Botao>
    </form>
  );
}
```

- [ ] **Passo 2: Substituir `src/app/(app)/configuracao/page.tsx` inteiro**

```tsx
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
```

- [ ] **Passo 3: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.

- [ ] **Passo 4: Commit**

```bash
git add "src/app/(app)/configuracao"
git commit -m "feat(visual): tela de configuração comercial na linguagem nova"
```

---

### Tarefa 13: Lista de lotes e geração de lote

**Files:**
- Modify: `src/app/(app)/lotes/page.tsx` (reescrita completa)
- Modify: `src/app/(app)/lotes/gerar/page.tsx` (reescrita completa)
- Modify: `src/app/(app)/lotes/gerar/FormularioGerarLote.tsx` (reescrita completa)
- Delete: `src/app/(app)/lotes/rubricas.ts`

**Interfaces:**
- Consumes: `listarLotes`; `listarOsComComissaoDisponivel`; `gerarLoteAction`; `Selo`/`seloDeEstadoLote` (Tarefa 3, substitui `rubricas.ts`); `CartaoLista`, `EstadoVazio`, `Moeda`, `Botao`, `BotaoLink`.

**Contexto:** `src/app/(app)/lotes/rubricas.ts` existe só para traduzir `estado_conferencia`. Esse papel passa para `seloDeEstadoLote`, que devolve rótulo **e** tom juntos — então o arquivo é apagado, senão ficam duas fontes da verdade para o mesmo rótulo.

O total do formulário de geração passa a acompanhar a seleção ao vivo. Isso é conveniência de tela: o valor gravado continua sendo recalculado no servidor dentro da transação, e o aviso disso permanece visível.

- [ ] **Passo 1: Apagar `rubricas.ts`**

```bash
git rm "src/app/(app)/lotes/rubricas.ts"
```

- [ ] **Passo 2: Substituir `src/app/(app)/lotes/page.tsx` inteiro**

```tsx
import { BotaoLink } from '@/componentes/Botao';
import { CartaoLista } from '@/componentes/CartaoLista';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeEstadoLote } from '@/componentes/Selo';
import { formatarDataBr } from '@/dominio/datas';
import { sessaoDaPagina } from '@/servidor/auth';
import { listarLotes } from '@/servidor/lotes/consultas';

export default async function PaginaListaLotes() {
  const sessao = await sessaoDaPagina();
  const lotes = await listarLotes();
  const ehAdmin = sessao.papel === 'admin';

  return (
    <main>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">
          Lotes enviados ao financeiro
        </h1>
        {ehAdmin && <BotaoLink href="/lotes/gerar">Gerar novo lote</BotaoLink>}
      </div>

      {lotes.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum lote gerado ainda"
          descricao="Um lote reúne as comissões já liberadas por pagamento de cliente e é o documento que vai para o financeiro."
          acao={ehAdmin ? <BotaoLink href="/lotes/gerar">Gerar o primeiro lote</BotaoLink> : undefined}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2.5 md:hidden">
            {lotes.map((lote) => (
              <li key={lote.id}>
                <CartaoLista
                  href={`/lotes/${lote.id}`}
                  titulo={`Lote ${lote.numero}`}
                  selo={seloDeEstadoLote(lote.estadoConferencia)}
                  descricao={
                    lote.dataEnvio ? `Enviado em ${formatarDataBr(lote.dataEnvio)}` : 'Sem data de envio'
                  }
                  rotuloValor="Total"
                  valor={lote.valorTotal}
                />
              </li>
            ))}
          </ul>

          <table className="tabela hidden md:table">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Data de envio</th>
                <th scope="col" className="direita">Total</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((lote) => (
                <tr key={lote.id}>
                  <td>
                    <a href={`/lotes/${lote.id}`} className="num font-bold text-destaque underline">
                      Lote {lote.numero}
                    </a>
                  </td>
                  <td className="num">
                    {lote.dataEnvio ? formatarDataBr(lote.dataEnvio) : '—'}
                  </td>
                  <td className="direita font-semibold">
                    <Moeda valor={lote.valorTotal} />
                  </td>
                  <td>
                    <Selo tom={seloDeEstadoLote(lote.estadoConferencia).tom}>
                      {seloDeEstadoLote(lote.estadoConferencia).rotulo}
                    </Selo>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
```

- [ ] **Passo 3: Substituir `src/app/(app)/lotes/gerar/FormularioGerarLote.tsx` inteiro**

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Botao, BotaoLink } from '@/componentes/Botao';
import { Campo, CLASSE_ENTRADA } from '@/componentes/Campo';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { type Centavos } from '@/dominio/dinheiro';
import { gerarLoteAction } from '@/servidor/lotes/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';

interface OsElegivel {
  id: string;
  numeroOs: string;
  cliente: string;
  comissaoDisponivel: Centavos;
}

export function FormularioGerarLote({ osElegiveis }: { osElegiveis: OsElegivel[] }) {
  const [estado, acao, emAndamento] = useActionState(
    gerarLoteAction,
    ESTADO_INICIAL_FORMULARIO,
  );
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    () => new Set(osElegiveis.map((os) => os.id)),
  );

  if (osElegiveis.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma OS com comissão disponível"
        descricao="A comissão só libera na proporção do que o cliente já pagou. Registre um pagamento para liberar comissão."
        acao={<BotaoLink href="/os" variante="secundario">Ver ordens de serviço</BotaoLink>}
      />
    );
  }

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const total = osElegiveis
    .filter((os) => selecionadas.has(os.id))
    .reduce((acc, os) => acc + os.comissaoDisponivel, 0n);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2.5">
        {osElegiveis.map((os) => {
          const marcada = selecionadas.has(os.id);
          return (
            <li key={os.id}>
              <label
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3.5 ${
                  marcada ? 'border-destaque bg-destaque-suave' : 'border-borda bg-superficie'
                }`}
              >
                <input
                  type="checkbox"
                  name="osIds"
                  value={os.id}
                  checked={marcada}
                  onChange={() => alternar(os.id)}
                  className="size-4 accent-[var(--cor-destaque)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="num block text-sm font-bold">{os.numeroOs}</span>
                  <span className="block truncate text-[13px] text-texto-2">{os.cliente}</span>
                </span>
                <Moeda valor={os.comissaoDisponivel} className="text-sm font-semibold" />
              </label>
            </li>
          );
        })}
      </ul>

      <Campo rotulo="Observação (opcional)" htmlFor="observacao">
        <input name="observacao" id="observacao" className={`${CLASSE_ENTRADA} md:max-w-md`} />
      </Campo>

      {estado.erroGeral && (
        <p role="alert" className="text-[13px] text-erro">
          {estado.erroGeral}
        </p>
      )}

      {/* Gruda no rodapé em listas longas: o botão nunca fica fora de alcance. */}
      <div className="sticky bottom-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda-forte bg-superficie p-3.5 shadow-lg md:bottom-4">
        <div>
          <p className="rotulo">
            {selecionadas.size} de {osElegiveis.length} selecionadas
          </p>
          <p className="num mt-1 text-[1.4rem] font-bold text-destaque">
            <Moeda valor={total} />
          </p>
        </div>
        <Botao type="submit" carregando={emAndamento} disabled={selecionadas.size === 0}>
          Confirmar envio
        </Botao>
      </div>
    </form>
  );
}
```

- [ ] **Passo 4: Substituir `src/app/(app)/lotes/gerar/page.tsx` inteiro**

```tsx
import Link from 'next/link';
import { sessaoDaPagina } from '@/servidor/auth';
import { listarOsComComissaoDisponivel } from '@/servidor/os/consultas';
import { FormularioGerarLote } from './FormularioGerarLote';

export default async function PaginaGerarLote() {
  await sessaoDaPagina('admin');
  const osElegiveis = await listarOsComComissaoDisponivel();

  return (
    <main>
      <h1 className="mb-1 text-[1.375rem] font-bold tracking-tight md:text-2xl">
        Gerar relatório para o financeiro
      </h1>
      <p className="mb-6 max-w-xl text-[13.5px] text-texto-2">
        Confira o que entra. O total abaixo é o da abertura da página; o valor gravado é
        sempre recalculado no servidor, dentro da transação, no momento da confirmação.
      </p>
      <FormularioGerarLote osElegiveis={osElegiveis} />
      <p className="mt-8">
        <Link href="/lotes" className="text-[13px] text-texto-2 underline">
          ← Voltar para os lotes
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Passo 5: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.
Run: `grep -rn "rubricas" src/` → sem resultado.

- [ ] **Passo 6: Commit**

```bash
git add -A "src/app/(app)/lotes"
git commit -m "feat(visual): lista de lotes e geração com total ao vivo e barra fixa"
```

---

### Tarefa 14: Detalhe do lote

**Files:**
- Modify: `src/app/(app)/lotes/[id]/page.tsx` (reescrita completa)
- Modify: `src/app/(app)/lotes/[id]/AcoesLote.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `obterLotePorId`; `aprovarLoteAction`; `Botao`, `BotaoLink`, `Selo`, `seloDeEstadoLote`, `CartaoValor`, `Moeda`, `CartaoLista`.

**Contexto:** a coluna de rateio só existe para admin. Quando o item não tem rateio (papel financeiro), a célula **não** é omitida — a coluna inteira deixa de existir, senão a tabela desalinha.

- [ ] **Passo 1: Substituir `src/app/(app)/lotes/[id]/AcoesLote.tsx` inteiro**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/Botao';
import { aprovarLoteAction } from '@/servidor/lotes/acoes';

export function AcoesLote({
  loteId,
  estadoConferencia,
}: {
  loteId: string;
  estadoConferencia: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  if (estadoConferencia !== 'enviado') return null;

  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        carregando={pendente}
        onClick={() =>
          iniciarTransicao(async () => {
            const resultado = await aprovarLoteAction(loteId);
            setErro(resultado.erro);
          })
        }
      >
        Marcar como aprovado pelo financeiro
      </Botao>
      {erro && (
        <p role="alert" className="text-[13px] text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Passo 2: Substituir `src/app/(app)/lotes/[id]/page.tsx` inteiro**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoValor } from '@/componentes/CartaoValor';
import { Moeda } from '@/componentes/Moeda';
import { Selo, seloDeEstadoLote } from '@/componentes/Selo';
import { formatarDataBr } from '@/dominio/datas';
import { sessaoDaPagina } from '@/servidor/auth';
import { obterLotePorId } from '@/servidor/lotes/consultas';
import { AcoesLote } from './AcoesLote';

export default async function PaginaDetalheLote({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await sessaoDaPagina();
  const { id } = await params;
  const ehAdmin = sessao.papel === 'admin';
  const lote = await obterLotePorId(id, ehAdmin);
  if (!lote) notFound();

  const selo = seloDeEstadoLote(lote.estadoConferencia);

  return (
    <main>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[1.375rem] font-bold tracking-tight md:text-2xl">
              Lote <span className="num text-destaque">{lote.numero}</span>
            </h1>
            <Selo tom={selo.tom}>{selo.rotulo}</Selo>
          </div>
          <p className="mt-1 text-[13.5px] text-texto-2">
            {lote.dataEnvio ? `Enviado em ${formatarDataBr(lote.dataEnvio)}` : 'Sem data de envio'}
            {lote.observacao ? ` · ${lote.observacao}` : ''}
          </p>
        </div>
        <BotaoLink href={`/lotes/${lote.id}/imprimir`} target="_blank" variante="secundario">
          Ver relatório para impressão
        </BotaoLink>
      </div>

      <div className="mb-5 max-w-sm">
        <CartaoValor
          rotulo="Total do lote"
          valor={lote.valorTotal}
          destaque
          detalhe={`${lote.itens.length} ${lote.itens.length === 1 ? 'item' : 'itens'}`}
        />
      </div>

      {ehAdmin && (
        <div className="mb-6">
          <AcoesLote loteId={lote.id} estadoConferencia={lote.estadoConferencia} />
        </div>
      )}

      {/* Celular */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {lote.itens.map((item) => (
          <li key={item.id} className="rounded-xl border border-borda bg-superficie p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="num text-sm font-bold">{item.numeroOsSnapshot}</span>
              <Moeda valor={item.valorComissao} className="text-[15px] font-bold text-destaque" />
            </div>
            <p className="mt-1 text-[13px] text-texto-2">
              {item.clienteSnapshot} · {item.produtoSnapshot}
            </p>
            {item.rateio && (
              <p className="num mt-2 border-t border-borda pt-2 text-[12px] text-texto-2">
                T <Moeda valor={item.rateio.thiago} /> · G <Moeda valor={item.rateio.geice} /> · Ga{' '}
                <Moeda valor={item.rateio.gabrielle} />
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Computador */}
      <table className="tabela hidden md:table">
        <thead>
          <tr>
            <th scope="col">OS</th>
            <th scope="col">Cliente</th>
            <th scope="col">Produto</th>
            <th scope="col" className="direita">Comissão do trecho</th>
            {ehAdmin && <th scope="col" className="direita">Thiago / Geice / Gabrielle</th>}
          </tr>
        </thead>
        <tbody>
          {lote.itens.map((item) => (
            <tr key={item.id}>
              <td className="num font-bold">{item.numeroOsSnapshot}</td>
              <td>{item.clienteSnapshot}</td>
              <td className="text-texto-2">{item.produtoSnapshot}</td>
              <td className="direita font-semibold">
                <Moeda valor={item.valorComissao} />
              </td>
              {ehAdmin && (
                <td className="direita text-[13px] text-texto-2">
                  {item.rateio ? (
                    <>
                      <Moeda valor={item.rateio.thiago} /> / <Moeda valor={item.rateio.geice} /> /{' '}
                      <Moeda valor={item.rateio.gabrielle} />
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6">
        <Link href="/lotes" className="text-[13px] text-texto-2 underline">
          ← Voltar para os lotes
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Passo 3: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.

- [ ] **Passo 4: Commit**

```bash
git add "src/app/(app)/lotes/[id]/page.tsx" "src/app/(app)/lotes/[id]/AcoesLote.tsx"
git commit -m "feat(visual): detalhe do lote com coluna de rateio só para admin"
```

---

### Tarefa 15: Relatório de impressão com os quatro valores por OS

**Files:**
- Modify: `src/servidor/lotes/consultas.ts` (**exceção explícita** à regra de não tocar `src/servidor`: o `ItemLote` ganha três campos)
- Modify: `src/app/(app)/lotes/[id]/imprimir/ConteudoImpressao.tsx` (reescrita completa)
- Modify: `src/app/(app)/lotes/[id]/imprimir/page.tsx` (ajuste pequeno)
- Test: `tests/integracao/lotes-consultas.test.ts` (acrescentar asserções)

**Interfaces:**
- Produces (ampliação de `ItemLote`):
  - `valorOsSnapshot: Centavos`
  - `totalPagoClienteSnapshot: Centavos`
  - `comissaoComprometidaAnteriorSnapshot: Centavos`

**Contexto:** os quatro valores do relatório vêm todos do snapshot gravado na geração do lote, então o documento é congelado: se a OS mudar depois, o relatório já emitido não muda. Hoje `obterLotePorId` não projeta três desses campos, por isso a consulta precisa crescer. Nenhuma regra de cálculo muda.

- [ ] **Passo 1: Escrever a asserção que falha**

Em `tests/integracao/lotes-consultas.test.ts`, dentro do caso `'lista o lote enviado e detalha com e sem rateio'`, logo depois do `expect(semRateio?.itens).toHaveLength(1);`, acrescentar:

```ts
        expect(semRateio?.itens[0]).toMatchObject({
          valorOsSnapshot: 1_000_000n,
          totalPagoClienteSnapshot: 1_000_000n,
          comissaoComprometidaAnteriorSnapshot: 0n,
        });
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npm run test:integracao -- lotes-consultas`
Expected: FAIL — o objeto não tem essas propriedades (e o TypeScript já reclama antes disso).

- [ ] **Passo 3: Ampliar `ItemLote` em `src/servidor/lotes/consultas.ts`**

Na interface `ItemLote`, acrescentar depois de `valorComissao`:

```ts
  valorOsSnapshot: Centavos;
  totalPagoClienteSnapshot: Centavos;
  comissaoComprometidaAnteriorSnapshot: Centavos;
```

Na consulta **com** rateio, trocar a lista de colunas por:

```sql
        select li.id, li.ordem, li.numero_os_snapshot, li.cliente_snapshot,
          li.produto_snapshot, li.valor_comissao, li.valor_os_snapshot,
          li.total_pago_cliente_snapshot, li.comissao_comprometida_anterior_snapshot,
          r.valor_thiago, r.valor_geice, r.valor_gabrielle
        from public.lote_item li
        join interno.lote_item_rateio r on r.lote_item_id = li.id
        where li.lote_id = ${loteId}
        order by li.ordem
```

Na consulta **sem** rateio:

```sql
        select id, ordem, numero_os_snapshot, cliente_snapshot,
          produto_snapshot, valor_comissao, valor_os_snapshot,
          total_pago_cliente_snapshot, comissao_comprometida_anterior_snapshot
        from public.lote_item
        where lote_id = ${loteId}
        order by ordem
```

No `map` que monta cada item, acrescentar depois de `valorComissao`:

```ts
      valorOsSnapshot: parseDecimal(i.valor_os_snapshot),
      totalPagoClienteSnapshot: parseDecimal(i.total_pago_cliente_snapshot),
      comissaoComprometidaAnteriorSnapshot: parseDecimal(
        i.comissao_comprometida_anterior_snapshot,
      ),
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npm run test:integracao -- lotes-consultas`
Expected: PASS.

- [ ] **Passo 5: Substituir `src/app/(app)/lotes/[id]/imprimir/ConteudoImpressao.tsx` inteiro**

```tsx
'use client';

import { Botao } from '@/componentes/Botao';
import { formatarDataBr } from '@/dominio/datas';
import { formatarBRL } from '@/dominio/dinheiro';
import type { LoteDetalhe } from '@/servidor/lotes/consultas';

export function ConteudoImpressao({ lote }: { lote: LoteDetalhe }) {
  const totalValorOs = lote.itens.reduce((acc, i) => acc + i.valorOsSnapshot, 0n);
  const totalPago = lote.itens.reduce((acc, i) => acc + i.totalPagoClienteSnapshot, 0n);
  const totalJaEnviado = lote.itens.reduce(
    (acc, i) => acc + i.comissaoComprometidaAnteriorSnapshot,
    0n,
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0">
      <header className="flex items-start justify-between gap-4 border-b-2 border-texto pb-2.5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.18em]">
          Controle de Comissão
        </p>
        <p className="text-right text-[10px] leading-relaxed text-texto-2">
          Lote <strong className="text-texto">{lote.numero}</strong>
          <br />
          {lote.dataEnvio ? `Enviado em ${formatarDataBr(lote.dataEnvio)}` : 'Sem data de envio'}
        </p>
      </header>

      <h1 className="mt-4 mb-0.5 text-lg font-bold tracking-tight">Relatório de comissão</h1>
      <p className="mb-5 text-[10.5px] text-texto-2">
        Comissões liberadas por pagamento de cliente já recebido.
        {lote.observacao ? ` ${lote.observacao}` : ''}
      </p>

      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="border-b border-texto">
            <th scope="col" className="pb-1.5 text-left text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">OS</th>
            <th scope="col" className="pb-1.5 pl-2 text-left text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Cliente e produto</th>
            <th scope="col" className="pb-1.5 pl-2 text-right text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Valor da OS</th>
            <th scope="col" className="pb-1.5 pl-2 text-right text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Pago pelo cliente</th>
            <th scope="col" className="pb-1.5 pl-2 text-right text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Comissão já enviada</th>
            <th scope="col" className="pb-1.5 pl-2 text-right text-[7.5px] font-bold uppercase tracking-[0.1em] text-texto-2">Liberada para pagamento</th>
          </tr>
        </thead>
        <tbody>
          {lote.itens.map((item) => (
            <tr key={item.id} className="border-b border-borda align-top">
              <td className="num py-2 font-bold">{item.numeroOsSnapshot}</td>
              <td className="py-2 pl-2">
                {item.clienteSnapshot}
                <span className="block text-[9.5px] text-texto-2">{item.produtoSnapshot}</span>
              </td>
              <td className="num py-2 pl-2 text-right">{formatarBRL(item.valorOsSnapshot)}</td>
              <td className="num py-2 pl-2 text-right">
                {formatarBRL(item.totalPagoClienteSnapshot)}
              </td>
              <td className="num py-2 pl-2 text-right">
                {/* Zero e "não se aplica" são coisas diferentes: primeira vez da OS num lote mostra traço. */}
                {item.comissaoComprometidaAnteriorSnapshot > 0n
                  ? formatarBRL(item.comissaoComprometidaAnteriorSnapshot)
                  : '—'}
              </td>
              <td className="num py-2 pl-2 text-right font-bold">
                {formatarBRL(item.valorComissao)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-texto font-bold">
            <td colSpan={2} className="pt-2.5 text-[11.5px]">
              Total do lote · {lote.itens.length} {lote.itens.length === 1 ? 'item' : 'itens'}
            </td>
            <td className="num pt-2.5 pl-2 text-right">{formatarBRL(totalValorOs)}</td>
            <td className="num pt-2.5 pl-2 text-right">{formatarBRL(totalPago)}</td>
            <td className="num pt-2.5 pl-2 text-right">
              {totalJaEnviado > 0n ? formatarBRL(totalJaEnviado) : '—'}
            </td>
            <td className="num pt-2.5 pl-2 text-right text-[15px] tracking-tight">
              {formatarBRL(lote.valorTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-9 flex gap-6">
        <p className="flex-1 border-t border-borda-forte pt-1.5 text-[9px] text-texto-2">
          Conferido por
        </p>
        <p className="flex-1 border-t border-borda-forte pt-1.5 text-[9px] text-texto-2">Data</p>
      </div>

      <footer className="mt-6 flex justify-between border-t border-borda pt-2 text-[8.5px] text-texto-2">
        <span>Controle de Comissão · lote {lote.numero}</span>
        <span>Documento gerado a partir dos valores congelados no envio do lote</span>
      </footer>

      <div className="sem-impressao mt-7">
        <Botao type="button" onClick={() => window.print()}>
          Imprimir / salvar PDF
        </Botao>
      </div>
    </main>
  );
}
```

- [ ] **Passo 6: Ajustar `src/app/(app)/lotes/[id]/imprimir/page.tsx`**

Trocar `await exigirSessao();` por `await sessaoDaPagina();` (se a Tarefa 7 ainda não tiver feito) e o import correspondente. O `obterLotePorId(id, false)` continua com `false` — o relatório nunca carrega rateio, nem para admin.

- [ ] **Passo 7: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.
Run: `npm test` → `90 passed` continua, mais o caso ampliado de lotes-consultas.

- [ ] **Passo 8: Commit**

```bash
git add src/servidor/lotes/consultas.ts "src/app/(app)/lotes/[id]/imprimir" tests/integracao/lotes-consultas.test.ts
git commit -m "feat(visual): relatório de impressão com valor da OS, pago, já enviado e liberado"
```

---

### Tarefa 16: Agregações puras do painel

**Files:**
- Create: `src/dominio/painel.ts`
- Test: `tests/dominio/painel.test.ts`

**Interfaces:**
- Consumes: `comissaoTotal`, `comissaoLiberada`, `statusRecebimento`, `StatusRecebimento` de `./comissao`; `Centavos`, `Percentual` de `./dinheiro`; `ratearIntervalo`, `somaPorPessoa`, `ZERO_POR_PESSOA`, `PorPessoa` de `./rateio`.
- Produces:
  - `interface ComponentesOs { osId: string; valorOs: Centavos; percentualComissao: Percentual; totalPagoCliente: Centavos; comprometido: Centavos; mesVenda: string; pesos: PorPessoa | null }`
  - `interface ResumoComissoes { comissaoTotal: Centavos; liberada: Centavos; comprometida: Centavos; disponivel: Centavos; quantidadeComDisponivel: number; porStatus: Record<StatusRecebimento, number> }`
  - `interface PontoMensal { mes: string; rotulo: string; valor: Centavos }`
  - `function resumirComissoes(linhas: ComponentesOs[]): ResumoComissoes`
  - `function ratearDisponivel(linhas: ComponentesOs[]): PorPessoa`
  - `function mesesAnteriores(mesFinal: string, quantidade: number): string[]`
  - `function serieMensal(linhas: ComponentesOs[], mesFinal: string, quantidade?: number): PontoMensal[]`

**Contexto — por que isto existe:** o painel **não pode** recalcular comissão em SQL. O arredondamento half-up e o rateio `divisores_v1` vivem em `src/dominio` operando em `bigint`; uma segunda implementação em SQL divergiria por centavos e o painel passaria a discordar das telas. Então a consulta traz componentes crus e a soma acontece aqui, com as mesmas funções que as telas usam.

**Suposição registrada:** as reservas de uma OS são sempre contíguas a partir de zero, porque `gerarLote` sempre toma **todo** o espaço livre de `[0, liberada)`. Por isso o próximo trecho a pagar é exatamente `[comprometido, liberada)`, e é esse intervalo que `ratearDisponivel` rateia. Se algum dia existir reserva parcial, esta função precisa passar a receber os intervalos reais.

- [ ] **Passo 1: Escrever o teste**

`tests/dominio/painel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  mesesAnteriores,
  ratearDisponivel,
  resumirComissoes,
  serieMensal,
  type ComponentesOs,
} from '@/dominio/painel';

function os(sobrescrever: Partial<ComponentesOs> = {}): ComponentesOs {
  return {
    osId: 'a',
    valorOs: 1_000_000n,
    percentualComissao: 700n,
    totalPagoCliente: 500_000n,
    comprometido: 0n,
    mesVenda: '2026-09',
    pesos: { thiago: 500n, geice: 100n, gabrielle: 100n },
    ...sobrescrever,
  };
}

describe('resumirComissoes', () => {
  it('soma total, liberada, comprometida e disponível', () => {
    const resumo = resumirComissoes([
      os(),
      os({ osId: 'b', totalPagoCliente: 1_000_000n, comprometido: 35_000n }),
    ]);
    expect(resumo.comissaoTotal).toBe(140_000n);
    expect(resumo.liberada).toBe(105_000n);
    expect(resumo.comprometida).toBe(35_000n);
    expect(resumo.disponivel).toBe(70_000n);
    expect(resumo.quantidadeComDisponivel).toBe(2);
  });

  it('conta OS por status de recebimento', () => {
    const resumo = resumirComissoes([
      os({ osId: 'a', totalPagoCliente: 0n }),
      os({ osId: 'b', totalPagoCliente: 500_000n }),
      os({ osId: 'c', totalPagoCliente: 1_000_000n }),
    ]);
    expect(resumo.porStatus).toEqual({ aberta: 1, parcial: 1, quitada: 1 });
  });

  it('nunca devolve disponível negativo', () => {
    const resumo = resumirComissoes([os({ totalPagoCliente: 0n, comprometido: 1_000n })]);
    expect(resumo.disponivel).toBe(0n);
  });

  it('lista vazia devolve zeros', () => {
    const resumo = resumirComissoes([]);
    expect(resumo.disponivel).toBe(0n);
    expect(resumo.quantidadeComDisponivel).toBe(0);
  });
});

describe('ratearDisponivel', () => {
  it('rateia o próximo trecho de cada OS pelo rateio dela', () => {
    // R$ 350,00 disponíveis com 5/1/1 => 250 / 50 / 50
    expect(ratearDisponivel([os()])).toEqual({
      thiago: 25_000n,
      geice: 5_000n,
      gabrielle: 5_000n,
    });
  });

  it('soma OS com rateios diferentes', () => {
    const resultado = ratearDisponivel([
      os(),
      os({ osId: 'b', pesos: { thiago: 700n, geice: 0n, gabrielle: 0n } }),
    ]);
    expect(resultado).toEqual({ thiago: 60_000n, geice: 5_000n, gabrielle: 5_000n });
  });

  it('parte já comprometida não entra no rateio', () => {
    const resultado = ratearDisponivel([
      os({ totalPagoCliente: 1_000_000n, comprometido: 35_000n }),
    ]);
    expect(resultado).toEqual({ thiago: 25_000n, geice: 5_000n, gabrielle: 5_000n });
  });

  it('ignora OS sem pesos visíveis e OS sem disponível', () => {
    expect(ratearDisponivel([os({ pesos: null })])).toEqual({
      thiago: 0n,
      geice: 0n,
      gabrielle: 0n,
    });
    expect(ratearDisponivel([os({ totalPagoCliente: 0n })])).toEqual({
      thiago: 0n,
      geice: 0n,
      gabrielle: 0n,
    });
  });
});

describe('mesesAnteriores', () => {
  it('devolve a janela em ordem cronológica e atravessa o ano', () => {
    expect(mesesAnteriores('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('serieMensal', () => {
  it('agrupa pela venda, preenche meses sem venda com zero e rotula em português', () => {
    const pontos = serieMensal(
      [os({ mesVenda: '2026-09' }), os({ osId: 'b', mesVenda: '2026-09' }), os({ osId: 'c', mesVenda: '2026-07' })],
      '2026-09',
      3,
    );
    expect(pontos).toEqual([
      { mes: '2026-07', rotulo: 'jul', valor: 70_000n },
      { mes: '2026-08', rotulo: 'ago', valor: 0n },
      { mes: '2026-09', rotulo: 'set', valor: 140_000n },
    ]);
  });

  it('ignora vendas fora da janela', () => {
    const pontos = serieMensal([os({ mesVenda: '2020-01' })], '2026-09', 2);
    expect(pontos.every((p) => p.valor === 0n)).toBe(true);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npm run test:dominio -- painel`
Expected: FAIL — `Cannot find module '@/dominio/painel'`.

- [ ] **Passo 3: Implementar `src/dominio/painel.ts`**

```ts
import {
  comissaoLiberada,
  comissaoTotal,
  statusRecebimento,
  type StatusRecebimento,
} from './comissao';
import type { Centavos, Percentual } from './dinheiro';
import {
  ratearIntervalo,
  somaPorPessoa,
  ZERO_POR_PESSOA,
  type PorPessoa,
} from './rateio';

/**
 * Componentes crus de uma OS, como vêm do banco. A comissão NUNCA é calculada
 * em SQL: é derivada aqui, com as mesmas funções que as telas usam, para não
 * existir uma segunda implementação do arredondamento.
 */
export interface ComponentesOs {
  osId: string;
  valorOs: Centavos;
  percentualComissao: Percentual;
  totalPagoCliente: Centavos;
  /** Soma já reservada em lotes não cancelados. */
  comprometido: Centavos;
  /** Mês da venda no formato YYYY-MM. */
  mesVenda: string;
  /** `null` quando o papel que consultou não pode ver rateio. */
  pesos: PorPessoa | null;
}

export interface ResumoComissoes {
  comissaoTotal: Centavos;
  liberada: Centavos;
  comprometida: Centavos;
  disponivel: Centavos;
  quantidadeComDisponivel: number;
  porStatus: Record<StatusRecebimento, number>;
}

export interface PontoMensal {
  mes: string;
  rotulo: string;
  valor: Centavos;
}

const ROTULOS_MES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function totalDa(linha: ComponentesOs): Centavos {
  return comissaoTotal(linha.valorOs, linha.percentualComissao);
}

function liberadaDa(linha: ComponentesOs): Centavos {
  return comissaoLiberada(totalDa(linha), linha.totalPagoCliente, linha.valorOs);
}

function disponivelDa(linha: ComponentesOs): Centavos {
  const liberada = liberadaDa(linha);
  return liberada > linha.comprometido ? liberada - linha.comprometido : 0n;
}

export function resumirComissoes(linhas: ComponentesOs[]): ResumoComissoes {
  const porStatus: Record<StatusRecebimento, number> = { aberta: 0, parcial: 0, quitada: 0 };
  let total = 0n;
  let liberada = 0n;
  let comprometida = 0n;
  let disponivel = 0n;
  let quantidadeComDisponivel = 0;

  for (const linha of linhas) {
    total += totalDa(linha);
    liberada += liberadaDa(linha);
    comprometida += linha.comprometido;
    const daLinha = disponivelDa(linha);
    disponivel += daLinha;
    if (daLinha > 0n) quantidadeComDisponivel += 1;
    porStatus[statusRecebimento(linha.totalPagoCliente, linha.valorOs)] += 1;
  }

  return { comissaoTotal: total, liberada, comprometida, disponivel, quantidadeComDisponivel, porStatus };
}

/**
 * Quanto cada pessoa receberia se tudo que está disponível virasse lote agora.
 *
 * Suposição: as reservas de uma OS são contíguas a partir de zero, porque
 * `gerarLote` sempre toma todo o espaço livre de [0, liberada). Logo o próximo
 * trecho é exatamente [comprometido, liberada).
 */
export function ratearDisponivel(linhas: ComponentesOs[]): PorPessoa {
  let acumulado: PorPessoa = { ...ZERO_POR_PESSOA };

  for (const linha of linhas) {
    if (!linha.pesos) continue;
    const liberada = liberadaDa(linha);
    if (liberada <= linha.comprometido) continue;
    acumulado = somaPorPessoa(
      acumulado,
      ratearIntervalo(linha.pesos, linha.comprometido, liberada),
    );
  }

  return acumulado;
}

export function mesesAnteriores(mesFinal: string, quantidade: number): string[] {
  const [anoTexto, mesTexto] = mesFinal.split('-');
  let ano = Number(anoTexto);
  let mes = Number(mesTexto);
  const janela: string[] = [];

  for (let i = 0; i < quantidade; i += 1) {
    janela.unshift(`${ano}-${String(mes).padStart(2, '0')}`);
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      ano -= 1;
    }
  }

  return janela;
}

export function serieMensal(
  linhas: ComponentesOs[],
  mesFinal: string,
  quantidade = 12,
): PontoMensal[] {
  const janela = mesesAnteriores(mesFinal, quantidade);
  const soma = new Map<string, Centavos>(janela.map((mes) => [mes, 0n]));

  for (const linha of linhas) {
    const atual = soma.get(linha.mesVenda);
    if (atual === undefined) continue;
    soma.set(linha.mesVenda, atual + totalDa(linha));
  }

  return janela.map((mes) => ({
    mes,
    rotulo: ROTULOS_MES[Number(mes.slice(5, 7)) - 1],
    valor: soma.get(mes) ?? 0n,
  }));
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npm run test:dominio -- painel`
Expected: PASS.

Run: `npm test`
Expected: os 90 anteriores continuam passando, mais os novos.

- [ ] **Passo 5: Commit**

```bash
git add src/dominio/painel.ts tests/dominio/painel.test.ts
git commit -m "feat(dominio): agregações puras do painel reusando o cálculo de comissão"
```

---

### Tarefa 17: Consultas do painel

**Files:**
- Create: `src/servidor/painel/consultas.ts`
- Test: `tests/integracao/painel.test.ts`

**Interfaces:**
- Consumes: `sql` e `Executor` de `@/servidor/db`; `parseDecimal`, `parsePercentual` de `@/dominio/dinheiro`; `ComponentesOs` de `@/dominio/painel`.
- Produces:
  - `const DIAS_PARA_ALERTA = 15`
  - `function componentesPorOs(incluirRateio: boolean, exec?: Executor): Promise<ComponentesOs[]>`
  - `interface LotePendente { id: string; numero: number; valorTotal: Centavos; dias: number }`
  - `interface ResumoLotes { aguardandoConferencia: { total: Centavos; quantidade: number }; aprovado: { total: Centavos; quantidade: number }; pendentes: LotePendente[] }`
  - `function resumoLotes(exec?: Executor): Promise<ResumoLotes>`

**Contexto:** `componentesPorOs(false)` **não pode** fazer join com `interno.os_rateio` — é a garantia de que o painel do financeiro não carrega rateio nem por acidente. A idade do lote usa a data no fuso do negócio, não `current_date`, que no Supabase está em UTC e viraria o dia com três horas de antecedência.

Os testes seguem o padrão do repositório: usuário real do Auth, cenário montado dentro da transação e desfeito por rollback, porque `app_writer` não tem privilégio de exclusão.

- [ ] **Passo 1: Escrever o teste**

`tests/integracao/painel.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { comTransacaoFinanceira, sql } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { componentesPorOs, resumoLotes } from '@/servidor/painel/consultas';
import { ratearDisponivel, resumirComissoes } from '@/dominio/painel';
import { criarUsuarioTeste, numeroOsTeste } from './ajuda';

const ROLLBACK_TESTE = new Error('ROLLBACK_TESTE');

describe('consultas do painel', () => {
  let usuario: Awaited<ReturnType<typeof criarUsuarioTeste>>;

  beforeAll(async () => {
    usuario = await criarUsuarioTeste();
  });

  async function osComMetadePaga(tx: postgres.TransactionSql) {
    const { osId } = await cadastrarOs(
      tx,
      {
        numeroOs: numeroOsTeste('PAINEL'),
        cliente: 'Cliente Painel',
        produto: 'Produto Painel',
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

  it('traz componentes crus e o rateio só quando pedido', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);

        const comRateio = await componentesPorOs(true, tx);
        const linha = comRateio.find((l) => l.osId === osId);
        expect(linha).toMatchObject({
          valorOs: 1_000_000n,
          percentualComissao: 700n,
          totalPagoCliente: 500_000n,
          comprometido: 0n,
          mesVenda: '2026-09',
          pesos: { thiago: 500n, geice: 100n, gabrielle: 100n },
        });

        // O resumo puro derivado dessas linhas bate com o esperado da OS.
        expect(resumirComissoes([linha!]).disponivel).toBe(35_000n);
        expect(ratearDisponivel([linha!])).toEqual({
          thiago: 25_000n,
          geice: 5_000n,
          gabrielle: 5_000n,
        });

        const semRateio = await componentesPorOs(false, tx);
        expect(semRateio.find((l) => l.osId === osId)?.pesos).toBeNull();
        expect(semRateio.every((l) => l.pesos === null)).toBe(true);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('reflete o comprometido depois que a OS entra num lote', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);
        await gerarLote(tx, { osIds: [osId], observacao: null }, usuario.id);

        const linha = (await componentesPorOs(true, tx)).find((l) => l.osId === osId);
        expect(linha?.comprometido).toBe(35_000n);
        expect(resumirComissoes([linha!]).disponivel).toBe(0n);

        throw ROLLBACK_TESTE;
      }),
    ).rejects.toBe(ROLLBACK_TESTE);
  });

  it('resume lotes por estado e mede a idade do que está enviado', async () => {
    await expect(
      comTransacaoFinanceira(async (tx) => {
        const osId = await osComMetadePaga(tx);
        const { loteId, numero } = await gerarLote(
          tx,
          { osIds: [osId], observacao: null },
          usuario.id,
        );

        const resumo = await resumoLotes(tx);
        expect(resumo.aguardandoConferencia.quantidade).toBeGreaterThanOrEqual(1);
        expect(resumo.aguardandoConferencia.total).toBeGreaterThanOrEqual(35_000n);

        const pendente = resumo.pendentes.find((l) => l.id === loteId);
        expect(pendente).toMatchObject({ numero, valorTotal: 35_000n, dias: 0 });

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

Run: `npm run test:integracao -- painel`
Expected: FAIL — `Cannot find module '@/servidor/painel/consultas'`.

- [ ] **Passo 3: Implementar `src/servidor/painel/consultas.ts`**

```ts
import { parseDecimal, parsePercentual, type Centavos } from '@/dominio/dinheiro';
import type { ComponentesOs } from '@/dominio/painel';
import { sql, type Executor } from '@/servidor/db';

/** Lote enviado há mais dias que isto recebe alerta nos dois painéis. */
export const DIAS_PARA_ALERTA = 15;

export interface LotePendente {
  id: string;
  numero: number;
  valorTotal: Centavos;
  dias: number;
}

export interface ResumoLotes {
  aguardandoConferencia: { total: Centavos; quantidade: number };
  aprovado: { total: Centavos; quantidade: number };
  pendentes: LotePendente[];
}

/**
 * Componentes crus por OS. Nenhuma comissão é calculada aqui — quem soma é
 * `src/dominio/painel.ts`, com as mesmas funções das telas.
 *
 * Quando `incluirRateio` é falso a consulta não toca `interno.os_rateio`:
 * é assim que o painel do financeiro fica incapaz de carregar rateio.
 */
export async function componentesPorOs(
  incluirRateio: boolean,
  exec: Executor = sql,
): Promise<ComponentesOs[]> {
  const comuns = exec`
    o.id, o.valor, o.percentual_comissao,
    to_char(o.data_venda, 'YYYY-MM') as mes_venda,
    (
      select coalesce(sum(case when b.tipo = 'estorno' then -b.valor else b.valor end), 0)
      from public.baixa_cliente b
      where b.os_id = o.id
    ) as total_pago,
    (
      select coalesce(sum(li.valor_comissao), 0)
      from public.lote_item li
      join public.lote_financeiro lf on lf.id = li.lote_id
      where li.os_id = o.id and lf.estado_conferencia <> 'cancelado'
    ) as comprometido
  `;

  const linhas = incluirRateio
    ? await exec`
        select ${comuns}, r.rateio_thiago, r.rateio_geice, r.rateio_gabrielle
        from public.os o
        join interno.os_rateio r on r.os_id = o.id
        where o.situacao = 'ativa'
      `
    : await exec`
        select ${comuns}
        from public.os o
        where o.situacao = 'ativa'
      `;

  return linhas.map((linha) => ({
    osId: linha.id,
    valorOs: parseDecimal(linha.valor),
    percentualComissao: parsePercentual(linha.percentual_comissao),
    totalPagoCliente: parseDecimal(linha.total_pago),
    comprometido: parseDecimal(linha.comprometido),
    mesVenda: linha.mes_venda,
    pesos: incluirRateio
      ? {
          thiago: parsePercentual(linha.rateio_thiago),
          geice: parsePercentual(linha.rateio_geice),
          gabrielle: parsePercentual(linha.rateio_gabrielle),
        }
      : null,
  }));
}

export async function resumoLotes(exec: Executor = sql): Promise<ResumoLotes> {
  const porEstado = await exec`
    select estado_conferencia,
      coalesce(sum(valor_total_original), 0) as total,
      count(*)::int as quantidade
    from public.lote_financeiro
    where estado_conferencia in ('enviado', 'aprovado')
    group by estado_conferencia
  `;

  // A idade usa a data no fuso do negócio; current_date no servidor está em UTC
  // e viraria o dia três horas antes.
  const pendentes = await exec`
    select id, numero, valor_total_original,
      greatest(
        0,
        ((now() at time zone 'America/Sao_Paulo')::date - data_envio)
      )::int as dias
    from public.lote_financeiro
    where estado_conferencia = 'enviado'
    order by data_envio nulls last, numero
  `;

  function estado(nome: string): { total: Centavos; quantidade: number } {
    const linha = porEstado.find((l) => l.estado_conferencia === nome);
    return {
      total: linha ? parseDecimal(linha.total) : 0n,
      quantidade: linha ? linha.quantidade : 0,
    };
  }

  return {
    aguardandoConferencia: estado('enviado'),
    aprovado: estado('aprovado'),
    pendentes: pendentes.map((l) => ({
      id: l.id,
      numero: Number(l.numero),
      valorTotal: parseDecimal(l.valor_total_original),
      dias: l.dias ?? 0,
    })),
  };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npm run test:integracao -- painel`
Expected: PASS.

Run: `npm test` → tudo verde.

- [ ] **Passo 5: Commit**

```bash
git add src/servidor/painel/consultas.ts tests/integracao/painel.test.ts
git commit -m "feat(painel): consultas de componentes por OS e resumo de lotes"
```

---

### Tarefa 18: Painel do admin

**Files:**
- Create: `src/app/(app)/PainelAdmin.tsx`

**Interfaces:**
- Consumes: `ResumoComissoes`, `PontoMensal`, `PorPessoa`; `ResumoLotes`, `LotePendente`, `DIAS_PARA_ALERTA`; `CartaoValor`, `GraficoBarras`, `Moeda`, `BotaoLink`, `EstadoVazio`.
- Produces: `function PainelAdmin({ resumo, serie, rateio, lotes })` — componente de apresentação puro, sem acesso a banco.

**Contexto:** o painel responde **uma** pergunta — "quanto posso enviar agora" — e o resto é contexto. Por isso só o disponível é grande e em ciano.

- [ ] **Passo 1: Criar `src/app/(app)/PainelAdmin.tsx`**

```tsx
import Link from 'next/link';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoValor } from '@/componentes/CartaoValor';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { GraficoBarras } from '@/componentes/GraficoBarras';
import { Moeda } from '@/componentes/Moeda';
import type { PontoMensal, ResumoComissoes } from '@/dominio/painel';
import type { PorPessoa } from '@/dominio/rateio';
import { DIAS_PARA_ALERTA, type ResumoLotes } from '@/servidor/painel/consultas';

export function PainelAdmin({
  resumo,
  serie,
  rateio,
  lotes,
}: {
  resumo: ResumoComissoes;
  serie: PontoMensal[];
  rateio: PorPessoa;
  lotes: ResumoLotes;
}) {
  const melhor = serie.reduce((acc, p) => (p.valor > acc.valor ? p : acc), serie[0]);

  return (
    <main>
      <h1 className="mb-5 text-[1.375rem] font-bold tracking-tight md:text-2xl">Início</h1>

      <div className="mb-3 grid gap-3 md:grid-cols-[1.25fr_1fr_1fr]">
        <CartaoValor
          rotulo="Pronto para enviar ao financeiro"
          valor={resumo.disponivel}
          destaque
          detalhe={
            resumo.quantidadeComDisponivel === 0
              ? 'nenhuma OS tem comissão liberada no momento'
              : `espalhado em ${resumo.quantidadeComDisponivel} ${
                  resumo.quantidadeComDisponivel === 1 ? 'OS' : 'OS'
                } com pagamento de cliente já recebido`
          }
        >
          {resumo.disponivel > 0n && (
            <div className="mt-4">
              <BotaoLink href="/lotes/gerar">Gerar lote agora</BotaoLink>
            </div>
          )}
        </CartaoValor>

        <CartaoValor
          rotulo="Aguardando conferência"
          valor={lotes.aguardandoConferencia.total}
          detalhe={`${lotes.aguardandoConferencia.quantidade} ${
            lotes.aguardandoConferencia.quantidade === 1 ? 'lote enviado' : 'lotes enviados'
          }, ainda não aprovados`}
        />
        <CartaoValor
          rotulo="Aprovado pelo financeiro"
          valor={lotes.aprovado.total}
          detalhe={`${lotes.aprovado.quantidade} ${
            lotes.aprovado.quantidade === 1 ? 'lote conferido' : 'lotes conferidos'
          }`}
        />
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-[1.55fr_1fr]">
        <section className="rounded-xl border border-borda bg-superficie p-4">
          <h2 className="mb-3.5 text-sm font-semibold">Comissão gerada por mês</h2>
          <GraficoBarras
            pontos={serie.map((p) => ({ rotulo: p.rotulo, valor: p.valor }))}
            descricao="Comissão total das OS por mês de venda, nos últimos doze meses."
          />
          {melhor && melhor.valor > 0n && (
            <p className="mt-3 text-[12.5px] text-texto-2">
              Melhor mês do período: {melhor.rotulo} · <Moeda valor={melhor.valor} />
            </p>
          )}
        </section>

        <section className="rounded-xl border border-borda bg-superficie p-4">
          <h2 className="mb-3.5 text-sm font-semibold">Lotes na mesa do financeiro</h2>
          {lotes.pendentes.length === 0 ? (
            <p className="text-[13px] text-texto-2">
              Nada pendente de conferência no momento.
            </p>
          ) : (
            <ul>
              {lotes.pendentes.map((lote) => (
                <li
                  key={lote.id}
                  className="flex items-center justify-between gap-3 border-b border-borda py-2.5 last:border-b-0"
                >
                  <span>
                    <Link href={`/lotes/${lote.id}`} className="num text-[15px] font-bold underline">
                      Lote {lote.numero}
                    </Link>
                    <span
                      className={`block text-[12px] ${
                        lote.dias > DIAS_PARA_ALERTA ? 'font-semibold text-erro' : 'text-texto-2'
                      }`}
                    >
                      {lote.dias > DIAS_PARA_ALERTA
                        ? `parado há ${lote.dias} dias`
                        : `enviado há ${lote.dias} ${lote.dias === 1 ? 'dia' : 'dias'}`}
                    </span>
                  </span>
                  <Moeda valor={lote.valorTotal} className="font-bold" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mb-3 rounded-xl border border-borda bg-superficie p-4">
        <div className="mb-3 border-l-2 border-destaque pl-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-destaque">
            Visível só para você
          </p>
          <h2 className="mt-1 text-sm font-semibold">Como o disponível se divide hoje</h2>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { nome: 'Thiago', valor: rateio.thiago },
            { nome: 'Geice', valor: rateio.geice },
            { nome: 'Gabrielle', valor: rateio.gabrielle },
          ].map((pessoa) => (
            <div key={pessoa.nome} className="rounded-lg bg-superficie-2 px-3 py-2.5">
              <p className="text-[12px] text-texto-2">{pessoa.nome}</p>
              <Moeda valor={pessoa.valor} className="block text-[17px] font-bold" />
            </div>
          ))}
        </div>
      </section>

      {/* Espaço já desenhado para a próxima fase: quando os dados existirem, é só preencher. */}
      <section className="rounded-xl border border-dashed border-borda-forte p-4 opacity-75">
        <p className="mb-3 inline-block rounded-full border border-borda px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rotulo">
          Entra na próxima fase
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="rotulo">Efetivamente recebido do financeiro</p>
            <p className="num mt-1.5 text-[1.5rem] font-bold text-rotulo">— — —</p>
            <p className="text-[12px] text-texto-2">
              depende do registro de recebimento, que ainda não existe
            </p>
          </div>
          <div>
            <p className="rotulo">A pagar às vendedoras</p>
            <p className="num mt-1.5 text-[1.5rem] font-bold text-rotulo">— — —</p>
            <p className="text-[12px] text-texto-2">
              depende do recebimento e do registro de pagamento
            </p>
          </div>
        </div>
      </section>

      {resumo.disponivel === 0n && lotes.pendentes.length === 0 && (
        <div className="mt-3">
          <EstadoVazio
            titulo="Nada a enviar no momento"
            descricao="A comissão libera na proporção do que o cliente já pagou. Registre um pagamento para liberar comissão."
            acao={<BotaoLink href="/os" variante="secundario">Ver ordens de serviço</BotaoLink>}
          />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Passo 2: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.

- [ ] **Passo 3: Commit**

```bash
git add "src/app/(app)/PainelAdmin.tsx"
git commit -m "feat(painel): visão do admin com disponível, lotes pendentes e série mensal"
```

---

### Tarefa 19: Painel do financeiro e rota de início

**Files:**
- Create: `src/app/(app)/PainelFinanceiro.tsx`
- Modify: `src/app/(app)/page.tsx` (deixa de ser redirect)

**Interfaces:**
- Consumes: `componentesPorOs`, `resumoLotes`, `DIAS_PARA_ALERTA`; `resumirComissoes`, `serieMensal`, `ratearDisponivel`; `hojeNegocio`; `sessaoDaPagina`; `PainelAdmin`.
- Produces: `function PainelFinanceiro({ lotes })`.

**Contexto:** a página carrega dados **diferentes** por papel — e para o financeiro nem chama `componentesPorOs`, porque a pergunta dele é outra e porque assim nenhum dado de OS ou de rateio entra na resposta.

- [ ] **Passo 1: Criar `src/app/(app)/PainelFinanceiro.tsx`**

```tsx
import Link from 'next/link';
import { BotaoLink } from '@/componentes/Botao';
import { CartaoValor } from '@/componentes/CartaoValor';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Moeda } from '@/componentes/Moeda';
import { DIAS_PARA_ALERTA, type ResumoLotes } from '@/servidor/painel/consultas';

export function PainelFinanceiro({ lotes }: { lotes: ResumoLotes }) {
  const maisAntigo = lotes.pendentes.reduce<(typeof lotes.pendentes)[number] | null>(
    (acc, lote) => (acc === null || lote.dias > acc.dias ? lote : acc),
    null,
  );

  return (
    <main>
      <h1 className="mb-5 text-[1.375rem] font-bold tracking-tight md:text-2xl">Início</h1>

      <div className="mb-3 grid gap-3 md:grid-cols-[1.25fr_1fr_1fr]">
        <CartaoValor
          rotulo="Esperando sua conferência"
          valor={lotes.aguardandoConferencia.total}
          destaque
          detalhe={`${lotes.aguardandoConferencia.quantidade} ${
            lotes.aguardandoConferencia.quantidade === 1
              ? 'lote recebido e ainda não aprovado'
              : 'lotes recebidos e ainda não aprovados'
          }`}
        >
          {lotes.pendentes.length > 0 && (
            <div className="mt-4">
              <BotaoLink href="/lotes">Ver lotes pendentes</BotaoLink>
            </div>
          )}
        </CartaoValor>

        <CartaoValor
          rotulo="Já aprovado por você"
          valor={lotes.aprovado.total}
          detalhe={`${lotes.aprovado.quantidade} ${
            lotes.aprovado.quantidade === 1 ? 'lote' : 'lotes'
          }`}
        />

        <div className="rounded-xl border border-borda bg-superficie p-4">
          <p className="rotulo">Lote mais antigo na fila</p>
          {maisAntigo ? (
            <>
              <p
                className={`num mt-2 text-[1.5rem] font-bold leading-none ${
                  maisAntigo.dias > DIAS_PARA_ALERTA ? 'text-erro' : ''
                }`}
              >
                {maisAntigo.dias} {maisAntigo.dias === 1 ? 'dia' : 'dias'}
              </p>
              <p className="mt-1.5 text-[12.5px] text-texto-2">
                Lote {maisAntigo.numero} · <Moeda valor={maisAntigo.valorTotal} />
              </p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-texto-2">Nenhum lote na fila.</p>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-borda bg-superficie p-4">
        <h2 className="mb-3.5 text-sm font-semibold">Lotes a conferir</h2>
        {lotes.pendentes.length === 0 ? (
          <EstadoVazio
            titulo="Nada pendente"
            descricao="Quando um lote novo for enviado, ele aparece aqui para conferência."
          />
        ) : (
          <ul>
            {lotes.pendentes.map((lote) => (
              <li
                key={lote.id}
                className="flex items-center justify-between gap-3 border-b border-borda py-2.5 last:border-b-0"
              >
                <span>
                  <Link href={`/lotes/${lote.id}`} className="num text-[15px] font-bold underline">
                    Lote {lote.numero}
                  </Link>
                  <span
                    className={`block text-[12px] ${
                      lote.dias > DIAS_PARA_ALERTA ? 'font-semibold text-erro' : 'text-texto-2'
                    }`}
                  >
                    {lote.dias > DIAS_PARA_ALERTA
                      ? `parado há ${lote.dias} dias`
                      : `recebido há ${lote.dias} ${lote.dias === 1 ? 'dia' : 'dias'}`}
                  </span>
                </span>
                <Moeda valor={lote.valorTotal} className="font-bold" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Passo 2: Substituir `src/app/(app)/page.tsx` inteiro**

```tsx
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
```

- [ ] **Passo 3: Verificar**

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso, e a rota `/` aparece como `ƒ` (dinâmica), não mais como redirecionamento.

- [ ] **Passo 4: Commit**

```bash
git add "src/app/(app)/PainelFinanceiro.tsx" "src/app/(app)/page.tsx"
git commit -m "feat(painel): visão do financeiro e rota de início por papel"
```

---

### Tarefa 20: Verificação final

**Files:** nenhum arquivo novo; esta tarefa valida o conjunto.

**Contexto:** o redesenho não tocou `src/dominio` nem `src/servidor` além do previsto, então a suíte existente é a principal rede de segurança. A verificação visual é dirigida por navegador e **não grava nada no banco** — cria dois usuários temporários no Auth e os apaga ao final.

- [ ] **Passo 1: Suíte completa e build**

Run: `npm test`
Expected: todos os arquivos passam — os 90 anteriores mais os novos de `tests/dominio/painel.test.ts` e `tests/integracao/painel.test.ts`.

Run: `npx tsc --noEmit` → sem erro.
Run: `npx next lint --dir src` → limpo.
Run: `npm run build` → sucesso.

- [ ] **Passo 2: Confirmar que o escopo foi respeitado**

Run: `git diff --stat master -- src/dominio src/servidor`
Expected: apenas três arquivos — `src/dominio/painel.ts` (novo), `src/servidor/painel/consultas.ts` (novo) e `src/servidor/lotes/consultas.ts` (os três campos da Tarefa 15). Qualquer outro arquivo nessa lista é sinal de que o trabalho saiu do escopo.

- [ ] **Passo 3: Confirmar que o financeiro não recebe rateio**

Run: `npm run build && npx next start -p 3123` (em segundo plano)

Criar dois usuários temporários com papéis diferentes, entrar como financeiro e verificar, no HTML servido (não só na tela):

```bash
curl -s "http://localhost:3123/lotes/<id>/imprimir" | grep -ci "thiago\|geice\|gabrielle"
```
Expected: `0` no relatório de impressão, mesmo logado como admin.

Repetir a inspeção no painel (`/`) e no detalhe do lote logado como financeiro: nenhum nome de pessoa, nenhum percentual de rateio.

- [ ] **Passo 4: Verificação visual dirigida**

Percorrer, nos dois papéis, nas larguras de celular (≈390 px) e de computador, e nos dois temas:

`/login` · `/` · `/os` · `/os/nova` · `/os/[id]` · `/os/[id]/baixas/nova` · `/lotes` · `/lotes/gerar` · `/lotes/[id]` · `/lotes/[id]/imprimir` · `/configuracao` · `/sem-permissao`

Conferir em cada uma:

- nenhuma rolagem lateral no celular;
- o ciano aparece em no máximo um lugar por bloco;
- foco visível ao navegar por teclado;
- nenhum texto em Arial (inspecionar `font-family` computado do `body`);
- sem flash branco ao recarregar com tema escuro ativo.

- [ ] **Passo 5: Conferir a impressão**

Com o sistema no tema **escuro**, abrir `/lotes/[id]/imprimir` e gerar o PDF. Conferir: papel branco, sem ciano, sem fundo cinza, cabeçalho e total legíveis, e as seis colunas cabendo em A4 retrato.

- [ ] **Passo 6: Limpar e commitar**

Remover os usuários temporários do Auth e parar o servidor. Nenhum dado financeiro deve ter sido criado.

```bash
git add -A
git commit -m "chore: verificação final do redesenho visual e do painel"
```

---

## Auto-revisão do plano

**Cobertura da spec:**

- §3.1 paleta → Tarefa 1 (valores exatos, ambos os temas).
- §3.2 tipografia → Tarefa 1 (fontes, escala, correção do Arial).
- §3.3 tema → Tarefa 2 (três estados, anti-flash).
- §4 componentes → Tarefas 3 a 6. **Desvio registrado:** a spec listava `Tabela`/`ListaCartoes` como componentes; o plano entrega `CartaoLista` mais a classe `.tabela`, porque uma tabela genérica com definição de colunas custaria mais do que economiza em quatro usos.
- §5 telas → Tarefas 8 a 14 (todas as rotas listadas na spec).
- §6 painel → Tarefas 16 a 19, incluindo o bloco rotulado da próxima fase e o alerta de 15 dias.
- §6.1 onde a soma acontece → Tarefa 16, com a suposição de contiguidade das reservas registrada em comentário no código.
- §7 impressão → Tarefa 15 (seis colunas, uma só totaliza, traço para "não se aplica", regras de `@media print` na Tarefa 1).
- §8 impacto no repositório → Tarefa 20, Passo 2, que verifica o escopo mecanicamente.
- §9 verificação → Tarefa 20.

**Correção aplicada durante a revisão:** a spec afirmava, em §8, que a única adição fora de `src/app`/`src/componentes` seria `src/servidor/painel/consultas.ts`. Isso estava errado: o relatório de impressão precisa de três campos de snapshot que `obterLotePorId` não projeta hoje, então `src/servidor/lotes/consultas.ts` também muda (Tarefa 15). As Global Constraints deste plano refletem a exceção, e a spec foi corrigida no mesmo commit.

**Consistência de tipos:** `Centavos`/`Percentual`/`PorPessoa` vêm sempre de `@/dominio`; `TomSelo` é definido na Tarefa 3 e consumido nas Tarefas 5, 9, 13 e 14; `ComponentesOs` é definido na Tarefa 16 e produzido pela consulta da Tarefa 17; `ResumoLotes` e `DIAS_PARA_ALERTA` vêm da Tarefa 17 e são consumidos nas Tarefas 18 e 19; `Executor` já existe em `src/servidor/db.ts` desde a Fase 1.

**Ordem de execução:** as Tarefas 1 a 7 precisam vir antes de qualquer tela. As Tarefas 8 a 15 são independentes entre si e podem ser feitas em qualquer ordem. A Tarefa 16 precede a 17, que precede as 18 e 19. A Tarefa 20 é a última.
