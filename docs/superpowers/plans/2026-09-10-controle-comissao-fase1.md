# Controle de Comissão — Fase 1 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o núcleo do sistema: domínio decimal/rateio/intervalos testado, banco com tabelas privadas e privilégios, autenticação por papel, cadastro de OS e configuração, baixas de cliente (recebimento) e lotes para o financeiro com snapshots, reservas, conferência e impressão.

**Architecture:** Next.js (App Router) com toda a lógica financeira em funções puras de domínio (`src/dominio`) operando em centavos `bigint`, chamadas por serviços de servidor (`src/servidor`) que executam cada mutação numa transação Postgres com bloqueio global (`controle_financeiro`), via conexão dedicada `app_writer`. Supabase Auth só fornece sessão e papel (`app_metadata.role`); nenhum cliente acessa tabelas diretamente. Dados de rateio vivem no schema `interno`, nunca projetados para o papel `financeiro`.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind), `postgres` (postgres.js) contra o Postgres do Supabase na nuvem, `@supabase/ssr` + `@supabase/supabase-js` (só para Auth), `zod`, Vitest + `fast-check`. Sem Docker/CLI local — migrações são `.sql` aplicados manualmente no SQL Editor do Supabase.

**Spec:** `docs/superpowers/specs/2026-09-10-controle-comissao-design.md` (v2.0). Este plano cobre §19 etapas 1–4. Fases seguintes (recebimentos, pagamentos a vendedoras, estornos/ajustes/devoluções, painéis/CSV/comprovantes) terão planos próprios.

## Global Constraints

- Idioma da interface, mensagens e identificadores de domínio: português do Brasil. Moeda BRL com duas casas.
- Dinheiro: `numeric(12,2)` no banco; `bigint` em centavos no código. Percentuais: `numeric(5,2)` no banco; `bigint` em centésimos de ponto percentual no código (7,00% = `700n`). **Nunca** converter dinheiro para `Number` em cálculo.
- Arredondamento de totais: half-up. Rateio: algoritmo `divisores_v1` (§7), nunca half-up independente por pessoa.
- Toda mutação financeira: uma transação, iniciada com `select ... for update` na linha `controle_financeiro.id = 1`, sem PDF/rede/espera humana dentro dela.
- Papel em `app_metadata.role` (`admin` | `financeiro`). Autorização no servidor em toda leitura e mutação. Rateio (padrões, `os_rateio`, `lote_item_rateio`) só para `admin`, inclusive em HTML, JSON, erros e auditoria.
- Fuso do negócio: `America/Sao_Paulo`. Datas comerciais `date`; instantes `timestamptz`.
- Dependências com versão exata (`npm install --save-exact`) e `package-lock.json` versionado. Migrações em `supabase/migrations`.
- Sem `NEXT_PUBLIC_*` para segredos. `DATABASE_URL` (app_writer) e `SUPABASE_SERVICE_ROLE_KEY` só no servidor/scripts.
- Dados fictícios em dev/teste. Commits pequenos após cada tarefa.

## Pré-requisitos de máquina

- Node 24 e npm 11 (já presentes).
- Projeto Supabase já criado na nuvem (ref `bywkomyyjrvgpuvnnmlr`). **Sem Docker/CLI local**: as migrações são arquivos `.sql` em `supabase/migrations/`, aplicados manualmente pelo usuário colando o conteúdo, em ordem, no SQL Editor do painel do Supabase (`https://supabase.com/dashboard/project/bywkomyyjrvgpuvnnmlr/sql/new`). O agente que executar este plano **não tem acesso ao painel** — ao final de cada tarefa que cria uma migração, pare e peça ao usuário para colar o SQL e confirmar antes de seguir para a tarefa seguinte que depende dela.
- `.env.local` (não versionado) já contém `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. Falta preencher `DATABASE_URL` e `DATABASE_URL_ADMIN`: o usuário pega a "Connection string" (modo *Session pooler*, porta 5432) em Project Settings → Database → Connection string, no painel do Supabase, substitui `postgres` pelo usuário indicado em cada tarefa (`app_writer` ou `postgres`) e cola a senha correspondente. A Tarefa 8 (privilégios) cria o usuário `app_writer` e informa a senha a ser usada.
- Testes de integração (Tarefa 8 em diante) rodam contra esse mesmo banco de nuvem, já que não há banco local. Cada teste cria seus próprios registros com prefixo `TESTE-` no número da OS e remove tudo ao final (`afterEach`), para não deixar lixo misturado a dados reais.

## Estrutura de arquivos

```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs, vitest.config.ts, .env.example, .gitignore, README.md
supabase/migrations/20260910000100_base.sql          — schemas, tabelas, índices (já criado e aplicado)
supabase/migrations/20260910000200_privilegios.sql   — role app_writer, grants, RLS, revogações (já criado e aplicado)
scripts/criar-usuarios.ts                            — cria os dois usuários via Admin API
src/dominio/erros.ts        — ErroValidacao, ErroPermissao, ErroConcorrencia, ErroReserva
src/dominio/dinheiro.ts     — Centavos/Percentual, parse/format, dividirHalfUp
src/dominio/datas.ts        — hojeNegocio(), validação de data
src/dominio/comissao.ts     — comissaoTotal, comissaoLiberada, statusRecebimento, totalPagoCliente
src/dominio/intervalos.ts   — Intervalo [a,b), normalizar, subtrair, intervalosLivres
src/dominio/rateio.ts       — acumulado (referência e otimizado), ratearIntervalo, validarPesos
src/dominio/lote.ts         — calcularItensLote (puro)
src/dominio/json.ts         — serialização JSON com bigint
src/servidor/db.ts          — cliente postgres.js, comTransacaoFinanceira
src/servidor/auditoria.ts   — registrarAuditoria
src/servidor/idempotencia.ts— executarIdempotente
src/servidor/auth.ts        — sessaoAtual, exigirSessao, exigirPapel
src/servidor/formularios.ts — EstadoFormulario, tratarErro
src/servidor/supabase/servidor.ts, navegador.ts, middleware.ts
src/servidor/configuracao/servico.ts, acoes.ts
src/servidor/os/servico.ts, consultas.ts, acoes.ts
src/servidor/baixas/servico.ts, acoes.ts
src/servidor/lotes/servico.ts, consultas.ts, acoes.ts
src/middleware.ts
src/app/login/page.tsx, src/app/login/FormularioLogin.tsx
src/app/(app)/layout.tsx, page.tsx
src/app/(app)/os/page.tsx, nova/page.tsx, [id]/page.tsx, [id]/editar/page.tsx, [id]/baixas/nova/page.tsx
src/app/(app)/os/FormularioOs.tsx, [id]/baixas/nova/FormularioBaixa.tsx
src/app/(app)/configuracao/page.tsx, FormularioConfiguracao.tsx
src/app/(app)/lotes/page.tsx, gerar/page.tsx, gerar/FormularioGerarLote.tsx, [id]/page.tsx, [id]/AcoesLote.tsx, [id]/imprimir/page.tsx
src/componentes/Campo.tsx, Moeda.tsx
tests/dominio/*.test.ts
tests/integracao/ajuda.ts, *.test.ts
```

---

### Tarefa 1: Scaffold do projeto e ferramentas de teste

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`, `src/dominio/erros.ts`, `tests/dominio/erros.test.ts`

**Interfaces:**
- Produces: classes `ErroValidacao(mensagem, campo?)`, `ErroPermissao`, `ErroConcorrencia`, `ErroReserva` em `src/dominio/erros.ts`; scripts npm `test:dominio`, `test:integracao`, `build`.

- [ ] **Passo 1: Criar o app Next.js na pasta atual**

```bash
npx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```
Se perguntar sobre React Compiler, responder não. A pasta já contém `docs/` e `.git/`, o que o create-next-app aceita.

- [ ] **Passo 2: Instalar dependências com versão exata**

```bash
npm install --save-exact postgres@3.4.5 @supabase/supabase-js@2.49.4 @supabase/ssr@0.6.1 zod@3.24.2
npm install --save-exact --save-dev vitest@3.1.1 fast-check@3.23.2 tsx@4.19.3 dotenv@16.4.7
```

- [ ] **Passo 3: Configurar Vitest**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
```

`tests/setup.ts`:
```ts
import { config } from 'dotenv';
config({ path: '.env.local' });
```

Em `package.json`, adicionar aos `scripts`:
```json
"test": "vitest run",
"test:dominio": "vitest run tests/dominio",
"test:integracao": "vitest run tests/integracao",
"usuarios:criar": "tsx scripts/criar-usuarios.ts"
```

`.env.example` (só placeholders; `.env.local` com os valores reais do projeto Supabase na nuvem já existe e não é commitado):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```
Garantir que `.gitignore` contém `.env`, `.env.local` e `.env.*.local` (já criado nesta sessão, junto com `.env.local` preenchido e as migrações em `supabase/migrations/`, aplicadas manualmente pelo usuário no SQL Editor do Supabase — ver seção "Pré-requisitos de máquina").

- [ ] **Passo 4: Escrever o teste dos erros de domínio**

`tests/dominio/erros.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ErroValidacao, ErroPermissao, ErroConcorrencia, ErroReserva } from '@/dominio/erros';

describe('erros de domínio', () => {
  it('ErroValidacao guarda mensagem e campo', () => {
    const e = new ErroValidacao('Valor inválido', 'valor');
    expect(e.message).toBe('Valor inválido');
    expect(e.campo).toBe('valor');
    expect(e).toBeInstanceOf(Error);
  });
  it('demais erros são instâncias de Error com nome próprio', () => {
    expect(new ErroPermissao().name).toBe('ErroPermissao');
    expect(new ErroConcorrencia().name).toBe('ErroConcorrencia');
    expect(new ErroReserva('x').name).toBe('ErroReserva');
  });
});
```

- [ ] **Passo 5: Rodar e ver falhar**

Run: `npm run test:dominio`
Expected: FAIL — módulo `@/dominio/erros` não encontrado.

- [ ] **Passo 6: Implementar os erros**

`src/dominio/erros.ts`:
```ts
export class ErroValidacao extends Error {
  readonly campo: string | null;
  constructor(mensagem: string, campo?: string) {
    super(mensagem);
    this.name = 'ErroValidacao';
    this.campo = campo ?? null;
  }
}

export class ErroPermissao extends Error {
  constructor(mensagem = 'Acesso não autorizado') {
    super(mensagem);
    this.name = 'ErroPermissao';
  }
}

export class ErroConcorrencia extends Error {
  constructor(mensagem = 'O registro foi alterado por outro usuário. Recarregue e tente novamente.') {
    super(mensagem);
    this.name = 'ErroConcorrencia';
  }
}

export class ErroReserva extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroReserva';
  }
}
```

- [ ] **Passo 7: Rodar testes e build**

Run: `npm run test:dominio` → PASS. Run: `npm run build` → sucesso.

- [ ] **Passo 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js, Vitest e erros de domínio"
```

---

### Tarefa 2: Dinheiro e percentuais em bigint

**Files:**
- Create: `src/dominio/dinheiro.ts`, `tests/dominio/dinheiro.test.ts`

**Interfaces:**
- Produces:
  - `type Centavos = bigint`, `type Percentual = bigint`
  - `parseDecimal(texto: string): Centavos` — aceita `"1234.56"` (banco) e `"1.234,56"` (usuário); lança `ErroValidacao`.
  - `paraDecimalDb(c: Centavos): string` → `"1234.56"`
  - `formatarBRL(c: Centavos): string` → `"R$ 1.234,56"`
  - `parsePercentual(texto: string): Percentual` (0..10000), `paraPercentualDb(p): string`, `formatarPercentual(p): string` → `"7,00%"`
  - `dividirHalfUp(numerador: bigint, denominador: bigint): bigint`

- [ ] **Passo 1: Teste**

`tests/dominio/dinheiro.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  parseDecimal, paraDecimalDb, formatarBRL, parsePercentual,
  paraPercentualDb, formatarPercentual, dividirHalfUp,
} from '@/dominio/dinheiro';
import { ErroValidacao } from '@/dominio/erros';

describe('parseDecimal', () => {
  it('lê formato do banco', () => expect(parseDecimal('1234.56')).toBe(123456n));
  it('lê formato brasileiro', () => expect(parseDecimal('1.234,56')).toBe(123456n));
  it('lê inteiro e uma casa', () => {
    expect(parseDecimal('10')).toBe(1000n);
    expect(parseDecimal('10,5')).toBe(1050n);
  });
  it('rejeita três casas e lixo', () => {
    expect(() => parseDecimal('1,234')).toThrow(ErroValidacao);
    expect(() => parseDecimal('abc')).toThrow(ErroValidacao);
    expect(() => parseDecimal('')).toThrow(ErroValidacao);
  });
});

describe('formatação', () => {
  it('paraDecimalDb', () => {
    expect(paraDecimalDb(123456n)).toBe('1234.56');
    expect(paraDecimalDb(5n)).toBe('0.05');
    expect(paraDecimalDb(-5n)).toBe('-0.05');
  });
  it('formatarBRL', () => {
    expect(formatarBRL(123456789n)).toBe('R$ 1.234.567,89');
    expect(formatarBRL(0n)).toBe('R$ 0,00');
    expect(formatarBRL(-150n)).toBe('-R$ 1,50');
  });
});

describe('percentual', () => {
  it('parse e format', () => {
    expect(parsePercentual('7')).toBe(700n);
    expect(parsePercentual('7,00')).toBe(700n);
    expect(parsePercentual('0.5')).toBe(50n);
    expect(paraPercentualDb(700n)).toBe('7.00');
    expect(formatarPercentual(700n)).toBe('7,00%');
  });
  it('rejeita fora de 0..100', () => {
    expect(() => parsePercentual('100,01')).toThrow(ErroValidacao);
    expect(() => parsePercentual('-1')).toThrow(ErroValidacao);
  });
});

describe('dividirHalfUp', () => {
  it('arredonda meio para cima', () => {
    expect(dividirHalfUp(5n, 2n)).toBe(3n);
    expect(dividirHalfUp(4n, 2n)).toBe(2n);
    expect(dividirHalfUp(1n, 3n)).toBe(0n);
    expect(dividirHalfUp(2n, 3n)).toBe(1n);
    expect(dividirHalfUp(0n, 7n)).toBe(0n);
  });
  it('rejeita denominador não positivo e numerador negativo', () => {
    expect(() => dividirHalfUp(1n, 0n)).toThrow();
    expect(() => dividirHalfUp(-1n, 2n)).toThrow();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:dominio` → FAIL (módulo inexistente).

- [ ] **Passo 3: Implementar**

`src/dominio/dinheiro.ts`:
```ts
import { ErroValidacao } from './erros';

export type Centavos = bigint;
export type Percentual = bigint; // centésimos de ponto percentual: 7,00% => 700n

const RE_DECIMAL = /^-?\d+(\.\d{1,2})?$/;

function normalizarTexto(texto: string): string {
  const t = texto.trim();
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
}

function parseDuasCasas(texto: string, rotulo: string): bigint {
  const n = normalizarTexto(texto);
  if (!RE_DECIMAL.test(n)) throw new ErroValidacao(`${rotulo} inválido: "${texto}"`);
  const negativo = n.startsWith('-');
  const [inteiro, fracao = ''] = n.replace('-', '').split('.');
  const valor = BigInt(inteiro) * 100n + BigInt(fracao.padEnd(2, '0'));
  return negativo ? -valor : valor;
}

export function parseDecimal(texto: string): Centavos {
  return parseDuasCasas(texto, 'Valor');
}

export function paraDecimalDb(c: bigint): string {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  return `${neg ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

export function formatarBRL(c: Centavos): string {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  const inteiro = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}R$ ${inteiro},${(abs % 100n).toString().padStart(2, '0')}`;
}

export function parsePercentual(texto: string): Percentual {
  const p = parseDuasCasas(texto, 'Percentual');
  if (p < 0n || p > 10000n) throw new ErroValidacao('Percentual deve estar entre 0 e 100');
  return p;
}

export function paraPercentualDb(p: Percentual): string {
  return paraDecimalDb(p);
}

export function formatarPercentual(p: Percentual): string {
  return `${p / 100n},${(p % 100n).toString().padStart(2, '0')}%`;
}

export function dividirHalfUp(numerador: bigint, denominador: bigint): bigint {
  if (denominador <= 0n) throw new Error('Denominador deve ser positivo');
  if (numerador < 0n) throw new Error('Numerador não pode ser negativo');
  return (numerador * 2n + denominador) / (denominador * 2n);
}
```

- [ ] **Passo 4: Rodar** — `npm run test:dominio` → PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/dominio/dinheiro.ts tests/dominio/dinheiro.test.ts
git commit -m "feat(dominio): dinheiro e percentuais em centavos bigint"
```

---

### Tarefa 3: Cálculo de comissão e datas do negócio

**Files:**
- Create: `src/dominio/comissao.ts`, `src/dominio/datas.ts`, `tests/dominio/comissao.test.ts`, `tests/dominio/datas.test.ts`

**Interfaces:**
- Produces:
  - `comissaoTotal(valorOs: Centavos, percentual: Percentual): Centavos`
  - `comissaoLiberada(comissaoTotal: Centavos, totalPago: Centavos, valorOs: Centavos): Centavos`
  - `type StatusRecebimento = 'aberta' | 'parcial' | 'quitada'`; `statusRecebimento(totalPago, valorOs)`
  - `totalPagoCliente(baixas: { tipo: 'recebimento' | 'estorno'; valor: Centavos }[]): Centavos`
  - `hojeNegocio(agora?: Date): string` (YYYY-MM-DD em America/Sao_Paulo); `validarDataIso(texto, campo): string`; `dataNaoFutura(texto, campo): string`

- [ ] **Passo 1: Testes**

`tests/dominio/comissao.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { comissaoTotal, comissaoLiberada, statusRecebimento, totalPagoCliente } from '@/dominio/comissao';

describe('comissaoTotal', () => {
  it('7% de R$ 10.000,00 = R$ 700,00', () => expect(comissaoTotal(1_000_000n, 700n)).toBe(70_000n));
  it('arredonda half-up: 7% de R$ 0,07 = R$ 0,0049 -> R$ 0,00; 7% de R$ 0,08 = 0,0056 -> R$ 0,01', () => {
    expect(comissaoTotal(7n, 700n)).toBe(0n);
    expect(comissaoTotal(8n, 700n)).toBe(1n);
  });
  it('percentual zero', () => expect(comissaoTotal(1_000_000n, 0n)).toBe(0n));
});

describe('comissaoLiberada', () => {
  it('proporcional ao pago', () => expect(comissaoLiberada(70_000n, 500_000n, 1_000_000n)).toBe(35_000n));
  it('quitação devolve exatamente a total mesmo com arredondamento', () => {
    expect(comissaoLiberada(1n, 8n, 8n)).toBe(1n);
  });
  it('nada pago = zero', () => expect(comissaoLiberada(70_000n, 0n, 1_000_000n)).toBe(0n));
  it('half-up no meio centavo: total 1 centavo, pago 50% -> 1', () => {
    expect(comissaoLiberada(1n, 1n, 2n)).toBe(1n);
  });
});

describe('statusRecebimento', () => {
  it('aberta / parcial / quitada', () => {
    expect(statusRecebimento(0n, 100n)).toBe('aberta');
    expect(statusRecebimento(1n, 100n)).toBe('parcial');
    expect(statusRecebimento(100n, 100n)).toBe('quitada');
  });
});

describe('totalPagoCliente', () => {
  it('soma recebimentos e subtrai estornos', () => {
    expect(totalPagoCliente([
      { tipo: 'recebimento', valor: 100n },
      { tipo: 'recebimento', valor: 50n },
      { tipo: 'estorno', valor: 30n },
    ])).toBe(120n);
  });
});
```

`tests/dominio/datas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hojeNegocio, validarDataIso, dataNaoFutura } from '@/dominio/datas';
import { ErroValidacao } from '@/dominio/erros';

describe('datas do negócio', () => {
  it('hojeNegocio usa America/Sao_Paulo (UTC-3): 2026-03-01T01:00Z ainda é 28/02', () => {
    expect(hojeNegocio(new Date('2026-03-01T01:00:00Z'))).toBe('2026-02-28');
  });
  it('validarDataIso aceita YYYY-MM-DD válido e rejeita inválido', () => {
    expect(validarDataIso('2026-09-10', 'data')).toBe('2026-09-10');
    expect(() => validarDataIso('2026-13-01', 'data')).toThrow(ErroValidacao);
    expect(() => validarDataIso('10/09/2026', 'data')).toThrow(ErroValidacao);
  });
  it('dataNaoFutura rejeita amanhã', () => {
    const hoje = hojeNegocio();
    expect(dataNaoFutura(hoje, 'data')).toBe(hoje);
    const amanha = new Date(`${hoje}T12:00:00Z`); amanha.setUTCDate(amanha.getUTCDate() + 1);
    expect(() => dataNaoFutura(amanha.toISOString().slice(0, 10), 'data')).toThrow(ErroValidacao);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:dominio` → FAIL.

- [ ] **Passo 3: Implementar**

`src/dominio/comissao.ts`:
```ts
import { type Centavos, type Percentual, dividirHalfUp } from './dinheiro';

export type StatusRecebimento = 'aberta' | 'parcial' | 'quitada';

export function comissaoTotal(valorOs: Centavos, percentual: Percentual): Centavos {
  return dividirHalfUp(valorOs * percentual, 10000n);
}

export function comissaoLiberada(comissaoTotalOs: Centavos, totalPago: Centavos, valorOs: Centavos): Centavos {
  if (totalPago <= 0n) return 0n;
  if (totalPago >= valorOs) return comissaoTotalOs;
  return dividirHalfUp(comissaoTotalOs * totalPago, valorOs);
}

export function statusRecebimento(totalPago: Centavos, valorOs: Centavos): StatusRecebimento {
  if (totalPago <= 0n) return 'aberta';
  if (totalPago >= valorOs) return 'quitada';
  return 'parcial';
}

export function totalPagoCliente(baixas: { tipo: 'recebimento' | 'estorno'; valor: Centavos }[]): Centavos {
  return baixas.reduce((acc, b) => (b.tipo === 'recebimento' ? acc + b.valor : acc - b.valor), 0n);
}
```

`src/dominio/datas.ts`:
```ts
import { ErroValidacao } from './erros';

export const FUSO_NEGOCIO = 'America/Sao_Paulo';
const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function hojeNegocio(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_NEGOCIO, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora);
}

export function validarDataIso(texto: string, campo: string): string {
  if (!RE_ISO.test(texto)) throw new ErroValidacao('Data inválida', campo);
  const d = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto) {
    throw new ErroValidacao('Data inválida', campo);
  }
  return texto;
}

export function dataNaoFutura(texto: string, campo: string): string {
  const data = validarDataIso(texto, campo);
  if (data > hojeNegocio()) throw new ErroValidacao('A data não pode ser futura', campo);
  return data;
}

export function formatarDataBr(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
```

- [ ] **Passo 4: Rodar** — `npm run test:dominio` → PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/dominio/comissao.ts src/dominio/datas.ts tests/dominio/comissao.test.ts tests/dominio/datas.test.ts
git commit -m "feat(dominio): cálculo de comissão e datas do negócio"
```

---

### Tarefa 4: Intervalos de centavos

**Files:**
- Create: `src/dominio/intervalos.ts`, `tests/dominio/intervalos.test.ts`

**Interfaces:**
- Produces:
  - `interface Intervalo { inicio: bigint; fim: bigint }` — semiaberto `[inicio, fim)`
  - `tamanho(i)`, `somaTamanhos(lista)`
  - `normalizar(lista): Intervalo[]` — ordena, valida, lança `ErroReserva` se sobrepostos, funde adjacentes
  - `subtrair(universo: Intervalo, reservados: Intervalo[]): Intervalo[]`
  - `intervalosLivres(liberado: Centavos, reservados: Intervalo[]): Intervalo[]` — lança `ErroReserva` se alguma reserva ultrapassa `liberado`

- [ ] **Passo 1: Teste**

`tests/dominio/intervalos.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizar, subtrair, intervalosLivres, somaTamanhos, type Intervalo } from '@/dominio/intervalos';
import { ErroReserva } from '@/dominio/erros';

const iv = (a: number, b: number): Intervalo => ({ inicio: BigInt(a), fim: BigInt(b) });

describe('normalizar', () => {
  it('ordena e funde adjacentes', () => {
    expect(normalizar([iv(50, 70), iv(0, 50)])).toEqual([iv(0, 70)]);
  });
  it('mantém separados os não adjacentes', () => {
    expect(normalizar([iv(60, 70), iv(0, 50)])).toEqual([iv(0, 50), iv(60, 70)]);
  });
  it('rejeita sobreposição e intervalos vazios/negativos', () => {
    expect(() => normalizar([iv(0, 50), iv(49, 60)])).toThrow(ErroReserva);
    expect(() => normalizar([iv(5, 5)])).toThrow(ErroReserva);
    expect(() => normalizar([iv(-1, 5)])).toThrow(ErroReserva);
  });
});

describe('subtrair', () => {
  it('sem reservas devolve o universo', () => expect(subtrair(iv(0, 100), [])).toEqual([iv(0, 100)]));
  it('reserva no meio gera dois livres', () => {
    expect(subtrair(iv(0, 100), [iv(30, 60)])).toEqual([iv(0, 30), iv(60, 100)]);
  });
  it('reserva cobrindo tudo devolve vazio', () => expect(subtrair(iv(0, 100), [iv(0, 100)])).toEqual([]));
  it('reservas fora do universo são ignoradas', () => {
    expect(subtrair(iv(0, 100), [iv(100, 150)])).toEqual([iv(0, 100)]);
  });
});

describe('intervalosLivres', () => {
  it('exemplo do spec: 7000 liberados, [0,3500) reservado -> [3500,7000)', () => {
    expect(intervalosLivres(7000n, [iv(0, 3500)])).toEqual([iv(3500, 7000)]);
  });
  it('liberado zero -> nada', () => expect(intervalosLivres(0n, [])).toEqual([]));
  it('reserva além do liberado é erro de reserva', () => {
    expect(() => intervalosLivres(3000n, [iv(0, 3500)])).toThrow(ErroReserva);
  });
  it('propriedade: livres + reservados = liberado, sem sobreposição', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5000 }),
      fc.array(fc.tuple(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 1, max: 200 })), { maxLength: 10 }),
      (liberado, pares) => {
        // constrói reservas disjuntas dentro de [0, liberado)
        const reservas: Intervalo[] = [];
        let cursor = 0;
        for (const [salto, tam] of pares.sort((a, b) => a[0] - b[0])) {
          const inicio = Math.max(cursor, salto);
          const fim = Math.min(inicio + tam, liberado);
          if (fim > inicio) { reservas.push(iv(inicio, fim)); cursor = fim; }
        }
        const livres = intervalosLivres(BigInt(liberado), reservas);
        expect(somaTamanhos(livres) + somaTamanhos(reservas)).toBe(BigInt(liberado));
        expect(() => normalizar([...livres, ...reservas])).not.toThrow();
      },
    ));
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:dominio` → FAIL.

- [ ] **Passo 3: Implementar**

`src/dominio/intervalos.ts`:
```ts
import { ErroReserva } from './erros';
import type { Centavos } from './dinheiro';

export interface Intervalo { inicio: bigint; fim: bigint }

export function tamanho(i: Intervalo): bigint {
  return i.fim - i.inicio;
}

export function somaTamanhos(lista: Intervalo[]): bigint {
  return lista.reduce((acc, i) => acc + tamanho(i), 0n);
}

export function normalizar(lista: Intervalo[]): Intervalo[] {
  for (const i of lista) {
    if (i.inicio < 0n || i.fim <= i.inicio) {
      throw new ErroReserva(`Intervalo inválido [${i.inicio}, ${i.fim})`);
    }
  }
  const ordenados = [...lista].sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
  const resultado: Intervalo[] = [];
  for (const i of ordenados) {
    const ultimo = resultado[resultado.length - 1];
    if (ultimo && i.inicio < ultimo.fim) {
      throw new ErroReserva(`Intervalos sobrepostos: [${ultimo.inicio}, ${ultimo.fim}) e [${i.inicio}, ${i.fim})`);
    }
    if (ultimo && i.inicio === ultimo.fim) {
      resultado[resultado.length - 1] = { inicio: ultimo.inicio, fim: i.fim };
    } else {
      resultado.push({ ...i });
    }
  }
  return resultado;
}

export function subtrair(universo: Intervalo, reservados: Intervalo[]): Intervalo[] {
  const livres: Intervalo[] = [];
  let cursor = universo.inicio;
  for (const r of normalizar(reservados)) {
    if (r.fim <= cursor) continue;
    if (r.inicio >= universo.fim) break;
    if (r.inicio > cursor) livres.push({ inicio: cursor, fim: r.inicio });
    cursor = r.fim > cursor ? r.fim : cursor;
  }
  if (cursor < universo.fim) livres.push({ inicio: cursor, fim: universo.fim });
  return livres;
}

export function intervalosLivres(liberado: Centavos, reservados: Intervalo[]): Intervalo[] {
  const reservas = normalizar(reservados);
  const ultima = reservas[reservas.length - 1];
  if (ultima && ultima.fim > liberado) {
    throw new ErroReserva(`Reserva até ${ultima.fim} ultrapassa a comissão liberada ${liberado}`);
  }
  if (liberado <= 0n) return [];
  return subtrair({ inicio: 0n, fim: liberado }, reservas);
}
```

- [ ] **Passo 4: Rodar** — `npm run test:dominio` → PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/dominio/intervalos.ts tests/dominio/intervalos.test.ts
git commit -m "feat(dominio): intervalos de centavos com subtração de reservas"
```

---

### Tarefa 5: Rateio determinístico `divisores_v1`

**Files:**
- Create: `src/dominio/rateio.ts`, `tests/dominio/rateio.test.ts`

**Interfaces:**
- Produces:
  - `const ORDEM_PESSOAS = ['thiago', 'geice', 'gabrielle'] as const`; `type Pessoa`; `type PorPessoa = Record<Pessoa, bigint>`
  - `const ALGORITMO_RATEIO = 'divisores_v1'`
  - `acumuladoReferencia(pesos: PorPessoa, n: bigint): PorPessoa` (laço)
  - `acumulado(pesos: PorPessoa, n: bigint): PorPessoa` (otimizado)
  - `ratearIntervalo(pesos: PorPessoa, inicio: bigint, fim: bigint): PorPessoa`
  - `validarPesos(pesos: PorPessoa, percentualTotal: Percentual): void` — cada um em 0..10000, soma igual ao total; lança `ErroValidacao`
  - `somaPorPessoa(a, b)`, `ZERO_POR_PESSOA`

- [ ] **Passo 1: Teste**

`tests/dominio/rateio.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  acumulado, acumuladoReferencia, ratearIntervalo, validarPesos, type PorPessoa,
} from '@/dominio/rateio';
import { ErroValidacao } from '@/dominio/erros';

const P = (t: number, g: number, b: number): PorPessoa => ({ thiago: BigInt(t), geice: BigInt(g), gabrielle: BigInt(b) });
const PADRAO = P(500, 100, 100);
const soma = (a: PorPessoa) => a.thiago + a.geice + a.gabrielle;
const arbPesos = fc.tuple(fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 0, max: 10000 }))
  .filter(([t, g, b]) => t + g + b > 0).map(([t, g, b]) => P(t, g, b));

describe('acumuladoReferencia', () => {
  it('n = 0 -> zeros', () => expect(acumuladoReferencia(PADRAO, 0n)).toEqual(P(0, 0, 0)));
  it('7 centavos com 5/1/1 -> 5/1/1', () => expect(acumuladoReferencia(PADRAO, 7n)).toEqual(P(5, 1, 1)));
  it('desempate na ordem Thiago, Geice, Gabrielle', () => {
    expect(acumuladoReferencia(P(1, 1, 1), 1n)).toEqual(P(1, 0, 0));
    expect(acumuladoReferencia(P(1, 1, 1), 2n)).toEqual(P(1, 1, 0));
  });
  it('peso zero nunca recebe', () => expect(acumuladoReferencia(P(0, 1, 1), 5n).thiago).toBe(0n));
});

describe('acumulado (otimizado)', () => {
  it('exemplo do spec: R$ 350,00 com 5/1/1 -> 250/50/50', () => {
    expect(acumulado(PADRAO, 35000n)).toEqual(P(25000, 5000, 5000));
  });
  it('todos os pesos zero: só n = 0 permitido', () => {
    expect(acumulado(P(0, 0, 0), 0n)).toEqual(P(0, 0, 0));
    expect(() => acumulado(P(0, 0, 0), 1n)).toThrow();
  });
  it('n negativo é erro', () => expect(() => acumulado(PADRAO, -1n)).toThrow());
  it('equivale ao algoritmo de referência', () => {
    fc.assert(fc.property(arbPesos, fc.integer({ min: 0, max: 3000 }), (pesos, n) => {
      expect(acumulado(pesos, BigInt(n))).toEqual(acumuladoReferencia(pesos, BigInt(n)));
    }), { numRuns: 300 });
  });
  it('propriedades: soma exata, monotonicidade, não negatividade', () => {
    fc.assert(fc.property(arbPesos, fc.integer({ min: 0, max: 100000 }), (pesos, n) => {
      const a = acumulado(pesos, BigInt(n));
      const b = acumulado(pesos, BigInt(n) + 1n);
      expect(soma(a)).toBe(BigInt(n));
      for (const p of ['thiago', 'geice', 'gabrielle'] as const) {
        expect(a[p] >= 0n).toBe(true);
        expect(b[p] >= a[p]).toBe(true);
        if (pesos[p] === 0n) expect(a[p]).toBe(0n);
      }
    }));
  });
});

describe('ratearIntervalo', () => {
  it('fracionar em trechos não altera os totais', () => {
    fc.assert(fc.property(arbPesos, fc.integer({ min: 0, max: 50000 }), fc.integer({ min: 0, max: 50000 }), fc.integer({ min: 0, max: 50000 }),
      (pesos, a, b, c) => {
        const [x, y, z] = [a, b, c].sort((i, j) => i - j).map(BigInt);
        const inteiro = ratearIntervalo(pesos, x, z);
        const p1 = ratearIntervalo(pesos, x, y);
        const p2 = ratearIntervalo(pesos, y, z);
        expect(p1.thiago + p2.thiago).toBe(inteiro.thiago);
        expect(p1.geice + p2.geice).toBe(inteiro.geice);
        expect(p1.gabrielle + p2.gabrielle).toBe(inteiro.gabrielle);
        expect(soma(inteiro)).toBe(z - x);
      }));
  });
  it('rejeita intervalo invertido', () => expect(() => ratearIntervalo(PADRAO, 5n, 3n)).toThrow());
});

describe('validarPesos', () => {
  it('aceita 5/1/1 para 7%', () => expect(() => validarPesos(PADRAO, 700n)).not.toThrow());
  it('rejeita soma diferente do total', () => expect(() => validarPesos(P(500, 100, 50), 700n)).toThrow(ErroValidacao));
  it('rejeita negativo', () => expect(() => validarPesos(P(800, -100, 0), 700n)).toThrow(ErroValidacao));
  it('total zero exige todos zero', () => {
    expect(() => validarPesos(P(0, 0, 0), 0n)).not.toThrow();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:dominio` → FAIL.

- [ ] **Passo 3: Implementar**

`src/dominio/rateio.ts`:
```ts
import { ErroValidacao } from './erros';
import type { Percentual } from './dinheiro';

export const ORDEM_PESSOAS = ['thiago', 'geice', 'gabrielle'] as const;
export type Pessoa = (typeof ORDEM_PESSOAS)[number];
export type PorPessoa = Record<Pessoa, bigint>;
export const ALGORITMO_RATEIO = 'divisores_v1';
export const ZERO_POR_PESSOA: PorPessoa = { thiago: 0n, geice: 0n, gabrielle: 0n };

export function somaPorPessoa(a: PorPessoa, b: PorPessoa): PorPessoa {
  return { thiago: a.thiago + b.thiago, geice: a.geice + b.geice, gabrielle: a.gabrielle + b.gabrielle };
}

function somaPesos(p: PorPessoa): bigint {
  return p.thiago + p.geice + p.gabrielle;
}

// Maior peso/(atribuido+1), comparado por multiplicação cruzada; empate mantém a ordem fixa.
function escolherProxima(pesos: PorPessoa, atribuido: PorPessoa): Pessoa {
  let melhor: Pessoa | null = null;
  for (const p of ORDEM_PESSOAS) {
    if (pesos[p] === 0n) continue;
    if (melhor === null) { melhor = p; continue; }
    if (pesos[p] * (atribuido[melhor] + 1n) > pesos[melhor] * (atribuido[p] + 1n)) melhor = p;
  }
  if (melhor === null) throw new Error('Todos os pesos são zero; só n = 0 é permitido');
  return melhor;
}

export function acumuladoReferencia(pesos: PorPessoa, n: bigint): PorPessoa {
  if (n < 0n) throw new Error('n não pode ser negativo');
  const a: PorPessoa = { ...ZERO_POR_PESSOA };
  for (let i = 0n; i < n; i++) a[escolherProxima(pesos, a)] += 1n;
  return a;
}

export function acumulado(pesos: PorPessoa, n: bigint): PorPessoa {
  if (n < 0n) throw new Error('n não pode ser negativo');
  if (n === 0n) return { ...ZERO_POR_PESSOA };
  const W = somaPesos(pesos);
  if (W <= 0n) throw new Error('Todos os pesos são zero; só n = 0 é permitido');
  const a: PorPessoa = {
    thiago: (n * pesos.thiago) / W,
    geice: (n * pesos.geice) / W,
    gabrielle: (n * pesos.gabrielle) / W,
  };
  let restantes = n - somaPesos(a);
  while (restantes > 0n) { a[escolherProxima(pesos, a)] += 1n; restantes -= 1n; }
  return a;
}

export function ratearIntervalo(pesos: PorPessoa, inicio: bigint, fim: bigint): PorPessoa {
  if (inicio < 0n || fim < inicio) throw new Error(`Intervalo inválido [${inicio}, ${fim})`);
  const b = acumulado(pesos, fim);
  const a = acumulado(pesos, inicio);
  return { thiago: b.thiago - a.thiago, geice: b.geice - a.geice, gabrielle: b.gabrielle - a.gabrielle };
}

export function validarPesos(pesos: PorPessoa, percentualTotal: Percentual): void {
  for (const p of ORDEM_PESSOAS) {
    if (pesos[p] < 0n || pesos[p] > 10000n) {
      throw new ErroValidacao(`Percentual de ${p} deve estar entre 0 e 100`, `rateio_${p}`);
    }
  }
  if (somaPesos(pesos) !== percentualTotal) {
    throw new ErroValidacao('A soma do rateio deve ser igual ao percentual total de comissão', 'rateio_thiago');
  }
}
```

- [ ] **Passo 4: Rodar** — `npm run test:dominio` → PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/dominio/rateio.ts tests/dominio/rateio.test.ts
git commit -m "feat(dominio): rateio determinístico divisores_v1 com testes de propriedades"
```

---

### Tarefa 6: Geração pura de itens de lote

**Files:**
- Create: `src/dominio/lote.ts`, `src/dominio/json.ts`, `tests/dominio/lote.test.ts`, `tests/dominio/json.test.ts`

**Interfaces:**
- Produces:
  - `const VERSAO_CALCULO = 'comissao_v2/divisores_v1'`
  - `interface OsParaLote { osId: string; numeroOs: string; numeroOsNormalizado: string; cliente: string; produto: string; valorOs: Centavos; percentualComissao: Percentual; totalPagoCliente: Centavos; reservasAtivas: Intervalo[]; pesos: PorPessoa }`
  - `interface ItemLoteCalculado { osId; ordem: number; inicio: bigint; fim: bigint; valorComissao: Centavos; rateio: PorPessoa; snapshot: { numeroOs; cliente; produto; valorOs; percentualComissao; totalPagoCliente; comissaoLiberada; comissaoComprometidaAnterior } }`
  - `resumoComissaoOs(os): { comissaoTotal, comissaoLiberada, comissaoComprometida, comissaoDisponivel, livres: Intervalo[] }`
  - `calcularItensLote(oss: OsParaLote[]): ItemLoteCalculado[]` — lança `ErroValidacao` se vazio
  - `totalItens(itens): Centavos`
  - `json.ts`: `paraJson(valor): string` (bigint → string), `deJson(texto)`

- [ ] **Passo 1: Testes**

`tests/dominio/lote.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { calcularItensLote, resumoComissaoOs, totalItens, type OsParaLote } from '@/dominio/lote';
import { ErroValidacao } from '@/dominio/erros';

function os(sobrescrever: Partial<OsParaLote> = {}): OsParaLote {
  return {
    osId: '11111111-1111-1111-1111-111111111111', numeroOs: 'OS-100', numeroOsNormalizado: 'OS-100',
    cliente: 'Cliente A', produto: 'Produto X', valorOs: 1_000_000n, percentualComissao: 700n,
    totalPagoCliente: 500_000n, reservasAtivas: [], pesos: { thiago: 500n, geice: 100n, gabrielle: 100n },
    ...sobrescrever,
  };
}

describe('resumoComissaoOs', () => {
  it('R$ 10.000 com 50% pago: total 700, liberada 350, disponível 350', () => {
    const r = resumoComissaoOs(os());
    expect(r.comissaoTotal).toBe(70_000n);
    expect(r.comissaoLiberada).toBe(35_000n);
    expect(r.comissaoComprometida).toBe(0n);
    expect(r.comissaoDisponivel).toBe(35_000n);
    expect(r.livres).toEqual([{ inicio: 0n, fim: 35_000n }]);
  });
  it('com reserva anterior, disponível é o restante', () => {
    const r = resumoComissaoOs(os({ totalPagoCliente: 1_000_000n, reservasAtivas: [{ inicio: 0n, fim: 35_000n }] }));
    expect(r.comissaoComprometida).toBe(35_000n);
    expect(r.comissaoDisponivel).toBe(35_000n);
    expect(r.livres).toEqual([{ inicio: 35_000n, fim: 70_000n }]);
  });
});

describe('calcularItensLote', () => {
  it('fluxo nominal do spec: item de R$ 350 rateado 250/50/50 com snapshots', () => {
    const [item] = calcularItensLote([os()]);
    expect(item.ordem).toBe(1);
    expect(item.inicio).toBe(0n); expect(item.fim).toBe(35_000n);
    expect(item.valorComissao).toBe(35_000n);
    expect(item.rateio).toEqual({ thiago: 25_000n, geice: 5_000n, gabrielle: 5_000n });
    expect(item.snapshot).toEqual({
      numeroOs: 'OS-100', cliente: 'Cliente A', produto: 'Produto X', valorOs: 1_000_000n, percentualComissao: 700n,
      totalPagoCliente: 500_000n, comissaoLiberada: 35_000n, comissaoComprometidaAnterior: 0n,
    });
  });
  it('segundo envio após quitação reserva só o novo trecho', () => {
    const [item] = calcularItensLote([os({ totalPagoCliente: 1_000_000n, reservasAtivas: [{ inicio: 0n, fim: 35_000n }] })]);
    expect(item.inicio).toBe(35_000n); expect(item.fim).toBe(70_000n);
    expect(item.rateio).toEqual({ thiago: 25_000n, geice: 5_000n, gabrielle: 5_000n });
    expect(item.snapshot.comissaoComprometidaAnterior).toBe(35_000n);
  });
  it('ordena por número normalizado e depois id; ordem sequencial', () => {
    const itens = calcularItensLote([
      os({ osId: 'b', numeroOsNormalizado: 'OS-200', numeroOs: 'OS-200' }),
      os({ osId: 'a', numeroOsNormalizado: 'OS-100' }),
    ]);
    expect(itens.map((i) => [i.ordem, i.snapshot.numeroOs])).toEqual([[1, 'OS-100'], [2, 'OS-200']]);
  });
  it('OS sem disponível é ignorada; nenhuma disponível é erro', () => {
    expect(calcularItensLote([os(), os({ osId: 'z', numeroOsNormalizado: 'Z', totalPagoCliente: 0n })])).toHaveLength(1);
    expect(() => calcularItensLote([os({ totalPagoCliente: 0n })])).toThrow(ErroValidacao);
  });
  it('rateio inválido da OS é rejeitado', () => {
    expect(() => calcularItensLote([os({ pesos: { thiago: 500n, geice: 100n, gabrielle: 0n } })])).toThrow(ErroValidacao);
  });
  it('totalItens soma os itens', () => {
    expect(totalItens(calcularItensLote([os(), os({ osId: 'c', numeroOsNormalizado: 'C' })]))).toBe(70_000n);
  });
});
```

`tests/dominio/json.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { paraJson, deJson } from '@/dominio/json';

describe('json com bigint', () => {
  it('serializa bigint como string e desserializa de volta como string', () => {
    const texto = paraJson({ valor: 123n, lista: [1n, 'x'] });
    expect(texto).toBe('{"valor":"123","lista":["1","x"]}');
    expect(deJson(texto)).toEqual({ valor: '123', lista: ['1', 'x'] });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:dominio` → FAIL.

- [ ] **Passo 3: Implementar**

`src/dominio/json.ts`:
```ts
export function paraJson(valor: unknown): string {
  return JSON.stringify(valor, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

export function deJson(texto: string): unknown {
  return JSON.parse(texto);
}
```

`src/dominio/lote.ts`:
```ts
import { comissaoLiberada, comissaoTotal } from './comissao';
import type { Centavos, Percentual } from './dinheiro';
import { ErroValidacao } from './erros';
import { intervalosLivres, somaTamanhos, type Intervalo } from './intervalos';
import { ratearIntervalo, validarPesos, type PorPessoa } from './rateio';

export const VERSAO_CALCULO = 'comissao_v2/divisores_v1';

export interface OsParaLote {
  osId: string;
  numeroOs: string;
  numeroOsNormalizado: string;
  cliente: string;
  produto: string;
  valorOs: Centavos;
  percentualComissao: Percentual;
  totalPagoCliente: Centavos;
  reservasAtivas: Intervalo[];
  pesos: PorPessoa;
}

export interface SnapshotItem {
  numeroOs: string;
  cliente: string;
  produto: string;
  valorOs: Centavos;
  percentualComissao: Percentual;
  totalPagoCliente: Centavos;
  comissaoLiberada: Centavos;
  comissaoComprometidaAnterior: Centavos;
}

export interface ItemLoteCalculado {
  osId: string;
  ordem: number;
  inicio: bigint;
  fim: bigint;
  valorComissao: Centavos;
  rateio: PorPessoa;
  snapshot: SnapshotItem;
}

export function resumoComissaoOs(os: OsParaLote) {
  const total = comissaoTotal(os.valorOs, os.percentualComissao);
  const liberada = comissaoLiberada(total, os.totalPagoCliente, os.valorOs);
  const livres = intervalosLivres(liberada, os.reservasAtivas);
  const comprometida = somaTamanhos(os.reservasAtivas);
  return {
    comissaoTotal: total,
    comissaoLiberada: liberada,
    comissaoComprometida: comprometida,
    comissaoDisponivel: somaTamanhos(livres),
    livres,
  };
}

function compararOs(a: OsParaLote, b: OsParaLote): number {
  if (a.numeroOsNormalizado !== b.numeroOsNormalizado) return a.numeroOsNormalizado < b.numeroOsNormalizado ? -1 : 1;
  if (a.osId !== b.osId) return a.osId < b.osId ? -1 : 1;
  return 0;
}

export function calcularItensLote(oss: OsParaLote[]): ItemLoteCalculado[] {
  const itens: ItemLoteCalculado[] = [];
  for (const os of [...oss].sort(compararOs)) {
    validarPesos(os.pesos, os.percentualComissao);
    const resumo = resumoComissaoOs(os);
    for (const iv of resumo.livres) {
      itens.push({
        osId: os.osId,
        ordem: itens.length + 1,
        inicio: iv.inicio,
        fim: iv.fim,
        valorComissao: iv.fim - iv.inicio,
        rateio: ratearIntervalo(os.pesos, iv.inicio, iv.fim),
        snapshot: {
          numeroOs: os.numeroOs,
          cliente: os.cliente,
          produto: os.produto,
          valorOs: os.valorOs,
          percentualComissao: os.percentualComissao,
          totalPagoCliente: os.totalPagoCliente,
          comissaoLiberada: resumo.comissaoLiberada,
          comissaoComprometidaAnterior: resumo.comissaoComprometida,
        },
      });
    }
  }
  if (itens.length === 0) throw new ErroValidacao('Nenhuma comissão disponível para envio');
  return itens;
}

export function totalItens(itens: ItemLoteCalculado[]): Centavos {
  return itens.reduce((acc, i) => acc + i.valorComissao, 0n);
}
```

- [ ] **Passo 4: Rodar** — `npm run test:dominio` → PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/dominio/lote.ts src/dominio/json.ts tests/dominio/lote.test.ts tests/dominio/json.test.ts
git commit -m "feat(dominio): geração pura de itens de lote com snapshots e rateio"
```

---

### Tarefa 7: Conexão Postgres e transação financeira com bloqueio global

A partir daqui as tarefas usam o banco Supabase real (não há banco local). `.env.local` já tem `DATABASE_URL` apontando para o papel `app_writer`, criado nas migrações já aplicadas (`supabase/migrations/20260910000100_base.sql` e `20260910000200_privilegios.sql`).

**Files:**
- Create: `src/servidor/db.ts`, `tests/integracao/ajuda.ts`, `tests/integracao/db.test.ts`

**Interfaces:**
- Produces: `sql` (cliente `postgres.js` singleton), `comTransacaoFinanceira<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T>` — inicia transação, executa `select id from controle_financeiro where id = 1 for update`, roda `fn(tx)`, comita; qualquer exceção reverte tudo.
- `tests/integracao/ajuda.ts` produces: `numeroOsTeste(sufixo: string): string` → `"TESTE-<sufixo>-<timestamp aleatório>"`, usado por todas as tarefas seguintes para nunca colidir com dados reais e ser fácil de limpar.

- [ ] **Passo 1: Criar o helper de testes de integração**

`tests/integracao/ajuda.ts`:
```ts
import { randomUUID } from 'node:crypto';

export function numeroOsTeste(sufixo: string): string {
  return `TESTE-${sufixo}-${randomUUID().slice(0, 8)}`;
}
```

- [ ] **Passo 2: Escrever o teste de transação e bloqueio**

`tests/integracao/db.test.ts`:
```ts
import { describe, it, expect, afterAll } from 'vitest';
import { sql, comTransacaoFinanceira } from '@/servidor/db';

describe('comTransacaoFinanceira', () => {
  it('confirma a transação quando fn resolve', async () => {
    const linhas = await comTransacaoFinanceira(async (tx) => tx`select 1 as um`);
    expect(linhas[0].um).toBe(1);
  });

  it('reverte tudo quando fn lança', async () => {
    const numero = numeroOsTesteLocal();
    await expect(comTransacaoFinanceira(async (tx) => {
      await tx`insert into public.os (numero_os, numero_os_normalizado, cliente, produto, valor, percentual_comissao, data_venda)
                values (${numero}, ${numero}, 'Cliente Teste', 'Produto Teste', 100.00, 7.00, current_date)`;
      throw new Error('forçando rollback');
    })).rejects.toThrow('forçando rollback');
    const restante = await sql`select id from public.os where numero_os_normalizado = ${numero}`;
    expect(restante).toHaveLength(0);
  });

  it('serializa duas transações concorrentes pelo bloqueio global', async () => {
    const eventos: string[] = [];
    const lenta = comTransacaoFinanceira(async (tx) => {
      eventos.push('lenta:inicio');
      await tx`select pg_sleep(0.3)`;
      eventos.push('lenta:fim');
    });
    await new Promise((r) => setTimeout(r, 50)); // garante que "lenta" já pegou o lock primeiro
    const rapida = comTransacaoFinanceira(async () => {
      eventos.push('rapida:inicio');
    });
    await Promise.all([lenta, rapida]);
    expect(eventos).toEqual(['lenta:inicio', 'lenta:fim', 'rapida:inicio']);
  });

  function numeroOsTesteLocal() {
    return `TESTE-DB-${Math.random().toString(36).slice(2, 10)}`;
  }

  afterAll(async () => {
    await sql`delete from public.os where numero_os_normalizado like 'TESTE-%'`;
    await sql.end();
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

Run: `npm run test:integracao`
Expected: FAIL — módulo `@/servidor/db` não encontrado.

- [ ] **Passo 4: Implementar**

`src/servidor/db.ts`:
```ts
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada em .env.local');
}

export const sql = postgres(process.env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  onnotice: () => {},
});

export async function comTransacaoFinanceira<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select id from public.controle_financeiro where id = 1 for update`;
    return fn(tx);
  });
}
```

- [ ] **Passo 5: Rodar e ver passar**

Run: `npm run test:integracao`
Expected: PASS (a terceira asserção comprova que a transação "rápida" só começa depois que a "lenta" libera o bloqueio).

- [ ] **Passo 6: Commit**

```bash
git add src/servidor/db.ts tests/integracao/ajuda.ts tests/integracao/db.test.ts
git commit -m "feat(servidor): conexão postgres.js e transação financeira com bloqueio global"
```

---

### Tarefa 8: Auditoria e idempotência

**Files:**
- Create: `src/servidor/auditoria.ts`, `src/servidor/idempotencia.ts`, `tests/integracao/auditoria.test.ts`, `tests/integracao/idempotencia.test.ts`

**Interfaces:**
- Consumes: `comTransacaoFinanceira`, `sql` de `@/servidor/db`; `paraJson` de `@/dominio/json`.
- Produces:
  - `registrarAuditoria(tx: postgres.TransactionSql, evento: { entidade: string; entidadeId: string; acao: string; responsavelId: string; dataEfetiva?: string; motivo?: string; valoresAnteriores?: unknown; valoresNovos?: unknown; operacaoId?: string }): Promise<void>`
  - `executarIdempotente<T extends Record<string, string>>(tx: postgres.TransactionSql, params: { chave: string; usuarioId: string; tipoAcao: string; conteudo: unknown }, executar: () => Promise<T>): Promise<T>` — se `chave` já existe com o mesmo `conteudo` (comparado por hash), devolve o `resultado` gravado sem repetir `executar`; se existe com conteúdo diferente, lança `ErroValidacao`.

- [ ] **Passo 1: Teste de auditoria**

`tests/integracao/auditoria.test.ts`:
```ts
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { registrarAuditoria } from '@/servidor/auditoria';

describe('registrarAuditoria', () => {
  const entidadeId = randomUUID();

  it('grava entidade, ação, motivo e valores', async () => {
    await comTransacaoFinanceira((tx) =>
      registrarAuditoria(tx, {
        entidade: 'os', entidadeId, acao: 'criar', responsavelId: randomUUID(),
        motivo: 'cadastro inicial', valoresNovos: { valor: 100_000n, numeroOs: 'TESTE-AUD-1' },
      }),
    );
    const [linha] = await sql`select * from interno.auditoria_evento where entidade_id = ${entidadeId}`;
    expect(linha.entidade).toBe('os');
    expect(linha.acao).toBe('criar');
    expect(linha.motivo).toBe('cadastro inicial');
    expect(linha.valores_novos).toEqual({ valor: '100000', numeroOs: 'TESTE-AUD-1' });
  });

  afterAll(async () => {
    await sql`delete from interno.auditoria_evento where entidade_id = ${entidadeId}`;
    await sql.end();
  });
});
```

- [ ] **Passo 2: Teste de idempotência**

`tests/integracao/idempotencia.test.ts`:
```ts
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { executarIdempotente } from '@/servidor/idempotencia';
import { ErroValidacao } from '@/dominio/erros';

describe('executarIdempotente', () => {
  const chave = randomUUID();
  const usuarioId = randomUUID();

  it('executa uma vez e repete o mesmo resultado para a mesma chave e conteúdo', async () => {
    let execucoes = 0;
    const executar = async () => {
      execucoes += 1;
      return { osId: randomUUID() };
    };
    const r1 = await comTransacaoFinanceira((tx) =>
      executarIdempotente(tx, { chave, usuarioId, tipoAcao: 'criar_os', conteudo: { numeroOs: 'TESTE-IDEM-1' } }, executar),
    );
    const r2 = await comTransacaoFinanceira((tx) =>
      executarIdempotente(tx, { chave, usuarioId, tipoAcao: 'criar_os', conteudo: { numeroOs: 'TESTE-IDEM-1' } }, executar),
    );
    expect(execucoes).toBe(1);
    expect(r2).toEqual(r1);
  });

  it('rejeita a mesma chave com conteúdo diferente', async () => {
    await expect(comTransacaoFinanceira((tx) =>
      executarIdempotente(tx, { chave, usuarioId, tipoAcao: 'criar_os', conteudo: { numeroOs: 'TESTE-IDEM-2' } }, async () => ({ osId: randomUUID() })),
    )).rejects.toThrow(ErroValidacao);
  });

  afterAll(async () => {
    await sql`delete from interno.operacao_idempotente where chave = ${chave}`;
    await sql.end();
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

Run: `npm run test:integracao`
Expected: FAIL — módulos `@/servidor/auditoria` e `@/servidor/idempotencia` não encontrados.

- [ ] **Passo 4: Implementar auditoria**

`src/servidor/auditoria.ts`:
```ts
import type postgres from 'postgres';
import { paraJson } from '@/dominio/json';

export interface EventoAuditoria {
  entidade: string;
  entidadeId: string;
  acao: string;
  responsavelId: string;
  dataEfetiva?: string;
  motivo?: string;
  valoresAnteriores?: unknown;
  valoresNovos?: unknown;
  operacaoId?: string;
}

function paraJsonb(tx: postgres.TransactionSql, valor: unknown) {
  return valor === undefined ? null : tx.json(JSON.parse(paraJson(valor)));
}

export async function registrarAuditoria(tx: postgres.TransactionSql, evento: EventoAuditoria): Promise<void> {
  await tx`
    insert into interno.auditoria_evento
      (entidade, entidade_id, acao, responsavel_id, data_efetiva, motivo, valores_anteriores, valores_novos, operacao_id)
    values (
      ${evento.entidade}, ${evento.entidadeId}, ${evento.acao}, ${evento.responsavelId},
      ${evento.dataEfetiva ?? null}, ${evento.motivo ?? null},
      ${paraJsonb(tx, evento.valoresAnteriores)}, ${paraJsonb(tx, evento.valoresNovos)},
      ${evento.operacaoId ?? null}
    )
  `;
}
```

- [ ] **Passo 5: Implementar idempotência**

`src/servidor/idempotencia.ts`:
```ts
import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import { paraJson } from '@/dominio/json';
import { ErroValidacao } from '@/dominio/erros';

function hashConteudo(conteudo: unknown): string {
  return createHash('sha256').update(paraJson(conteudo)).digest('hex');
}

export async function executarIdempotente<T extends Record<string, string>>(
  tx: postgres.TransactionSql,
  params: { chave: string; usuarioId: string; tipoAcao: string; conteudo: unknown },
  executar: () => Promise<T>,
): Promise<T> {
  const hash = hashConteudo(params.conteudo);
  const [existente] = await tx`
    select resultado, hash_conteudo from interno.operacao_idempotente where chave = ${params.chave}
  `;
  if (existente) {
    if (existente.hash_conteudo !== hash) {
      throw new ErroValidacao('Esta operação já foi executada com dados diferentes. Recarregue a página.');
    }
    return existente.resultado as T;
  }
  const resultado = await executar();
  await tx`
    insert into interno.operacao_idempotente (chave, usuario_id, tipo_acao, hash_conteudo, resultado)
    values (${params.chave}, ${params.usuarioId}, ${params.tipoAcao}, ${hash}, ${tx.json(resultado)})
  `;
  return resultado;
}
```

- [ ] **Passo 6: Rodar e ver passar**

Run: `npm run test:integracao`
Expected: PASS.

- [ ] **Passo 7: Commit**

```bash
git add src/servidor/auditoria.ts src/servidor/idempotencia.ts tests/integracao/auditoria.test.ts tests/integracao/idempotencia.test.ts
git commit -m "feat(servidor): auditoria e idempotência sobre a transação financeira"
```

---

### Tarefa 9: Usuários do Supabase Auth (Thiago admin, financeiro)

**Files:**
- Create: `scripts/criar-usuarios.ts`

**Interfaces:**
- Produces: script executável via `npm run usuarios:criar`; não exporta nada (script de uso único).

- [ ] **Passo 1: Escrever o script**

`scripts/criar-usuarios.ts`:
```ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chaveServico) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios em .env.local');
}

const admin = createClient(url, chaveServico, { auth: { autoRefreshToken: false, persistSession: false } });

interface UsuarioParaCriar { email: string; senha: string; papel: 'admin' | 'financeiro' }

async function criarOuAtualizarUsuario(u: UsuarioParaCriar) {
  const { data: existentes, error: erroBusca } = await admin.auth.admin.listUsers();
  if (erroBusca) throw erroBusca;
  const existente = existentes.users.find((x) => x.email === u.email);
  if (existente) {
    const { error } = await admin.auth.admin.updateUserById(existente.id, {
      app_metadata: { role: u.papel },
    });
    if (error) throw error;
    console.log(`Papel atualizado: ${u.email} -> ${u.papel}`);
    return;
  }
  const { error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.senha,
    email_confirm: true,
    app_metadata: { role: u.papel },
  });
  if (error) throw error;
  console.log(`Usuário criado: ${u.email} (${u.papel})`);
}

async function main() {
  const usuarios = process.argv.slice(2);
  if (usuarios.length !== 2) {
    console.error('Uso: tsx scripts/criar-usuarios.ts <email-thiago>:<senha-thiago> <email-financeiro>:<senha-financeiro>');
    process.exit(1);
  }
  const [thiago, financeiro] = usuarios.map((par) => {
    const [email, senha] = par.split(':');
    if (!email || !senha) throw new Error(`Formato inválido: "${par}", use email:senha`);
    return { email, senha };
  });
  await criarOuAtualizarUsuario({ ...thiago, papel: 'admin' });
  await criarOuAtualizarUsuario({ ...financeiro, papel: 'financeiro' });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Passo 2: Rodar apontando para o projeto real**

Escolher senhas fortes só para esta execução (não precisam ser as senhas finais — podem ser trocadas depois pelo próprio usuário na tela de login "esqueci a senha" manual descrita no spec §4.1).

Run: `npm run usuarios:criar -- "thiago@exemplo.com:SenhaForte123!" "financeiro@exemplo.com:OutraSenha456!"`
Expected: duas linhas `Usuário criado: ...`.

- [ ] **Passo 3: Verificar no Supabase**

Pedir para o usuário confirmar, rodando no SQL Editor do Supabase:
```sql
select email, raw_app_meta_data->>'role' as papel from auth.users;
```
Expected: duas linhas, com `papel` igual a `admin` e `financeiro` respectivamente.

- [ ] **Passo 4: Commit**

```bash
git add scripts/criar-usuarios.ts
git commit -m "feat: script para criar/atualizar os dois usuários do sistema no Supabase Auth"
```

---

### Tarefa 10: Sessão, papel e proteção de rotas

**Files:**
- Create: `src/servidor/supabase/servidor.ts`, `src/servidor/supabase/navegador.ts`, `src/servidor/auth.ts`, `src/middleware.ts`, `tests/dominio/auth-papel.test.ts`

**Interfaces:**
- Produces:
  - `criarClienteServidor(): Promise<SupabaseClient>` (`src/servidor/supabase/servidor.ts`, usa `@supabase/ssr` `createServerClient` + cookies de `next/headers`)
  - `criarClienteNavegador(): SupabaseClient` (`src/servidor/supabase/navegador.ts`, usa `createBrowserClient`)
  - `type Papel = 'admin' | 'financeiro'`; `interface Sessao { userId: string; email: string; papel: Papel }`
  - `papelDoUsuario(appMetadata: Record<string, unknown>): Papel | null` (função pura, testada em `tests/dominio/auth-papel.test.ts` mesmo vivendo em `src/servidor/auth.ts`, por não depender de rede)
  - `sessaoAtual(): Promise<Sessao | null>`, `exigirSessao(): Promise<Sessao>` (lança `ErroPermissao`), `exigirPapel(papel: Papel): Promise<Sessao>` (lança `ErroPermissao` se o papel não bater)
  - Middleware que redireciona para `/login` quem não tem sessão e tenta acessar qualquer rota fora de `/login`.

- [ ] **Passo 1: Teste da função pura `papelDoUsuario`**

`tests/dominio/auth-papel.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { papelDoUsuario } from '@/servidor/auth';

describe('papelDoUsuario', () => {
  it('reconhece admin e financeiro', () => {
    expect(papelDoUsuario({ role: 'admin' })).toBe('admin');
    expect(papelDoUsuario({ role: 'financeiro' })).toBe('financeiro');
  });
  it('rejeita papel desconhecido ou ausente', () => {
    expect(papelDoUsuario({ role: 'outro' })).toBeNull();
    expect(papelDoUsuario({})).toBeNull();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:dominio` → FAIL.

- [ ] **Passo 3: Implementar os clientes Supabase**

`src/servidor/supabase/servidor.ts`:
```ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function criarClienteServidor() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (lista) => {
          try {
            for (const { name, value, options } of lista) cookieStore.set(name, value, options);
          } catch {
            // chamado a partir de um Server Component sem permissão de escrita; o
            // middleware já cuida de renovar a sessão nesse caso.
          }
        },
      },
    },
  );
}
```

`src/servidor/supabase/navegador.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';

export function criarClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Passo 4: Implementar `auth.ts`**

`src/servidor/auth.ts`:
```ts
import { criarClienteServidor } from './supabase/servidor';
import { ErroPermissao } from '@/dominio/erros';

export type Papel = 'admin' | 'financeiro';

export interface Sessao {
  userId: string;
  email: string;
  papel: Papel;
}

export function papelDoUsuario(appMetadata: Record<string, unknown>): Papel | null {
  const role = appMetadata.role;
  return role === 'admin' || role === 'financeiro' ? role : null;
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  const papel = papelDoUsuario(user.app_metadata ?? {});
  if (!papel) return null;
  return { userId: user.id, email: user.email, papel };
}

export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) throw new ErroPermissao('É necessário entrar no sistema');
  return sessao;
}

export async function exigirPapel(papel: Papel): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel !== papel) throw new ErroPermissao('Você não tem permissão para esta ação');
  return sessao;
}
```

- [ ] **Passo 5: Implementar o middleware**

`src/middleware.ts`:
```ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          for (const { name, value } of lista) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of lista) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname !== '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Passo 6: Rodar e ver passar**

Run: `npm run test:dominio` → PASS. Run: `npm run build` → sucesso (confirma que os clientes Supabase compilam sem variáveis de ambiente ausentes em build time, já que leem `process.env` em tempo de execução).

- [ ] **Passo 7: Commit**

```bash
git add src/servidor/supabase src/servidor/auth.ts src/middleware.ts tests/dominio/auth-papel.test.ts
git commit -m "feat(servidor): sessão, papel e middleware de autenticação"
```

---

### Tarefa 11: Tratamento de erro de formulário e componentes de UI comuns

**Files:**
- Create: `src/servidor/formularios.ts`, `src/componentes/Campo.tsx`, `src/componentes/Moeda.tsx`, `tests/dominio/formularios.test.ts`

**Interfaces:**
- Produces:
  - `interface EstadoFormulario { erroGeral: string | null; errosPorCampo: Record<string, string> }`; `const ESTADO_INICIAL_FORMULARIO: EstadoFormulario`
  - `tratarErroFormulario(erro: unknown): EstadoFormulario`
  - `<Campo label htmlFor erro? children>` — envolve um input com rótulo e mensagem de erro em vermelho
  - `<Moeda valor={Centavos} />` — usa `formatarBRL`

- [ ] **Passo 1: Teste**

`tests/dominio/formularios.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { tratarErroFormulario, ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';
import { ErroValidacao, ErroPermissao } from '@/dominio/erros';

describe('tratarErroFormulario', () => {
  it('erro de validação com campo vira erro daquele campo', () => {
    const r = tratarErroFormulario(new ErroValidacao('Valor inválido', 'valor'));
    expect(r.errosPorCampo).toEqual({ valor: 'Valor inválido' });
    expect(r.erroGeral).toBeNull();
  });
  it('erro de validação sem campo vira erro geral', () => {
    const r = tratarErroFormulario(new ErroValidacao('Nenhuma comissão disponível'));
    expect(r.erroGeral).toBe('Nenhuma comissão disponível');
    expect(r.errosPorCampo).toEqual({});
  });
  it('erro de permissão vira erro geral', () => {
    expect(tratarErroFormulario(new ErroPermissao()).erroGeral).toBe('Acesso não autorizado');
  });
  it('erro desconhecido vira mensagem genérica', () => {
    expect(tratarErroFormulario(new Error('boom')).erroGeral).toBe('Ocorreu um erro inesperado. Tente novamente.');
  });
  it('estado inicial não tem erros', () => {
    expect(ESTADO_INICIAL_FORMULARIO).toEqual({ erroGeral: null, errosPorCampo: {} });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:dominio` → FAIL.

- [ ] **Passo 3: Implementar**

`src/servidor/formularios.ts`:
```ts
import { ErroConcorrencia, ErroPermissao, ErroReserva, ErroValidacao } from '@/dominio/erros';

export interface EstadoFormulario {
  erroGeral: string | null;
  errosPorCampo: Record<string, string>;
}

export const ESTADO_INICIAL_FORMULARIO: EstadoFormulario = { erroGeral: null, errosPorCampo: {} };

export function tratarErroFormulario(erro: unknown): EstadoFormulario {
  if (erro instanceof ErroValidacao) {
    return erro.campo
      ? { erroGeral: null, errosPorCampo: { [erro.campo]: erro.message } }
      : { erroGeral: erro.message, errosPorCampo: {} };
  }
  if (erro instanceof ErroPermissao || erro instanceof ErroConcorrencia || erro instanceof ErroReserva) {
    return { erroGeral: erro.message, errosPorCampo: {} };
  }
  console.error(erro);
  return { erroGeral: 'Ocorreu um erro inesperado. Tente novamente.', errosPorCampo: {} };
}
```

- [ ] **Passo 4: Rodar e ver passar** — `npm run test:dominio` → PASS.

- [ ] **Passo 5: Criar os componentes de UI**

`src/componentes/Campo.tsx`:
```tsx
export function Campo({
  label, htmlFor, erro, children,
}: { label: string; htmlFor: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {erro && <span className="text-sm text-red-600">{erro}</span>}
    </div>
  );
}
```

`src/componentes/Moeda.tsx`:
```tsx
import { formatarBRL } from '@/dominio/dinheiro';

export function Moeda({ valor, classeName }: { valor: bigint; classeName?: string }) {
  return <span className={classeName}>{formatarBRL(valor)}</span>;
}
```

- [ ] **Passo 6: Rodar build** — `npm run build` → sucesso.

- [ ] **Passo 7: Commit**

```bash
git add src/servidor/formularios.ts src/componentes/Campo.tsx src/componentes/Moeda.tsx tests/dominio/formularios.test.ts
git commit -m "feat: tratamento de erro de formulário e componentes de UI comuns"
```

---

### Tarefa 12: Configuração comercial (serviço, ação e tela)

**Files:**
- Create: `src/servidor/configuracao/servico.ts`, `src/servidor/configuracao/acoes.ts`, `src/app/(app)/configuracao/page.tsx`, `src/app/(app)/configuracao/FormularioConfiguracao.tsx`, `tests/integracao/configuracao.test.ts`

**Interfaces:**
- Consumes: `comTransacaoFinanceira`, `sql`; `exigirPapel`; `validarPesos`; `parsePercentual`, `paraPercentualDb`, `formatarPercentual`; `registrarAuditoria`; `tratarErroFormulario`, `EstadoFormulario`.
- Produces:
  - `interface Configuracao { percentualComissaoPadrao: Percentual; rateioThiagoPadrao: Percentual; rateioGeicePadrao: Percentual; rateioGabriellePadrao: Percentual }`
  - `obterConfiguracao(): Promise<Configuracao>`
  - `atualizarConfiguracao(tx, dados: Configuracao, usuarioId: string): Promise<void>` — valida com `validarPesos`, grava as duas tabelas na mesma transação, registra auditoria.
  - Server action `salvarConfiguracaoAction(estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>`

- [ ] **Passo 1: Teste de integração do serviço**

`tests/integracao/configuracao.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { obterConfiguracao, atualizarConfiguracao } from '@/servidor/configuracao/servico';
import { ErroValidacao } from '@/dominio/erros';

describe('configuração comercial', () => {
  afterEach(async () => {
    await comTransacaoFinanceira((tx) => atualizarConfiguracao(tx, {
      percentualComissaoPadrao: 700n, rateioThiagoPadrao: 500n, rateioGeicePadrao: 100n, rateioGabriellePadrao: 100n,
    }, randomUUID()));
  });

  it('lê os valores padrão (7,00% / 5/1/1)', async () => {
    const config = await obterConfiguracao();
    expect(config).toEqual({
      percentualComissaoPadrao: 700n, rateioThiagoPadrao: 500n, rateioGeicePadrao: 100n, rateioGabriellePadrao: 100n,
    });
  });

  it('atualiza e persiste o novo padrão', async () => {
    await comTransacaoFinanceira((tx) => atualizarConfiguracao(tx, {
      percentualComissaoPadrao: 800n, rateioThiagoPadrao: 600n, rateioGeicePadrao: 100n, rateioGabriellePadrao: 100n,
    }, randomUUID()));
    expect(await obterConfiguracao()).toEqual({
      percentualComissaoPadrao: 800n, rateioThiagoPadrao: 600n, rateioGeicePadrao: 100n, rateioGabriellePadrao: 100n,
    });
  });

  it('rejeita rateio cuja soma não bate com o total', async () => {
    await expect(comTransacaoFinanceira((tx) => atualizarConfiguracao(tx, {
      percentualComissaoPadrao: 700n, rateioThiagoPadrao: 500n, rateioGeicePadrao: 100n, rateioGabriellePadrao: 50n,
    }, randomUUID()))).rejects.toThrow(ErroValidacao);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:integracao` → FAIL.

- [ ] **Passo 3: Implementar o serviço**

`src/servidor/configuracao/servico.ts`:
```ts
import type postgres from 'postgres';
import { sql } from '@/servidor/db';
import { registrarAuditoria } from '@/servidor/auditoria';
import { validarPesos } from '@/dominio/rateio';
import { paraPercentualDb, type Percentual } from '@/dominio/dinheiro';

export interface Configuracao {
  percentualComissaoPadrao: Percentual;
  rateioThiagoPadrao: Percentual;
  rateioGeicePadrao: Percentual;
  rateioGabriellePadrao: Percentual;
}

export async function obterConfiguracao(): Promise<Configuracao> {
  const [linha] = await sql`
    select cc.percentual_comissao_padrao, cr.rateio_thiago_padrao, cr.rateio_geice_padrao, cr.rateio_gabrielle_padrao
    from public.configuracao_comercial cc
    join interno.configuracao_rateio cr on cr.configuracao_id = cc.id
    where cc.id = 1
  `;
  return {
    percentualComissaoPadrao: BigInt(Math.round(Number(linha.percentual_comissao_padrao) * 100)),
    rateioThiagoPadrao: BigInt(Math.round(Number(linha.rateio_thiago_padrao) * 100)),
    rateioGeicePadrao: BigInt(Math.round(Number(linha.rateio_geice_padrao) * 100)),
    rateioGabriellePadrao: BigInt(Math.round(Number(linha.rateio_gabrielle_padrao) * 100)),
  };
}

export async function atualizarConfiguracao(
  tx: postgres.TransactionSql, dados: Configuracao, usuarioId: string,
): Promise<void> {
  validarPesos(
    { thiago: dados.rateioThiagoPadrao, geice: dados.rateioGeicePadrao, gabrielle: dados.rateioGabriellePadrao },
    dados.percentualComissaoPadrao,
  );
  await tx`
    update public.configuracao_comercial
    set percentual_comissao_padrao = ${paraPercentualDb(dados.percentualComissaoPadrao)},
        atualizado_em = now(), atualizado_por = ${usuarioId}
    where id = 1
  `;
  await tx`
    update interno.configuracao_rateio
    set rateio_thiago_padrao = ${paraPercentualDb(dados.rateioThiagoPadrao)},
        rateio_geice_padrao = ${paraPercentualDb(dados.rateioGeicePadrao)},
        rateio_gabrielle_padrao = ${paraPercentualDb(dados.rateioGabriellePadrao)},
        atualizado_em = now(), atualizado_por = ${usuarioId}
    where configuracao_id = 1
  `;
  await registrarAuditoria(tx, {
    entidade: 'configuracao_comercial', entidadeId: '00000000-0000-0000-0000-000000000001',
    acao: 'atualizar', responsavelId: usuarioId, valoresNovos: dados,
  });
}
```
Nota: a leitura converte `numeric` (que o `postgres.js` devolve como `string`) para centésimos multiplicando por 100 via `Number` — seguro aqui porque percentuais nunca passam de `10000` e não há perda de precisão nessa faixa; a regra "nunca converter dinheiro para Number" continua valendo para valores em reais, tratados sempre com `parseDecimal`/`paraDecimalDb`.

- [ ] **Passo 4: Rodar e ver passar** — `npm run test:integracao` → PASS.

- [ ] **Passo 5: Server action**

`src/servidor/configuracao/acoes.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import { atualizarConfiguracao } from './servico';
import { parsePercentual } from '@/dominio/dinheiro';
import { tratarErroFormulario, ESTADO_INICIAL_FORMULARIO, type EstadoFormulario } from '@/servidor/formularios';

export async function salvarConfiguracaoAction(
  _estadoAnterior: EstadoFormulario, formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const sessao = await exigirPapel('admin');
    const dados = {
      percentualComissaoPadrao: parsePercentual(String(formData.get('percentualComissaoPadrao'))),
      rateioThiagoPadrao: parsePercentual(String(formData.get('rateioThiagoPadrao'))),
      rateioGeicePadrao: parsePercentual(String(formData.get('rateioGeicePadrao'))),
      rateioGabriellePadrao: parsePercentual(String(formData.get('rateioGabriellePadrao'))),
    };
    await comTransacaoFinanceira((tx) => atualizarConfiguracao(tx, dados, sessao.userId));
    revalidatePath('/configuracao');
    return ESTADO_INICIAL_FORMULARIO;
  } catch (erro) {
    return tratarErroFormulario(erro);
  }
}
```

- [ ] **Passo 6: Tela**

`src/app/(app)/configuracao/FormularioConfiguracao.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { salvarConfiguracaoAction } from '@/servidor/configuracao/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';
import { formatarPercentual, type Percentual } from '@/dominio/dinheiro';
import { Campo } from '@/componentes/Campo';

function paraTexto(p: Percentual): string {
  return formatarPercentual(p).replace('%', '');
}

export function FormularioConfiguracao({ configuracaoAtual }: {
  configuracaoAtual: { percentualComissaoPadrao: Percentual; rateioThiagoPadrao: Percentual; rateioGeicePadrao: Percentual; rateioGabriellePadrao: Percentual };
}) {
  const [estado, acao, emAndamento] = useActionState(salvarConfiguracaoAction, ESTADO_INICIAL_FORMULARIO);

  return (
    <form action={acao} className="flex max-w-sm flex-col gap-4">
      <p className="text-sm text-gray-600">
        Estes valores só valem para OS novas; OS já cadastradas mantêm seus próprios percentuais.
      </p>
      <Campo label="% de comissão padrão" htmlFor="percentualComissaoPadrao" erro={estado.errosPorCampo.percentualComissaoPadrao}>
        <input name="percentualComissaoPadrao" id="percentualComissaoPadrao" defaultValue={paraTexto(configuracaoAtual.percentualComissaoPadrao)} className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="% Thiago" htmlFor="rateioThiagoPadrao" erro={estado.errosPorCampo.rateioThiagoPadrao}>
        <input name="rateioThiagoPadrao" id="rateioThiagoPadrao" defaultValue={paraTexto(configuracaoAtual.rateioThiagoPadrao)} className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="% Geice" htmlFor="rateioGeicePadrao" erro={estado.errosPorCampo.rateioGeicePadrao}>
        <input name="rateioGeicePadrao" id="rateioGeicePadrao" defaultValue={paraTexto(configuracaoAtual.rateioGeicePadrao)} className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="% Gabrielle" htmlFor="rateioGabriellePadrao" erro={estado.errosPorCampo.rateioGabriellePadrao}>
        <input name="rateioGabriellePadrao" id="rateioGabriellePadrao" defaultValue={paraTexto(configuracaoAtual.rateioGabriellePadrao)} className="rounded border px-3 py-2" />
      </Campo>
      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button type="submit" disabled={emAndamento} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        Salvar
      </button>
    </form>
  );
}
```

`src/app/(app)/configuracao/page.tsx`:
```tsx
import { exigirPapel } from '@/servidor/auth';
import { obterConfiguracao } from '@/servidor/configuracao/servico';
import { FormularioConfiguracao } from './FormularioConfiguracao';

export default async function PaginaConfiguracao() {
  await exigirPapel('admin');
  const configuracaoAtual = await obterConfiguracao();
  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Configuração</h1>
      <FormularioConfiguracao configuracaoAtual={configuracaoAtual} />
    </main>
  );
}
```

- [ ] **Passo 7: Verificação manual**

Run: `npm run dev`, entrar como Thiago (admin) em `http://localhost:3000/configuracao`, alterar os percentuais e salvar; recarregar a página e confirmar que os novos valores aparecem. Entrar como financeiro e confirmar redirecionamento/erro de acesso (a rota está protegida por `exigirPapel('admin')`, que lança `ErroPermissao`; a Tarefa 17 cuida de exibir isso de forma amigável no layout).

- [ ] **Passo 8: Commit**

```bash
git add src/servidor/configuracao src/app/\(app\)/configuracao tests/integracao/configuracao.test.ts
git commit -m "feat: tela e serviço de configuração comercial (percentual e rateio padrão)"
```

---

### Tarefa 13: Normalização de número de OS e cadastro (serviço)

**Files:**
- Create: `src/dominio/os.ts`, `src/servidor/os/servico.ts`, `tests/dominio/os.test.ts`, `tests/integracao/os-cadastro.test.ts`

**Interfaces:**
- Produces em `src/dominio/os.ts` (puro):
  - `normalizarNumeroOs(texto: string): string` — remove espaços das extremidades, maiúsculas, preserva zeros à esquerda e caracteres internos; lança `ErroValidacao` se vazio.
- Produces em `src/servidor/os/servico.ts`:
  - `interface DadosOs { numeroOs: string; cliente: string; produto: string; tipoPagamento: string; valor: Centavos; percentualComissao: Percentual; dataVenda: string; observacao: string | null; rateio: PorPessoa }`
  - `cadastrarOs(tx, dados: DadosOs, usuarioId: string): Promise<{ osId: string }>` — normaliza, valida (`valor > 0`, `dataNaoFutura` não se aplica a `dataVenda`, que pode ser passada; ver Tarefa 12 não, ver validações abaixo), `validarPesos`, insere `os` + `os_rateio`, audita, lança `ErroValidacao('Já existe uma OS com este número')` em duplicidade (`unique_violation`, código `23505`).

- [ ] **Passo 1: Teste da normalização**

`tests/dominio/os.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizarNumeroOs } from '@/dominio/os';
import { ErroValidacao } from '@/dominio/erros';

describe('normalizarNumeroOs', () => {
  it('remove espaços das pontas e coloca em maiúsculas', () => {
    expect(normalizarNumeroOs('  os-100 ')).toBe('OS-100');
  });
  it('preserva zeros à esquerda e caracteres internos', () => {
    expect(normalizarNumeroOs('OS-0007')).toBe('OS-0007');
    expect(normalizarNumeroOs('os 100/2026')).toBe('OS 100/2026');
  });
  it('rejeita vazio', () => {
    expect(() => normalizarNumeroOs('   ')).toThrow(ErroValidacao);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:dominio` → FAIL.

- [ ] **Passo 3: Implementar `dominio/os.ts`**

```ts
import { ErroValidacao } from './erros';

export function normalizarNumeroOs(texto: string): string {
  const normalizado = texto.trim().toUpperCase();
  if (normalizado === '') throw new ErroValidacao('Número da OS é obrigatório', 'numeroOs');
  return normalizado;
}
```

- [ ] **Passo 4: Rodar e ver passar** — `npm run test:dominio` → PASS.

- [ ] **Passo 5: Teste de integração do cadastro**

`tests/integracao/os-cadastro.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { cadastrarOs, type DadosOs } from '@/servidor/os/servico';
import { ErroValidacao } from '@/dominio/erros';
import { numeroOsTeste } from './ajuda';

function dados(sobrescrever: Partial<DadosOs> = {}): DadosOs {
  return {
    numeroOs: numeroOsTeste('CAD'), cliente: 'Cliente Teste', produto: 'Produto Teste',
    tipoPagamento: 'Boleto', valor: 1_000_000n, percentualComissao: 700n,
    dataVenda: '2026-09-01', observacao: null,
    rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
    ...sobrescrever,
  };
}

describe('cadastrarOs', () => {
  const criados: string[] = [];

  it('cadastra e persiste OS + rateio', async () => {
    const dadosOs = dados();
    const { osId } = await comTransacaoFinanceira((tx) => cadastrarOs(tx, dadosOs, randomUUID()));
    criados.push(osId);
    const [os] = await sql`select * from public.os where id = ${osId}`;
    const [rateio] = await sql`select * from interno.os_rateio where os_id = ${osId}`;
    expect(os.numero_os_normalizado).toBe(dadosOs.numeroOs.toUpperCase());
    expect(Number(os.valor)).toBe(10000);
    expect(Number(rateio.rateio_geice)).toBe(1);
  });

  it('rejeita número de OS duplicado (mesmo com espaços/caixa diferentes)', async () => {
    const numero = numeroOsTeste('DUP');
    const { osId } = await comTransacaoFinanceira((tx) => cadastrarOs(tx, dados({ numeroOs: numero }), randomUUID()));
    criados.push(osId);
    await expect(comTransacaoFinanceira((tx) => cadastrarOs(tx, dados({ numeroOs: `  ${numero.toLowerCase()} ` }), randomUUID())))
      .rejects.toThrow(ErroValidacao);
  });

  it('rejeita rateio cuja soma não bate com o percentual', async () => {
    await expect(comTransacaoFinanceira((tx) => cadastrarOs(tx, dados({
      rateio: { thiago: 500n, geice: 100n, gabrielle: 50n },
    }), randomUUID()))).rejects.toThrow(ErroValidacao);
  });

  afterEach(async () => {
    if (criados.length) await sql`delete from public.os where id = any(${criados})`;
    criados.length = 0;
  });
});
```

- [ ] **Passo 6: Rodar e ver falhar** — `npm run test:integracao` → FAIL.

- [ ] **Passo 7: Implementar o serviço**

`src/servidor/os/servico.ts`:
```ts
import type postgres from 'postgres';
import { normalizarNumeroOs } from '@/dominio/os';
import { paraDecimalDb, paraPercentualDb, type Centavos, type Percentual } from '@/dominio/dinheiro';
import { validarPesos, type PorPessoa } from '@/dominio/rateio';
import { ErroValidacao } from '@/dominio/erros';
import { registrarAuditoria } from '@/servidor/auditoria';

export interface DadosOs {
  numeroOs: string;
  cliente: string;
  produto: string;
  tipoPagamento: string;
  valor: Centavos;
  percentualComissao: Percentual;
  dataVenda: string;
  observacao: string | null;
  rateio: PorPessoa;
}

function ehErroUnicidade(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro && (erro as { code: string }).code === '23505';
}

export async function cadastrarOs(
  tx: postgres.TransactionSql, dados: DadosOs, usuarioId: string,
): Promise<{ osId: string }> {
  if (dados.cliente.trim() === '') throw new ErroValidacao('Cliente é obrigatório', 'cliente');
  if (dados.produto.trim() === '') throw new ErroValidacao('Produto é obrigatório', 'produto');
  validarPesos(
    { thiago: dados.rateio.thiago, geice: dados.rateio.geice, gabrielle: dados.rateio.gabrielle },
    dados.percentualComissao,
  );
  const numeroNormalizado = normalizarNumeroOs(dados.numeroOs);

  let osId: string;
  try {
    const [linha] = await tx`
      insert into public.os
        (numero_os, numero_os_normalizado, cliente, produto, tipo_pagamento, valor, percentual_comissao, data_venda, observacao, criado_por, atualizado_por)
      values
        (${dados.numeroOs.trim()}, ${numeroNormalizado}, ${dados.cliente.trim()}, ${dados.produto.trim()}, ${dados.tipoPagamento.trim()},
         ${paraDecimalDb(dados.valor)}, ${paraPercentualDb(dados.percentualComissao)}, ${dados.dataVenda}, ${dados.observacao}, ${usuarioId}, ${usuarioId})
      returning id
    `;
    osId = linha.id;
  } catch (erro) {
    if (ehErroUnicidade(erro)) throw new ErroValidacao('Já existe uma OS com este número', 'numeroOs');
    throw erro;
  }

  await tx`
    insert into interno.os_rateio (os_id, rateio_thiago, rateio_geice, rateio_gabrielle)
    values (${osId}, ${paraPercentualDb(dados.rateio.thiago)}, ${paraPercentualDb(dados.rateio.geice)}, ${paraPercentualDb(dados.rateio.gabrielle)})
  `;

  await registrarAuditoria(tx, {
    entidade: 'os', entidadeId: osId, acao: 'cadastrar', responsavelId: usuarioId,
    dataEfetiva: dados.dataVenda, valoresNovos: dados,
  });

  return { osId };
}
```

- [ ] **Passo 8: Rodar e ver passar** — `npm run test:integracao` → PASS.

- [ ] **Passo 9: Commit**

```bash
git add src/dominio/os.ts src/servidor/os/servico.ts tests/dominio/os.test.ts tests/integracao/os-cadastro.test.ts
git commit -m "feat: normalização de número de OS e cadastro com rateio"
```

---

### Tarefa 14: Consulta de OS com resumo de comissão

**Files:**
- Create: `src/servidor/os/consultas.ts`, `tests/integracao/os-consultas.test.ts`

**Interfaces:**
- Consumes: `resumoComissaoOs`, `OsParaLote` de `@/dominio/lote`; `statusRecebimento` de `@/dominio/comissao`.
- Produces:
  - `interface OsListada { id: string; numeroOs: string; cliente: string; produto: string; valor: Centavos; status: StatusRecebimento; comissaoLiberada: Centavos; comissaoDisponivel: Centavos }`
  - `listarOs(filtros: { busca?: string }): Promise<OsListada[]>` — para o papel `financeiro` (sem rateio).
  - `interface OsDetalhe extends OsListada { percentualComissao: Percentual; tipoPagamento: string; dataVenda: string; totalPagoCliente: Centavos; comissaoTotal: Centavos; primeiroEnvioEm: string | null; rateio: PorPessoa | null; baixas: { id: string; data: string; valor: Centavos }[] }`
  - `obterOsPorId(osId: string, incluirRateio: boolean): Promise<OsDetalhe | null>` — `incluirRateio` decide se a consulta faz o join com `interno.os_rateio`; quando falso, `rateio` vem `null` e a query nem toca a tabela privada.

- [ ] **Passo 1: Teste**

`tests/integracao/os-consultas.test.ts`:
```ts
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { listarOs, obterOsPorId } from '@/servidor/os/consultas';
import { numeroOsTeste } from './ajuda';

describe('consultas de OS', () => {
  const numero = numeroOsTeste('CONS');
  let osId: string;

  it('prepara uma OS com pagamento parcial', async () => {
    const r = await comTransacaoFinanceira((tx) => cadastrarOs(tx, {
      numeroOs: numero, cliente: 'Cliente Consulta', produto: 'Produto Consulta', tipoPagamento: 'Pix',
      valor: 1_000_000n, percentualComissao: 700n, dataVenda: '2026-09-01', observacao: null,
      rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
    }, randomUUID()));
    osId = r.osId;
    await sql`insert into public.baixa_cliente (os_id, data_efetiva, valor) values (${osId}, '2026-09-05', 500000.00)`;
  });

  it('listarOs traz status e comissão liberada, sem rateio', async () => {
    const lista = await listarOs({ busca: numero });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ numeroOs: numero, status: 'parcial', comissaoLiberada: 35_000n, comissaoDisponivel: 35_000n });
  });

  it('obterOsPorId sem rateio não inclui rateio', async () => {
    const detalhe = await obterOsPorId(osId, false);
    expect(detalhe?.rateio).toBeNull();
    expect(detalhe?.baixas).toHaveLength(1);
    expect(detalhe?.baixas[0].valor).toBe(500_000n);
  });

  it('obterOsPorId com rateio inclui o rateio', async () => {
    const detalhe = await obterOsPorId(osId, true);
    expect(detalhe?.rateio).toEqual({ thiago: 500n, geice: 100n, gabrielle: 100n });
  });

  it('obterOsPorId com id inexistente devolve null', async () => {
    expect(await obterOsPorId(randomUUID(), false)).toBeNull();
  });

  afterAll(async () => {
    await sql`delete from public.os where id = ${osId}`;
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:integracao` → FAIL.

- [ ] **Passo 3: Implementar**

`src/servidor/os/consultas.ts`:
```ts
import { sql } from '@/servidor/db';
import { parseDecimal, parsePercentual, type Centavos, type Percentual } from '@/dominio/dinheiro';
import { statusRecebimento, type StatusRecebimento, comissaoTotal as calcularComissaoTotal } from '@/dominio/comissao';
import { resumoComissaoOs } from '@/dominio/lote';
import type { PorPessoa } from '@/dominio/rateio';

export interface OsListada {
  id: string;
  numeroOs: string;
  cliente: string;
  produto: string;
  valor: Centavos;
  status: StatusRecebimento;
  comissaoLiberada: Centavos;
  comissaoDisponivel: Centavos;
}

interface LinhaOsBase {
  id: string; numero_os: string; cliente: string; produto: string;
  valor: string; percentual_comissao: string; total_pago: string | null; comprometido: string | null;
}

function paraListada(linha: LinhaOsBase): OsListada {
  const valor = parseDecimal(linha.valor);
  const totalPago = parseDecimal(linha.total_pago ?? '0');
  const resumo = resumoComissaoOs({
    osId: linha.id, numeroOs: linha.numero_os, numeroOsNormalizado: linha.numero_os, cliente: linha.cliente, produto: linha.produto,
    valorOs: valor, percentualComissao: parsePercentual(linha.percentual_comissao), totalPagoCliente: totalPago,
    reservasAtivas: [], pesos: { thiago: 0n, geice: 0n, gabrielle: 0n },
  });
  // comprometido (soma já reservada em lotes) é somado à parte pois o resumo acima não tem acesso às reservas reais.
  const comprometido = parseDecimal(linha.comprometido ?? '0');
  return {
    id: linha.id, numeroOs: linha.numero_os, cliente: linha.cliente, produto: linha.produto, valor,
    status: statusRecebimento(totalPago, valor),
    comissaoLiberada: resumo.comissaoLiberada,
    comissaoDisponivel: resumo.comissaoLiberada - comprometido,
  };
}

const SELECT_BASE = sql`
  select o.id, o.numero_os, o.cliente, o.produto, o.valor, o.percentual_comissao,
    (select coalesce(sum(b.valor), 0) from public.baixa_cliente b where b.os_id = o.id) as total_pago,
    (select coalesce(sum(li.valor_comissao), 0) from public.lote_item li
       join public.lote_financeiro lf on lf.id = li.lote_id
       where li.os_id = o.id and lf.estado_conferencia <> 'cancelado') as comprometido
  from public.os o
`;

export async function listarOs(filtros: { busca?: string } = {}): Promise<OsListada[]> {
  const busca = filtros.busca?.trim();
  const linhas = busca
    ? await sql`${SELECT_BASE} where o.numero_os_normalizado ilike ${'%' + busca.toUpperCase() + '%'}
        or o.cliente ilike ${'%' + busca + '%'} or o.produto ilike ${'%' + busca + '%'}
        order by o.data_venda desc`
    : await sql`${SELECT_BASE} order by o.data_venda desc`;
  return linhas.map(paraListada);
}

export interface OsDetalhe extends OsListada {
  percentualComissao: Percentual;
  tipoPagamento: string;
  dataVenda: string;
  totalPagoCliente: Centavos;
  comissaoTotal: Centavos;
  primeiroEnvioEm: string | null;
  rateio: PorPessoa | null;
  baixas: { id: string; data: string; valor: Centavos }[];
}

export async function obterOsPorId(osId: string, incluirRateio: boolean): Promise<OsDetalhe | null> {
  const [linha] = await sql`${SELECT_BASE}
    , o.tipo_pagamento, o.data_venda, o.primeiro_envio_em
    where o.id = ${osId}`;
  if (!linha) return null;

  let rateio: PorPessoa | null = null;
  if (incluirRateio) {
    const [r] = await sql`select rateio_thiago, rateio_geice, rateio_gabrielle from interno.os_rateio where os_id = ${osId}`;
    if (r) rateio = { thiago: parsePercentual(r.rateio_thiago), geice: parsePercentual(r.rateio_geice), gabrielle: parsePercentual(r.rateio_gabrielle) };
  }

  const baixas = await sql`select id, data_efetiva, valor from public.baixa_cliente where os_id = ${osId} order by data_efetiva`;
  const base = paraListada(linha);

  return {
    ...base,
    percentualComissao: parsePercentual(linha.percentual_comissao),
    tipoPagamento: linha.tipo_pagamento,
    dataVenda: linha.data_venda,
    totalPagoCliente: parseDecimal(linha.total_pago ?? '0'),
    comissaoTotal: calcularComissaoTotal(base.valor, parsePercentual(linha.percentual_comissao)),
    primeiroEnvioEm: linha.primeiro_envio_em,
    rateio,
    baixas: baixas.map((b) => ({ id: b.id, data: b.data_efetiva, valor: parseDecimal(b.valor) })),
  };
}
```

- [ ] **Passo 4: Rodar e ver passar** — `npm run test:integracao` → PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/servidor/os/consultas.ts tests/integracao/os-consultas.test.ts
git commit -m "feat: consultas de OS com status, comissão liberada/disponível e rateio opcional"
```

---

### Tarefa 15: Server action de cadastro de OS e telas (lista, nova, detalhe)

**Files:**
- Create: `src/servidor/os/acoes.ts`, `src/app/(app)/os/page.tsx`, `src/app/(app)/os/nova/page.tsx`, `src/app/(app)/os/FormularioOs.tsx`, `src/app/(app)/os/[id]/page.tsx`

**Interfaces:**
- Consumes: `cadastrarOs`, `listarOs`, `obterOsPorId`, `exigirSessao`, `exigirPapel`, `obterConfiguracao`, `comTransacaoFinanceira`, `tratarErroFormulario`.
- Produces: server action `cadastrarOsAction(estadoAnterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>` (só `admin`; em sucesso usa `redirect` do Next para `/os/[id]`).

- [ ] **Passo 1: Server action**

`src/servidor/os/acoes.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import { cadastrarOs } from './servico';
import { parseDecimal, parsePercentual } from '@/dominio/dinheiro';
import { validarDataIso } from '@/dominio/datas';
import { tratarErroFormulario, ESTADO_INICIAL_FORMULARIO, type EstadoFormulario } from '@/servidor/formularios';

export async function cadastrarOsAction(
  _estadoAnterior: EstadoFormulario, formData: FormData,
): Promise<EstadoFormulario> {
  let osId: string;
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
    const resultado = await comTransacaoFinanceira((tx) => cadastrarOs(tx, dados, sessao.userId));
    osId = resultado.osId;
  } catch (erro) {
    return tratarErroFormulario(erro);
  }
  redirect(`/os/${osId}`);
}
```

- [ ] **Passo 2: Formulário (componente compartilhado entre nova OS e — em fase futura — edição)**

`src/app/(app)/os/FormularioOs.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { cadastrarOsAction } from '@/servidor/os/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';
import { formatarPercentual, type Percentual } from '@/dominio/dinheiro';
import { Campo } from '@/componentes/Campo';

function paraTexto(p: Percentual): string {
  return formatarPercentual(p).replace('%', '');
}

export function FormularioOs({ configuracaoAtual }: {
  configuracaoAtual: { percentualComissaoPadrao: Percentual; rateioThiagoPadrao: Percentual; rateioGeicePadrao: Percentual; rateioGabriellePadrao: Percentual };
}) {
  const [estado, acao, emAndamento] = useActionState(cadastrarOsAction, ESTADO_INICIAL_FORMULARIO);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <form action={acao} className="flex max-w-lg flex-col gap-4">
      <Campo label="Número da OS" htmlFor="numeroOs" erro={estado.errosPorCampo.numeroOs}>
        <input name="numeroOs" id="numeroOs" required className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="Cliente" htmlFor="cliente" erro={estado.errosPorCampo.cliente}>
        <input name="cliente" id="cliente" required className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="Produto" htmlFor="produto" erro={estado.errosPorCampo.produto}>
        <input name="produto" id="produto" required className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="Tipo de pagamento" htmlFor="tipoPagamento" erro={estado.errosPorCampo.tipoPagamento}>
        <input name="tipoPagamento" id="tipoPagamento" className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="Valor (R$)" htmlFor="valor" erro={estado.errosPorCampo.valor}>
        <input name="valor" id="valor" required placeholder="0,00" className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="Data da venda" htmlFor="dataVenda" erro={estado.errosPorCampo.dataVenda}>
        <input type="date" name="dataVenda" id="dataVenda" defaultValue={hoje} required className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="% comissão total" htmlFor="percentualComissao" erro={estado.errosPorCampo.percentualComissao}>
        <input name="percentualComissao" id="percentualComissao" defaultValue={paraTexto(configuracaoAtual.percentualComissaoPadrao)} required className="rounded border px-3 py-2" />
      </Campo>
      <div className="grid grid-cols-3 gap-2">
        <Campo label="% Thiago" htmlFor="rateioThiago" erro={estado.errosPorCampo.rateioThiago}>
          <input name="rateioThiago" id="rateioThiago" defaultValue={paraTexto(configuracaoAtual.rateioThiagoPadrao)} className="rounded border px-3 py-2" />
        </Campo>
        <Campo label="% Geice" htmlFor="rateioGeice" erro={estado.errosPorCampo.rateioGeice}>
          <input name="rateioGeice" id="rateioGeice" defaultValue={paraTexto(configuracaoAtual.rateioGeicePadrao)} className="rounded border px-3 py-2" />
        </Campo>
        <Campo label="% Gabrielle" htmlFor="rateioGabrielle" erro={estado.errosPorCampo.rateioGabrielle}>
          <input name="rateioGabrielle" id="rateioGabrielle" defaultValue={paraTexto(configuracaoAtual.rateioGabriellePadrao)} className="rounded border px-3 py-2" />
        </Campo>
      </div>
      <Campo label="Observação" htmlFor="observacao">
        <textarea name="observacao" id="observacao" className="rounded border px-3 py-2" />
      </Campo>
      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button type="submit" disabled={emAndamento} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        Cadastrar OS
      </button>
    </form>
  );
}
```

- [ ] **Passo 3: Página de nova OS**

`src/app/(app)/os/nova/page.tsx`:
```tsx
import { exigirPapel } from '@/servidor/auth';
import { obterConfiguracao } from '@/servidor/configuracao/servico';
import { FormularioOs } from '../FormularioOs';

export default async function PaginaNovaOs() {
  await exigirPapel('admin');
  const configuracaoAtual = await obterConfiguracao();
  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Nova OS</h1>
      <FormularioOs configuracaoAtual={configuracaoAtual} />
    </main>
  );
}
```

- [ ] **Passo 4: Página de lista**

`src/app/(app)/os/page.tsx`:
```tsx
import Link from 'next/link';
import { exigirSessao } from '@/servidor/auth';
import { listarOs } from '@/servidor/os/consultas';
import { formatarBRL } from '@/dominio/dinheiro';

const RUBRICA_STATUS: Record<string, string> = { aberta: 'Aberta', parcial: 'Parcial', quitada: 'Quitada' };

export default async function PaginaListaOs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sessao = await exigirSessao();
  const { q } = await searchParams;
  const lista = await listarOs({ busca: q });

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ordens de serviço</h1>
        {sessao.papel === 'admin' && (
          <Link href="/os/nova" className="rounded bg-blue-600 px-4 py-2 text-white">Nova OS</Link>
        )}
      </div>
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Buscar por número, cliente ou produto" className="w-80 rounded border px-3 py-2" />
      </form>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Número</th><th>Cliente</th><th>Produto</th><th>Valor</th><th>Status</th><th>Comissão disponível</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((os) => (
            <tr key={os.id} className="border-b">
              <td className="py-2"><Link href={`/os/${os.id}`} className="text-blue-600 underline">{os.numeroOs}</Link></td>
              <td>{os.cliente}</td>
              <td>{os.produto}</td>
              <td>{formatarBRL(os.valor)}</td>
              <td>{RUBRICA_STATUS[os.status]}</td>
              <td>{formatarBRL(os.comissaoDisponivel)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lista.length === 0 && <p className="mt-4 text-gray-500">Nenhuma OS encontrada.</p>}
    </main>
  );
}
```

- [ ] **Passo 5: Página de detalhe**

`src/app/(app)/os/[id]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/servidor/auth';
import { obterOsPorId } from '@/servidor/os/consultas';
import { formatarBRL, formatarPercentual } from '@/dominio/dinheiro';
import { formatarDataBr } from '@/dominio/datas';

export default async function PaginaDetalheOs({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao();
  const { id } = await params;
  const os = await obterOsPorId(id, sessao.papel === 'admin');
  if (!os) notFound();

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">OS {os.numeroOs}</h1>
      <p className="mb-4 text-gray-600">{os.cliente} — {os.produto}</p>
      <dl className="mb-6 grid max-w-md grid-cols-2 gap-y-2 text-sm">
        <dt className="text-gray-500">Valor</dt><dd>{formatarBRL(os.valor)}</dd>
        <dt className="text-gray-500">Data da venda</dt><dd>{formatarDataBr(os.dataVenda)}</dd>
        <dt className="text-gray-500">% comissão</dt><dd>{formatarPercentual(os.percentualComissao)}</dd>
        <dt className="text-gray-500">Total pago pelo cliente</dt><dd>{formatarBRL(os.totalPagoCliente)}</dd>
        <dt className="text-gray-500">Comissão total</dt><dd>{formatarBRL(os.comissaoTotal)}</dd>
        <dt className="text-gray-500">Comissão liberada</dt><dd>{formatarBRL(os.comissaoLiberada)}</dd>
        <dt className="text-gray-500">Comissão disponível p/ lote</dt><dd>{formatarBRL(os.comissaoDisponivel)}</dd>
        {os.rateio && (
          <>
            <dt className="text-gray-500">Rateio</dt>
            <dd>Thiago {formatarPercentual(os.rateio.thiago)} / Geice {formatarPercentual(os.rateio.geice)} / Gabrielle {formatarPercentual(os.rateio.gabrielle)}</dd>
          </>
        )}
      </dl>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Pagamentos do cliente</h2>
          {sessao.papel === 'admin' && (
            <Link href={`/os/${os.id}/baixas/nova`} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Registrar pagamento</Link>
          )}
        </div>
        <ul className="text-sm">
          {os.baixas.map((b) => (
            <li key={b.id} className="border-b py-1">{formatarDataBr(b.data)} — {formatarBRL(b.valor)}</li>
          ))}
          {os.baixas.length === 0 && <li className="text-gray-500">Nenhum pagamento registrado ainda.</li>}
        </ul>
      </div>
    </main>
  );
}
```

- [ ] **Passo 6: Verificação manual**

Run: `npm run dev`. Como admin: cadastrar uma OS em `/os/nova`, confirmar redirecionamento para `/os/[id]` com os dados corretos, voltar em `/os` e confirmar que ela aparece na lista com status "Aberta". Como financeiro: confirmar que a página de detalhe não mostra a seção de rateio e que não há link "Nova OS"/"Registrar pagamento".

- [ ] **Passo 7: Commit**

```bash
git add src/servidor/os/acoes.ts src/app/\(app\)/os
git commit -m "feat: telas de cadastro, lista e detalhe de OS"
```

---

### Tarefa 16: Baixas do cliente (serviço, ação e tela)

**Files:**
- Create: `src/servidor/baixas/servico.ts`, `src/servidor/baixas/acoes.ts`, `src/app/(app)/os/[id]/baixas/nova/page.tsx`, `src/app/(app)/os/[id]/baixas/nova/FormularioBaixa.tsx`, `tests/integracao/baixas.test.ts`

**Interfaces:**
- Consumes: `sql`, `comTransacaoFinanceira`, `registrarAuditoria`, `parseDecimal`, `paraDecimalDb`, `dataNaoFutura`.
- Produces:
  - `registrarBaixaCliente(tx, dados: { osId: string; data: string; valor: Centavos; observacao: string | null }, usuarioId: string): Promise<{ baixaId: string }>` — lê `os.valor` e a soma das baixas existentes **com `for update` na linha da OS** (dentro da transação, que já está sob o bloqueio global — o `for update` aqui documenta a intenção e protege mesmo se o bloqueio global for relaxado no futuro), valida `0 < valor` e `totalPago + valor <= os.valor` (lança `ErroValidacao('O pagamento ultrapassa o valor da OS')`), insere a baixa, audita.
  - Server action `registrarBaixaAction(estadoAnterior, formData): Promise<EstadoFormulario>` — só `admin`; sucesso redireciona para `/os/[id]`.

- [ ] **Passo 1: Teste de integração**

`tests/integracao/baixas.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { ErroValidacao } from '@/dominio/erros';
import { numeroOsTeste } from './ajuda';

async function osDeTeste(valor = 1_000_000n) {
  const { osId } = await comTransacaoFinanceira((tx) => cadastrarOs(tx, {
    numeroOs: numeroOsTeste('BAIXA'), cliente: 'Cliente Baixa', produto: 'Produto Baixa', tipoPagamento: 'Pix',
    valor, percentualComissao: 700n, dataVenda: '2026-09-01', observacao: null,
    rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
  }, randomUUID()));
  return osId;
}

describe('registrarBaixaCliente', () => {
  const criadas: string[] = [];

  it('registra um pagamento parcial', async () => {
    const osId = await osDeTeste();
    criadas.push(osId);
    const { baixaId } = await comTransacaoFinanceira((tx) =>
      registrarBaixaCliente(tx, { osId, data: '2026-09-05', valor: 500_000n, observacao: null }, randomUUID()));
    const [linha] = await sql`select valor from public.baixa_cliente where id = ${baixaId}`;
    expect(Number(linha.valor)).toBe(5000);
  });

  it('rejeita pagamento que ultrapassa o valor da OS', async () => {
    const osId = await osDeTeste(100_000n);
    criadas.push(osId);
    await comTransacaoFinanceira((tx) => registrarBaixaCliente(tx, { osId, data: '2026-09-05', valor: 60_000n, observacao: null }, randomUUID()));
    await expect(comTransacaoFinanceira((tx) =>
      registrarBaixaCliente(tx, { osId, data: '2026-09-06', valor: 50_000n, observacao: null }, randomUUID())))
      .rejects.toThrow(ErroValidacao);
  });

  it('rejeita valor zero ou negativo e data futura', async () => {
    const osId = await osDeTeste();
    criadas.push(osId);
    await expect(comTransacaoFinanceira((tx) => registrarBaixaCliente(tx, { osId, data: '2026-09-05', valor: 0n, observacao: null }, randomUUID())))
      .rejects.toThrow(ErroValidacao);
    await expect(comTransacaoFinanceira((tx) => registrarBaixaCliente(tx, { osId, data: '2999-01-01', valor: 1000n, observacao: null }, randomUUID())))
      .rejects.toThrow(ErroValidacao);
  });

  afterEach(async () => {
    if (criadas.length) await sql`delete from public.os where id = any(${criadas})`;
    criadas.length = 0;
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:integracao` → FAIL.

- [ ] **Passo 3: Implementar o serviço**

`src/servidor/baixas/servico.ts`:
```ts
import type postgres from 'postgres';
import { paraDecimalDb, parseDecimal, type Centavos } from '@/dominio/dinheiro';
import { dataNaoFutura } from '@/dominio/datas';
import { ErroValidacao } from '@/dominio/erros';
import { registrarAuditoria } from '@/servidor/auditoria';

export interface DadosBaixaCliente {
  osId: string;
  data: string;
  valor: Centavos;
  observacao: string | null;
}

export async function registrarBaixaCliente(
  tx: postgres.TransactionSql, dados: DadosBaixaCliente, usuarioId: string,
): Promise<{ baixaId: string }> {
  if (dados.valor <= 0n) throw new ErroValidacao('O valor deve ser maior que zero', 'valor');
  const dataEfetiva = dataNaoFutura(dados.data, 'data');

  const [os] = await tx`select valor from public.os where id = ${dados.osId} for update`;
  if (!os) throw new ErroValidacao('OS não encontrada', 'osId');
  const valorOs = parseDecimal(os.valor);

  const [{ total }] = await tx`select coalesce(sum(valor), 0) as total from public.baixa_cliente where os_id = ${dados.osId}`;
  const totalPago = parseDecimal(String(total));

  if (totalPago + dados.valor > valorOs) {
    throw new ErroValidacao('O pagamento ultrapassa o valor da OS', 'valor');
  }

  const [linha] = await tx`
    insert into public.baixa_cliente (os_id, data_efetiva, valor, observacao, criado_por)
    values (${dados.osId}, ${dataEfetiva}, ${paraDecimalDb(dados.valor)}, ${dados.observacao}, ${usuarioId})
    returning id
  `;

  await registrarAuditoria(tx, {
    entidade: 'baixa_cliente', entidadeId: linha.id, acao: 'registrar', responsavelId: usuarioId,
    dataEfetiva, valoresNovos: { osId: dados.osId, valor: dados.valor },
  });

  return { baixaId: linha.id };
}
```

- [ ] **Passo 4: Rodar e ver passar** — `npm run test:integracao` → PASS.

- [ ] **Passo 5: Server action**

`src/servidor/baixas/acoes.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import { registrarBaixaCliente } from './servico';
import { parseDecimal } from '@/dominio/dinheiro';
import { tratarErroFormulario, type EstadoFormulario } from '@/servidor/formularios';

export async function registrarBaixaAction(
  _estadoAnterior: EstadoFormulario, formData: FormData,
): Promise<EstadoFormulario> {
  const osId = String(formData.get('osId'));
  try {
    const sessao = await exigirPapel('admin');
    await comTransacaoFinanceira((tx) => registrarBaixaCliente(tx, {
      osId,
      data: String(formData.get('data') ?? ''),
      valor: parseDecimal(String(formData.get('valor') ?? '')),
      observacao: String(formData.get('observacao') ?? '').trim() || null,
    }, sessao.userId));
  } catch (erro) {
    return tratarErroFormulario(erro);
  }
  redirect(`/os/${osId}`);
}
```

- [ ] **Passo 6: Tela**

`src/app/(app)/os/[id]/baixas/nova/FormularioBaixa.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { registrarBaixaAction } from '@/servidor/baixas/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';
import { Campo } from '@/componentes/Campo';

export function FormularioBaixa({ osId }: { osId: string }) {
  const [estado, acao, emAndamento] = useActionState(registrarBaixaAction, ESTADO_INICIAL_FORMULARIO);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <form action={acao} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="osId" value={osId} />
      <Campo label="Data do pagamento" htmlFor="data" erro={estado.errosPorCampo.data}>
        <input type="date" name="data" id="data" defaultValue={hoje} required className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="Valor pago (R$)" htmlFor="valor" erro={estado.errosPorCampo.valor}>
        <input name="valor" id="valor" required placeholder="0,00" className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="Observação" htmlFor="observacao">
        <input name="observacao" id="observacao" className="rounded border px-3 py-2" />
      </Campo>
      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button type="submit" disabled={emAndamento} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        Registrar pagamento
      </button>
    </form>
  );
}
```

`src/app/(app)/os/[id]/baixas/nova/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { exigirPapel } from '@/servidor/auth';
import { obterOsPorId } from '@/servidor/os/consultas';
import { FormularioBaixa } from './FormularioBaixa';

export default async function PaginaNovaBaixa({ params }: { params: Promise<{ id: string }> }) {
  await exigirPapel('admin');
  const { id } = await params;
  const os = await obterOsPorId(id, false);
  if (!os) notFound();

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Registrar pagamento — OS {os.numeroOs}</h1>
      <p className="mb-4 text-gray-600">Já pago: {os.totalPagoCliente > 0n ? 'sim' : 'não'} — saldo restante contra o valor total da OS.</p>
      <FormularioBaixa osId={os.id} />
    </main>
  );
}
```

- [ ] **Passo 7: Verificação manual**

Run: `npm run dev`. Cadastrar uma OS, registrar um pagamento parcial, confirmar na tela de detalhe que a comissão liberada e disponível aumentaram proporcionalmente. Tentar registrar um pagamento que ultrapasse o saldo e confirmar a mensagem de erro no formulário (sem recarregar a página).

- [ ] **Passo 8: Commit**

```bash
git add src/servidor/baixas src/app/\(app\)/os/\[id\]/baixas tests/integracao/baixas.test.ts
git commit -m "feat: registro de pagamentos do cliente com validação de saldo"
```

---

### Tarefa 17: Serviço de lotes — prévia e geração

**Files:**
- Create: `src/servidor/lotes/servico.ts`, `tests/integracao/lotes-gerar.test.ts`

**Interfaces:**
- Consumes: `calcularItensLote`, `totalItens`, `OsParaLote` de `@/dominio/lote`; `comTransacaoFinanceira`; `registrarAuditoria`; `VERSAO_CALCULO`.
- Produces:
  - `carregarOsParaLote(tx, osIds: string[]): Promise<OsParaLote[]>` — busca `os` + `os_rateio` + soma de baixas + reservas ativas (`lote_item` de lotes com `estado_conferencia <> 'cancelado'`) das OS informadas, com `for update` nas linhas de `os`.
  - `gerarLote(tx, dados: { osIds: string[]; observacao: string | null }, usuarioId: string): Promise<{ loteId: string; numero: number; valorTotal: Centavos }>` — chama `carregarOsParaLote`, `calcularItensLote`, insere `lote_financeiro` (`estado_conferencia = 'enviado'`, `data_envio = hojeNegocio()`), os `lote_item` e `lote_item_rateio`, atualiza `os.primeiro_envio_em` quando nulo, audita. Lança `ErroValidacao('Selecione ao menos uma OS')` se `osIds` vazio.

- [ ] **Passo 1: Teste de integração**

`tests/integracao/lotes-gerar.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { ErroValidacao } from '@/dominio/erros';
import { numeroOsTeste } from './ajuda';

async function osComPagamento(percentualPago: number) {
  const { osId } = await comTransacaoFinanceira((tx) => cadastrarOs(tx, {
    numeroOs: numeroOsTeste('LOTE'), cliente: 'Cliente Lote', produto: 'Produto Lote', tipoPagamento: 'Pix',
    valor: 1_000_000n, percentualComissao: 700n, dataVenda: '2026-09-01', observacao: null,
    rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
  }, randomUUID()));
  if (percentualPago > 0) {
    await comTransacaoFinanceira((tx) => registrarBaixaCliente(tx, {
      osId, data: '2026-09-05', valor: BigInt(Math.round(1_000_000 * percentualPago)), observacao: null,
    }, randomUUID()));
  }
  return osId;
}

describe('gerarLote', () => {
  const criadas: string[] = [];

  it('gera um lote com o trecho liberado, rateado 250/50/50 para R$ 350 liberados', async () => {
    const osId = await osComPagamento(0.5);
    criadas.push(osId);
    const resultado = await comTransacaoFinanceira((tx) => gerarLote(tx, { osIds: [osId], observacao: null }, randomUUID()));
    expect(resultado.valorTotal).toBe(35_000n);

    const [lote] = await sql`select estado_conferencia, data_envio from public.lote_financeiro where id = ${resultado.loteId}`;
    expect(lote.estado_conferencia).toBe('enviado');
    expect(lote.data_envio).not.toBeNull();

    const [item] = await sql`select * from public.lote_item where lote_id = ${resultado.loteId}`;
    expect(Number(item.valor_comissao)).toBe(350);
    const [rateio] = await sql`select * from interno.lote_item_rateio where lote_item_id = ${item.id}`;
    expect(Number(rateio.valor_thiago)).toBe(250);
    expect(Number(rateio.valor_geice)).toBe(50);
    expect(Number(rateio.valor_gabrielle)).toBe(50);

    const [os] = await sql`select primeiro_envio_em from public.os where id = ${osId}`;
    expect(os.primeiro_envio_em).not.toBeNull();
  });

  it('um segundo envio da mesma OS só reserva o trecho novo', async () => {
    const osId = await osComPagamento(0.5);
    criadas.push(osId);
    await comTransacaoFinanceira((tx) => gerarLote(tx, { osIds: [osId], observacao: null }, randomUUID()));
    await comTransacaoFinanceira((tx) => registrarBaixaCliente(tx, { osId, data: '2026-09-10', valor: 500_000n, observacao: null }, randomUUID()));
    const segundo = await comTransacaoFinanceira((tx) => gerarLote(tx, { osIds: [osId], observacao: null }, randomUUID()));
    expect(segundo.valorTotal).toBe(35_000n);
  });

  it('rejeita OS sem comissão disponível', async () => {
    const osId = await osComPagamento(0);
    criadas.push(osId);
    await expect(comTransacaoFinanceira((tx) => gerarLote(tx, { osIds: [osId], observacao: null }, randomUUID())))
      .rejects.toThrow(ErroValidacao);
  });

  it('rejeita lista vazia', async () => {
    await expect(comTransacaoFinanceira((tx) => gerarLote(tx, { osIds: [], observacao: null }, randomUUID())))
      .rejects.toThrow(ErroValidacao);
  });

  afterEach(async () => {
    if (criadas.length) await sql`delete from public.os where id = any(${criadas})`;
    criadas.length = 0;
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:integracao` → FAIL.

- [ ] **Passo 3: Implementar**

`src/servidor/lotes/servico.ts`:
```ts
import type postgres from 'postgres';
import {
  calcularItensLote, totalItens, VERSAO_CALCULO, type OsParaLote,
} from '@/dominio/lote';
import { paraDecimalDb, paraPercentualDb, parseDecimal, parsePercentual, type Centavos } from '@/dominio/dinheiro';
import { hojeNegocio } from '@/dominio/datas';
import { ErroValidacao } from '@/dominio/erros';
import { registrarAuditoria } from '@/servidor/auditoria';

export async function carregarOsParaLote(tx: postgres.TransactionSql, osIds: string[]): Promise<OsParaLote[]> {
  if (osIds.length === 0) return [];
  const linhas = await tx`
    select o.id, o.numero_os, o.numero_os_normalizado, o.cliente, o.produto, o.valor, o.percentual_comissao,
      r.rateio_thiago, r.rateio_geice, r.rateio_gabrielle,
      coalesce((select sum(b.valor) from public.baixa_cliente b where b.os_id = o.id), 0) as total_pago,
      coalesce((
        select json_agg(json_build_object('inicio', li.inicio_centavo, 'fim', li.fim_centavo))
        from public.lote_item li
        join public.lote_financeiro lf on lf.id = li.lote_id
        where li.os_id = o.id and lf.estado_conferencia <> 'cancelado'
      ), '[]') as reservas
    from public.os o
    join interno.os_rateio r on r.os_id = o.id
    where o.id = any(${osIds})
    for update of o
  `;
  return linhas.map((l) => ({
    osId: l.id,
    numeroOs: l.numero_os,
    numeroOsNormalizado: l.numero_os_normalizado,
    cliente: l.cliente,
    produto: l.produto,
    valorOs: parseDecimal(l.valor),
    percentualComissao: parsePercentual(l.percentual_comissao),
    totalPagoCliente: parseDecimal(String(l.total_pago)),
    reservasAtivas: (l.reservas as { inicio: number; fim: number }[]).map((r) => ({ inicio: BigInt(r.inicio), fim: BigInt(r.fim) })),
    pesos: { thiago: parsePercentual(l.rateio_thiago), geice: parsePercentual(l.rateio_geice), gabrielle: parsePercentual(l.rateio_gabrielle) },
  }));
}

export async function gerarLote(
  tx: postgres.TransactionSql, dados: { osIds: string[]; observacao: string | null }, usuarioId: string,
): Promise<{ loteId: string; numero: number; valorTotal: Centavos }> {
  if (dados.osIds.length === 0) throw new ErroValidacao('Selecione ao menos uma OS');

  const oss = await carregarOsParaLote(tx, dados.osIds);
  const itens = calcularItensLote(oss);
  const valorTotal = totalItens(itens);
  const dataEnvio = hojeNegocio();

  const [lote] = await tx`
    insert into public.lote_financeiro (estado_conferencia, data_envio, enviado_em, enviado_por, valor_total_original, observacao, criado_por, atualizado_por)
    values ('enviado', ${dataEnvio}, now(), ${usuarioId}, ${paraDecimalDb(valorTotal)}, ${dados.observacao}, ${usuarioId}, ${usuarioId})
    returning id, numero
  `;

  for (const item of itens) {
    const [linhaItem] = await tx`
      insert into public.lote_item
        (lote_id, os_id, ordem, inicio_centavo, fim_centavo, valor_comissao,
         numero_os_snapshot, cliente_snapshot, produto_snapshot, valor_os_snapshot, percentual_comissao_snapshot,
         total_pago_cliente_snapshot, comissao_liberada_snapshot, comissao_comprometida_anterior_snapshot, versao_calculo)
      values
        (${lote.id}, ${item.osId}, ${item.ordem}, ${item.inicio}, ${item.fim}, ${paraDecimalDb(item.valorComissao)},
         ${item.snapshot.numeroOs}, ${item.snapshot.cliente}, ${item.snapshot.produto}, ${paraDecimalDb(item.snapshot.valorOs)},
         ${paraPercentualDb(item.snapshot.percentualComissao)}, ${paraDecimalDb(item.snapshot.totalPagoCliente)},
         ${paraDecimalDb(item.snapshot.comissaoLiberada)}, ${paraDecimalDb(item.snapshot.comissaoComprometidaAnterior)}, ${VERSAO_CALCULO})
      returning id
    `;
    await tx`
      insert into interno.lote_item_rateio (lote_item_id, valor_thiago, valor_geice, valor_gabrielle, rateio_thiago, rateio_geice, rateio_gabrielle)
      values (${linhaItem.id}, ${paraDecimalDb(item.rateio.thiago)}, ${paraDecimalDb(item.rateio.geice)}, ${paraDecimalDb(item.rateio.gabrielle)},
              ${paraPercentualDb(oss.find((o) => o.osId === item.osId)!.pesos.thiago)},
              ${paraPercentualDb(oss.find((o) => o.osId === item.osId)!.pesos.geice)},
              ${paraPercentualDb(oss.find((o) => o.osId === item.osId)!.pesos.gabrielle)})
    `;
  }

  await tx`update public.os set primeiro_envio_em = coalesce(primeiro_envio_em, now()) where id = any(${dados.osIds})`;

  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro', entidadeId: lote.id, acao: 'gerar', responsavelId: usuarioId,
    dataEfetiva: dataEnvio, valoresNovos: { osIds: dados.osIds, valorTotal, quantidadeItens: itens.length },
  });

  return { loteId: lote.id, numero: Number(lote.numero), valorTotal };
}
```

- [ ] **Passo 4: Rodar e ver passar** — `npm run test:integracao` → PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/servidor/lotes/servico.ts tests/integracao/lotes-gerar.test.ts
git commit -m "feat: geração de lote com reservas, snapshots e rateio congelado"
```

---

### Tarefa 18: Consultas de lote e mudança de estado de conferência

**Files:**
- Create: `src/servidor/lotes/consultas.ts`, `src/servidor/lotes/acoes.ts`, `tests/integracao/lotes-consultas.test.ts`

**Interfaces:**
- Produces em `consultas.ts`:
  - `interface LoteListado { id: string; numero: number; estadoConferencia: string; dataEnvio: string | null; valorTotal: Centavos }`
  - `listarLotes(): Promise<LoteListado[]>`
  - `interface ItemLote { id: string; ordem: number; numeroOsSnapshot: string; clienteSnapshot: string; produtoSnapshot: string; valorComissao: Centavos; rateio: PorPessoa | null }`
  - `interface LoteDetalhe extends LoteListado { observacao: string | null; itens: ItemLote[] }`
  - `obterLotePorId(loteId: string, incluirRateio: boolean): Promise<LoteDetalhe | null>`
- Produces em `acoes.ts`:
  - `aprovarLoteAction(loteId: string): Promise<void>` (server action simples, sem `useActionState`, chamada por um `<form action={...}>` com `bind`) — só `admin`; exige `estado_conferencia = 'enviado'`; lança `ErroValidacao` fora disso; grava `aprovado_em/por`, muda estado, audita, `revalidatePath`.
- **Fora desta tarefa (e desta fase):** `lote_financeiro.estado_conferencia` só tem `'rascunho'|'enviado'|'aprovado'|'cancelado'` (sem `'pago'`) — a spec (§8) trata o pagamento efetivo via `recebimento_financeiro` confirmado, que é Fase 2. A Fase 1 vai até `aprovado`; não há `marcarLotePagoAction` nesta tarefa.

- [ ] **Passo 1: Teste de integração**

`tests/integracao/lotes-consultas.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, comTransacaoFinanceira } from '@/servidor/db';
import { cadastrarOs } from '@/servidor/os/servico';
import { registrarBaixaCliente } from '@/servidor/baixas/servico';
import { gerarLote } from '@/servidor/lotes/servico';
import { listarLotes, obterLotePorId } from '@/servidor/lotes/consultas';
import { aprovarLote } from '@/servidor/lotes/servico';
import { ErroValidacao } from '@/dominio/erros';
import { numeroOsTeste } from './ajuda';

describe('consultas e conferência de lote', () => {
  const criadas: string[] = [];
  let loteId: string;

  it('prepara um lote enviado', async () => {
    const { osId } = await comTransacaoFinanceira((tx) => cadastrarOs(tx, {
      numeroOs: numeroOsTeste('LOTECONS'), cliente: 'Cliente X', produto: 'Produto Y', tipoPagamento: 'Pix',
      valor: 1_000_000n, percentualComissao: 700n, dataVenda: '2026-09-01', observacao: null,
      rateio: { thiago: 500n, geice: 100n, gabrielle: 100n },
    }, randomUUID()));
    criadas.push(osId);
    await comTransacaoFinanceira((tx) => registrarBaixaCliente(tx, { osId, data: '2026-09-05', valor: 1_000_000n, observacao: null }, randomUUID()));
    const r = await comTransacaoFinanceira((tx) => gerarLote(tx, { osIds: [osId], observacao: 'lote de teste' }, randomUUID()));
    loteId = r.loteId;
  });

  it('listarLotes traz o lote enviado', async () => {
    const lista = await listarLotes();
    expect(lista.find((l) => l.id === loteId)).toMatchObject({ estadoConferencia: 'enviado', valorTotal: 70_000n });
  });

  it('obterLotePorId sem rateio omite o rateio dos itens', async () => {
    const detalhe = await obterLotePorId(loteId, false);
    expect(detalhe?.itens[0].rateio).toBeNull();
  });

  it('obterLotePorId com rateio inclui o rateio dos itens', async () => {
    const detalhe = await obterLotePorId(loteId, true);
    expect(detalhe?.itens[0].rateio).toEqual({ thiago: 50_000n, geice: 10_000n, gabrielle: 10_000n });
  });

  it('aprovarLote muda o estado e registra quem aprovou', async () => {
    await comTransacaoFinanceira((tx) => aprovarLote(tx, loteId, randomUUID()));
    const [lote] = await sql`select estado_conferencia, aprovado_em from public.lote_financeiro where id = ${loteId}`;
    expect(lote.estado_conferencia).toBe('aprovado');
    expect(lote.aprovado_em).not.toBeNull();
  });

  it('aprovarLote de novo (já aprovado) é rejeitado', async () => {
    await expect(comTransacaoFinanceira((tx) => aprovarLote(tx, loteId, randomUUID()))).rejects.toThrow(ErroValidacao);
  });

  afterEach(async () => {
    // lote_item/lote_financeiro ficam (FK RESTRICT nas OS); a limpeza roda ao final do arquivo via delete em cascata manual.
  });
});
```
Nota: como `os` tem `on delete restrict` a partir de `lote_item`, a limpeza de dados de teste desta tarefa precisa apagar primeiro os itens/rateio e o lote, depois a OS. Adicionar ao final do arquivo, fora do `describe`, um hook global:
```ts
import { afterAll } from 'vitest';
afterAll(async () => {
  const lotes = await sql`select id from public.lote_financeiro where observacao = 'lote de teste'`;
  for (const { id } of lotes) {
    await sql`delete from interno.lote_item_rateio where lote_item_id in (select id from public.lote_item where lote_id = ${id})`;
    await sql`delete from public.lote_item where lote_id = ${id}`;
    await sql`delete from public.lote_financeiro where id = ${id}`;
  }
  await sql`delete from public.os where numero_os_normalizado like 'TESTE-LOTECONS-%'`;
});
```

- [ ] **Passo 2: Rodar e ver falhar** — `npm run test:integracao` → FAIL.

- [ ] **Passo 3: Implementar consultas**

`src/servidor/lotes/consultas.ts`:
```ts
import { sql } from '@/servidor/db';
import { parseDecimal, type Centavos } from '@/dominio/dinheiro';
import type { PorPessoa } from '@/dominio/rateio';

export interface LoteListado {
  id: string;
  numero: number;
  estadoConferencia: string;
  dataEnvio: string | null;
  valorTotal: Centavos;
}

export async function listarLotes(): Promise<LoteListado[]> {
  const linhas = await sql`
    select id, numero, estado_conferencia, data_envio, valor_total_original
    from public.lote_financeiro order by numero desc
  `;
  return linhas.map((l) => ({
    id: l.id, numero: Number(l.numero), estadoConferencia: l.estado_conferencia,
    dataEnvio: l.data_envio, valorTotal: parseDecimal(l.valor_total_original),
  }));
}

export interface ItemLote {
  id: string;
  ordem: number;
  numeroOsSnapshot: string;
  clienteSnapshot: string;
  produtoSnapshot: string;
  valorComissao: Centavos;
  rateio: PorPessoa | null;
}

export interface LoteDetalhe extends LoteListado {
  observacao: string | null;
  itens: ItemLote[];
}

export async function obterLotePorId(loteId: string, incluirRateio: boolean): Promise<LoteDetalhe | null> {
  const [lote] = await sql`
    select id, numero, estado_conferencia, data_envio, valor_total_original, observacao
    from public.lote_financeiro where id = ${loteId}
  `;
  if (!lote) return null;

  const itensBrutos = incluirRateio
    ? await sql`
        select li.id, li.ordem, li.numero_os_snapshot, li.cliente_snapshot, li.produto_snapshot, li.valor_comissao,
          r.valor_thiago, r.valor_geice, r.valor_gabrielle
        from public.lote_item li
        join interno.lote_item_rateio r on r.lote_item_id = li.id
        where li.lote_id = ${loteId} order by li.ordem
      `
    : await sql`
        select id, ordem, numero_os_snapshot, cliente_snapshot, produto_snapshot, valor_comissao
        from public.lote_item where lote_id = ${loteId} order by ordem
      `;

  return {
    id: lote.id, numero: Number(lote.numero), estadoConferencia: lote.estado_conferencia,
    dataEnvio: lote.data_envio, valorTotal: parseDecimal(lote.valor_total_original), observacao: lote.observacao,
    itens: itensBrutos.map((i) => ({
      id: i.id, ordem: i.ordem, numeroOsSnapshot: i.numero_os_snapshot,
      clienteSnapshot: i.cliente_snapshot, produtoSnapshot: i.produto_snapshot,
      valorComissao: parseDecimal(i.valor_comissao),
      rateio: incluirRateio
        ? { thiago: parseDecimal(i.valor_thiago), geice: parseDecimal(i.valor_geice), gabrielle: parseDecimal(i.valor_gabrielle) }
        : null,
    })),
  };
}
```

- [ ] **Passo 4: Implementar a mudança de estado (função de serviço + server action)**

Adicionar em `src/servidor/lotes/servico.ts` (mesma transação/padrão das demais funções deste arquivo):
```ts
export async function aprovarLote(tx: postgres.TransactionSql, loteId: string, usuarioId: string): Promise<void> {
  const [lote] = await tx`select estado_conferencia from public.lote_financeiro where id = ${loteId} for update`;
  if (!lote) throw new ErroValidacao('Lote não encontrado');
  if (lote.estado_conferencia !== 'enviado') {
    throw new ErroValidacao('Só é possível aprovar um lote que está enviado');
  }
  await tx`
    update public.lote_financeiro
    set estado_conferencia = 'aprovado', aprovado_em = now(), aprovado_por = ${usuarioId}, atualizado_por = ${usuarioId}
    where id = ${loteId}
  `;
  await registrarAuditoria(tx, {
    entidade: 'lote_financeiro', entidadeId: loteId, acao: 'aprovar', responsavelId: usuarioId,
  });
}
```

`src/servidor/lotes/acoes.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import { aprovarLote } from './servico';

export async function aprovarLoteAction(loteId: string): Promise<{ erro: string | null }> {
  try {
    const sessao = await exigirPapel('admin');
    await comTransacaoFinanceira((tx) => aprovarLote(tx, loteId, sessao.userId));
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Ocorreu um erro inesperado' };
  }
  revalidatePath(`/lotes/${loteId}`);
  revalidatePath('/lotes');
  return { erro: null };
}
```

- [ ] **Passo 5: Rodar e ver passar** — `npm run test:integracao` → PASS.

- [ ] **Passo 6: Commit**

```bash
git add src/servidor/lotes tests/integracao/lotes-consultas.test.ts
git commit -m "feat: consultas de lote e aprovação (conferência)"
```

---

### Tarefa 19: Tela "Gerar lote" e lista de lotes

**Files:**
- Create: `src/app/(app)/lotes/page.tsx`, `src/app/(app)/lotes/gerar/page.tsx`, `src/app/(app)/lotes/gerar/FormularioGerarLote.tsx`, `src/servidor/os/consultas.ts` (modificar)

**Interfaces:**
- Consumes: `listarLotes`; precisa de uma nova consulta `listarOsComComissaoDisponivel(): Promise<{ id: string; numeroOs: string; cliente: string; comissaoDisponivel: Centavos }[]>` para a tela de geração (só OS com `comissaoDisponivel > 0n`).
- Produces: `gerarLoteAction(_estadoAnterior, formData): Promise<EstadoFormulario>` em `src/servidor/lotes/acoes.ts` (adicionar a esta tarefa).

- [ ] **Passo 1: Adicionar a consulta de OS elegíveis**

Em `src/servidor/os/consultas.ts`, adicionar ao final:
```ts
export async function listarOsComComissaoDisponivel(): Promise<
  { id: string; numeroOs: string; cliente: string; comissaoDisponivel: Centavos }[]
> {
  const todas = await listarOs();
  return todas.filter((o) => o.comissaoDisponivel > 0n).map((o) => ({
    id: o.id, numeroOs: o.numeroOs, cliente: o.cliente, comissaoDisponivel: o.comissaoDisponivel,
  }));
}
```

- [ ] **Passo 2: Server action de geração**

Adicionar em `src/servidor/lotes/acoes.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { exigirPapel } from '@/servidor/auth';
import { comTransacaoFinanceira } from '@/servidor/db';
import { gerarLote } from './servico';
import { tratarErroFormulario, type EstadoFormulario } from '@/servidor/formularios';

export async function gerarLoteAction(
  _estadoAnterior: EstadoFormulario, formData: FormData,
): Promise<EstadoFormulario> {
  const osIds = formData.getAll('osIds').map(String);
  const observacao = String(formData.get('observacao') ?? '').trim() || null;
  let loteId: string;
  try {
    const sessao = await exigirPapel('admin');
    const resultado = await comTransacaoFinanceira((tx) => gerarLote(tx, { osIds, observacao }, sessao.userId));
    loteId = resultado.loteId;
  } catch (erro) {
    return tratarErroFormulario(erro);
  }
  redirect(`/lotes/${loteId}`);
}
```
(Este bloco é acrescentado ao arquivo criado na Tarefa 18, junto com o `'use server'`, `aprovarLoteAction` e os imports já existentes — um único `'use server'` no topo do arquivo vale para todas as funções nele.)

- [ ] **Passo 3: Tela de geração**

`src/app/(app)/lotes/gerar/FormularioGerarLote.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { gerarLoteAction } from '@/servidor/lotes/acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';
import { formatarBRL, type Centavos } from '@/dominio/dinheiro';

interface OsElegivel { id: string; numeroOs: string; cliente: string; comissaoDisponivel: Centavos }

export function FormularioGerarLote({ osElegiveis }: { osElegiveis: OsElegivel[] }) {
  const [estado, acao, emAndamento] = useActionState(gerarLoteAction, ESTADO_INICIAL_FORMULARIO);
  const total = osElegiveis.reduce((acc, o) => acc + o.comissaoDisponivel, 0n);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <table className="w-full max-w-2xl text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2"><span className="sr-only">Selecionar</span></th>
            <th>Número</th><th>Cliente</th><th>Comissão disponível</th>
          </tr>
        </thead>
        <tbody>
          {osElegiveis.map((os) => (
            <tr key={os.id} className="border-b">
              <td className="py-2"><input type="checkbox" name="osIds" value={os.id} defaultChecked /></td>
              <td>{os.numeroOs}</td>
              <td>{os.cliente}</td>
              <td>{formatarBRL(os.comissaoDisponivel)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {osElegiveis.length === 0 && <p className="text-gray-500">Nenhuma OS com comissão disponível para envio.</p>}
      <p className="font-medium">Total selecionado no carregamento da página: {formatarBRL(total)}</p>
      <label className="flex flex-col gap-1 text-sm">
        Observação (opcional)
        <input name="observacao" className="max-w-md rounded border px-3 py-2" />
      </label>
      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button type="submit" disabled={emAndamento || osElegiveis.length === 0} className="w-fit rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        Confirmar envio ao financeiro
      </button>
    </form>
  );
}
```
Nota importante para o Passo 5 (verificação manual): o total mostrado é calculado com os dados carregados quando a página abriu. O `gerarLote` no servidor **recalcula tudo do zero dentro da transação** — se algo mudou entre a abertura da página e o clique em "Confirmar" (ex: outra baixa registrada), o valor gravado será o correto e atualizado, nunca o da prévia desatualizada; é só o texto exibido antes do clique que pode ficar momentaneamente desatualizado.

- [ ] **Passo 4: Páginas de geração e lista**

`src/app/(app)/lotes/gerar/page.tsx`:
```tsx
import { exigirPapel } from '@/servidor/auth';
import { listarOsComComissaoDisponivel } from '@/servidor/os/consultas';
import { FormularioGerarLote } from './FormularioGerarLote';

export default async function PaginaGerarLote() {
  await exigirPapel('admin');
  const osElegiveis = await listarOsComComissaoDisponivel();
  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Gerar relatório para o financeiro</h1>
      <FormularioGerarLote osElegiveis={osElegiveis} />
    </main>
  );
}
```

`src/app/(app)/lotes/page.tsx`:
```tsx
import Link from 'next/link';
import { exigirSessao } from '@/servidor/auth';
import { listarLotes } from '@/servidor/lotes/consultas';
import { formatarBRL } from '@/dominio/dinheiro';

const RUBRICA_ESTADO: Record<string, string> = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', cancelado: 'Cancelado' };

export default async function PaginaListaLotes() {
  const sessao = await exigirSessao();
  const lotes = await listarLotes();
  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lotes enviados ao financeiro</h1>
        {sessao.papel === 'admin' && (
          <Link href="/lotes/gerar" className="rounded bg-blue-600 px-4 py-2 text-white">Gerar novo lote</Link>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left"><th className="py-2">Número</th><th>Data de envio</th><th>Total</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {lotes.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="py-2"><Link href={`/lotes/${l.id}`} className="text-blue-600 underline">Lote {l.numero}</Link></td>
              <td>{l.dataEnvio ?? '—'}</td>
              <td>{formatarBRL(l.valorTotal)}</td>
              <td>{RUBRICA_ESTADO[l.estadoConferencia]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lotes.length === 0 && <p className="mt-4 text-gray-500">Nenhum lote gerado ainda.</p>}
    </main>
  );
}
```

- [ ] **Passo 5: Verificação manual**

Run: `npm run dev`. Com uma OS que tenha comissão liberada, ir em `/lotes/gerar`, desmarcar/marcar, confirmar; conferir redirecionamento para `/lotes/[id]` e que `/lotes` lista o novo lote como "Enviado".

- [ ] **Passo 6: Commit**

```bash
git add src/app/\(app\)/lotes src/servidor/os/consultas.ts src/servidor/lotes/acoes.ts
git commit -m "feat: telas de geração e listagem de lotes"
```

---

### Tarefa 20: Detalhe do lote, ação de aprovar e impressão

**Files:**
- Create: `src/app/(app)/lotes/[id]/page.tsx`, `src/app/(app)/lotes/[id]/AcoesLote.tsx`, `src/app/(app)/lotes/[id]/imprimir/page.tsx`

**Interfaces:**
- Consumes: `obterLotePorId`, `aprovarLoteAction`, `exigirSessao`.

- [ ] **Passo 1: Botão de aprovar (Client Component por causa do estado local de erro)**

`src/app/(app)/lotes/[id]/AcoesLote.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { aprovarLoteAction } from '@/servidor/lotes/acoes';

export function AcoesLote({ loteId, estadoConferencia }: { loteId: string; estadoConferencia: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  if (estadoConferencia !== 'enviado') return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pendente}
        onClick={() => iniciarTransicao(async () => {
          const resultado = await aprovarLoteAction(loteId);
          setErro(resultado.erro);
        })}
        className="w-fit rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Marcar como aprovado pelo financeiro
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
```

- [ ] **Passo 2: Página de detalhe**

`src/app/(app)/lotes/[id]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/servidor/auth';
import { obterLotePorId } from '@/servidor/lotes/consultas';
import { formatarBRL } from '@/dominio/dinheiro';
import { AcoesLote } from './AcoesLote';

const RUBRICA_ESTADO: Record<string, string> = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', cancelado: 'Cancelado' };

export default async function PaginaDetalheLote({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao();
  const { id } = await params;
  const lote = await obterLotePorId(id, sessao.papel === 'admin');
  if (!lote) notFound();

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lote {lote.numero} — {RUBRICA_ESTADO[lote.estadoConferencia]}</h1>
        <Link href={`/lotes/${lote.id}/imprimir`} target="_blank" className="rounded border px-4 py-2">Ver relatório para impressão</Link>
      </div>
      <p className="mb-4">Total: <strong>{formatarBRL(lote.valorTotal)}</strong> — Enviado em {lote.dataEnvio ?? '—'}</p>
      {sessao.papel === 'admin' && <div className="mb-6"><AcoesLote loteId={lote.id} estadoConferencia={lote.estadoConferencia} /></div>}
      <table className="w-full max-w-3xl text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">OS</th><th>Cliente</th><th>Produto</th><th>Comissão do trecho</th>
            {sessao.papel === 'admin' && <th>Thiago / Geice / Gabrielle</th>}
          </tr>
        </thead>
        <tbody>
          {lote.itens.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2">{item.numeroOsSnapshot}</td>
              <td>{item.clienteSnapshot}</td>
              <td>{item.produtoSnapshot}</td>
              <td>{formatarBRL(item.valorComissao)}</td>
              {sessao.papel === 'admin' && item.rateio && (
                <td>{formatarBRL(item.rateio.thiago)} / {formatarBRL(item.rateio.geice)} / {formatarBRL(item.rateio.gabrielle)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Passo 3: Página de impressão (sem rateio, para qualquer papel autenticado — é o documento que vale para o financeiro)**

`src/app/(app)/lotes/[id]/imprimir/ConteudoImpressao.tsx` (Client Component, por causa do `onClick` do botão de imprimir):
```tsx
'use client';

import { formatarBRL } from '@/dominio/dinheiro';
import { formatarDataBr } from '@/dominio/datas';
import type { LoteDetalhe } from '@/servidor/lotes/consultas';

export function ConteudoImpressao({ lote }: { lote: LoteDetalhe }) {

  return (
    <main className="mx-auto max-w-3xl p-8 print:p-0">
      <style>{'@media print { @page { size: A4; margin: 2cm; } }'}</style>
      <h1 className="mb-1 text-lg font-semibold">Relatório de comissão — Lote {lote.numero}</h1>
      <p className="mb-6 text-sm text-gray-600">Enviado em {lote.dataEnvio ? formatarDataBr(lote.dataEnvio) : '—'}</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2">OS</th><th>Cliente</th><th>Produto</th><th className="text-right">Comissão</th>
          </tr>
        </thead>
        <tbody>
          {lote.itens.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-1">{item.numeroOsSnapshot}</td>
              <td>{item.clienteSnapshot}</td>
              <td>{item.produtoSnapshot}</td>
              <td className="text-right">{formatarBRL(item.valorComissao)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-semibold">
            <td className="py-2" colSpan={3}>Total</td>
            <td className="text-right">{formatarBRL(lote.valorTotal)}</td>
          </tr>
        </tfoot>
      </table>
      <button
        type="button"
        onClick={() => window.print()}
        className="mt-6 rounded bg-blue-600 px-4 py-2 text-white print:hidden"
      >
        Imprimir / salvar PDF
      </button>
    </main>
  );
}
```

`src/app/(app)/lotes/[id]/imprimir/page.tsx` (Server Component: busca os dados sem rateio e delega a renderização/impressão ao Client Component acima):
```tsx
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/servidor/auth';
import { obterLotePorId } from '@/servidor/lotes/consultas';
import { ConteudoImpressao } from './ConteudoImpressao';

export default async function PaginaImprimirLote({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessao();
  const { id } = await params;
  const lote = await obterLotePorId(id, false); // false: nunca busca nem renderiza rateio, nem para admin
  if (!lote) notFound();
  return <ConteudoImpressao lote={lote} />;
}
```

- [ ] **Passo 4: Verificação manual — fluxo completo end-to-end**

Run: `npm run dev`. Como admin: cadastrar OS → registrar pagamento de 50% → ir em `/lotes/gerar`, confirmar → na página do lote, clicar "Marcar como aprovado" → conferir que o estado muda para "Aprovado" e o botão some → abrir "Ver relatório para impressão" e confirmar que não aparecem nomes de Geice/Gabrielle nem percentuais internos em nenhum lugar da página (inclusive view-source). Como financeiro: abrir o mesmo lote e confirmar que a coluna "Thiago / Geice / Gabrielle" não aparece na tela de detalhe.

- [ ] **Passo 5: Commit**

```bash
git add src/app/\(app\)/lotes/\[id\]
git commit -m "feat: detalhe de lote, aprovação e relatório de impressão sem rateio"
```

---

### Tarefa 21: Login, layout autenticado, navegação e tratamento de erro de permissão

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/FormularioLogin.tsx`, `src/servidor/auth-acoes.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/error.tsx`

**Interfaces:**
- Produces: `entrarAction(_estadoAnterior, formData): Promise<EstadoFormulario>` (login via `criarClienteServidor`, chamado dentro da própria server action — ver Passo 1), `sairAction(): Promise<void>`.

- [ ] **Passo 1: Server actions de entrar/sair**

`src/servidor/auth-acoes.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { criarClienteServidor } from './supabase/servidor';
import { tratarErroFormulario, ESTADO_INICIAL_FORMULARIO, type EstadoFormulario } from './formularios';

export async function entrarAction(
  _estadoAnterior: EstadoFormulario, formData: FormData,
): Promise<EstadoFormulario> {
  const email = String(formData.get('email') ?? '');
  const senha = String(formData.get('senha') ?? '');
  try {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.signInWithPassword({ email, senha });
    if (error) {
      return { erroGeral: 'E-mail ou senha inválidos', errosPorCampo: {} };
    }
  } catch (erro) {
    return tratarErroFormulario(erro);
  }
  redirect('/');
}

export async function sairAction(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect('/login');
}
```
(`entrarAction` retorna `ESTADO_INICIAL_FORMULARIO` implicitamente nunca é alcançado no caminho de sucesso porque `redirect` lança internamente; isso é o comportamento normal do Next.js e não precisa de tratamento especial.)

- [ ] **Passo 2: Tela de login**

`src/app/login/FormularioLogin.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { entrarAction } from '@/servidor/auth-acoes';
import { ESTADO_INICIAL_FORMULARIO } from '@/servidor/formularios';
import { Campo } from '@/componentes/Campo';

export function FormularioLogin() {
  const [estado, acao, emAndamento] = useActionState(entrarAction, ESTADO_INICIAL_FORMULARIO);
  return (
    <form action={acao} className="flex w-full max-w-xs flex-col gap-4">
      <Campo label="E-mail" htmlFor="email" erro={estado.errosPorCampo.email}>
        <input type="email" name="email" id="email" required className="rounded border px-3 py-2" />
      </Campo>
      <Campo label="Senha" htmlFor="senha" erro={estado.errosPorCampo.senha}>
        <input type="password" name="senha" id="senha" required className="rounded border px-3 py-2" />
      </Campo>
      {estado.erroGeral && <p className="text-sm text-red-600">{estado.erroGeral}</p>}
      <button type="submit" disabled={emAndamento} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        Entrar
      </button>
      <p className="text-xs text-gray-500">
        Esqueceu a senha? Peça para o responsável pelo sistema redefinir diretamente no Supabase.
      </p>
    </form>
  );
}
```

`src/app/login/page.tsx`:
```tsx
import { FormularioLogin } from './FormularioLogin';

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Controle de Comissão</h1>
        <FormularioLogin />
      </div>
    </main>
  );
}
```

- [ ] **Passo 3: Layout autenticado com navegação por papel**

`src/app/(app)/layout.tsx`:
```tsx
import Link from 'next/link';
import { exigirSessao } from '@/servidor/auth';
import { sairAction } from '@/servidor/auth-acoes';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  return (
    <div>
      <nav className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex gap-4 text-sm">
          <Link href="/os">OS</Link>
          <Link href="/lotes">Lotes</Link>
          {sessao.papel === 'admin' && <Link href="/configuracao">Configuração</Link>}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{sessao.email} ({sessao.papel})</span>
          <form action={sairAction}>
            <button type="submit" className="underline">Sair</button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Passo 4: Página inicial e boundary de erro**

`src/app/(app)/page.tsx` (a Fase 1 não inclui o painel completo do spec §13.2 — isso fica para uma fase de painéis/relatórios futura; por ora, a raiz só direciona para a lista de OS):
```tsx
import { redirect } from 'next/navigation';

export default function PaginaInicial() {
  redirect('/os');
}
```

`src/app/(app)/error.tsx`:
```tsx
'use client';

export default function ErroApp({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="p-6">
      <p className="text-red-600">{error.message || 'Ocorreu um erro inesperado.'}</p>
    </main>
  );
}
```

- [ ] **Passo 5: Verificação manual — sessão completa**

Run: `npm run dev`. Acessar `http://localhost:3000/os` deslogado → deve redirecionar para `/login` (middleware da Tarefa 10). Entrar com o usuário financeiro criado na Tarefa 9 → cai em `/os`; tentar acessar `/configuracao` diretamente pela URL → deve mostrar a mensagem de acesso não autorizado do `error.tsx`, não uma tela em branco nem erro 500 cru. Clicar "Sair" → volta para `/login`. Repetir logado como Thiago (admin) e confirmar que `/configuracao` funciona normalmente.

- [ ] **Passo 6: Rodar toda a suíte antes do commit final**

Run: `npm run test` (domínio + integração) → PASS. Run: `npm run build` → sucesso.

- [ ] **Passo 7: Commit**

```bash
git add src/app/login src/servidor/auth-acoes.ts src/app/\(app\)/layout.tsx src/app/\(app\)/page.tsx src/app/\(app\)/error.tsx
git commit -m "feat: login, layout autenticado com navegação por papel e tratamento de erro de acesso"
```

---

## Auto-revisão do plano

**Cobertura do spec (seções relevantes ao escopo desta Fase 1 — itens 1 a 4 de §19):**
- §3 Arquitetura: Tarefas 1, 7, 10 (Next.js, `postgres.js`, Supabase Auth, sem `NEXT_PUBLIC_*` para segredos).
- §5 Modelo de dados (subconjunto da Fase 1: `configuracao_comercial`/`configuracao_rateio`, `os`/`os_rateio`, `baixa_cliente` sem estorno, `lote_financeiro`/`lote_item`/`lote_item_rateio`, `auditoria_evento`, `operacao_idempotente`): migração da Tarefa 7 (arquivo já entregue ao usuário antes deste plano). `recebimento_financeiro`, `ajuste_comissao*`, `devolucao_financeiro*`, `movimento_pessoa`, `pagamento_vendedora`, `comprovante` ficam para as fases seguintes (recebimentos/estornos/pagamentos), citadas no Goal como fora de escopo.
- §6 Cálculo de comissão e status: Tarefas 3, 6, 14 (`comissaoTotal`, `comissaoLiberada`, `statusRecebimento`, `resumoComissaoOs`).
- §7 Rateio determinístico `divisores_v1`: Tarefa 5, com testes de propriedade (soma exata, monotonicidade, equivalência com o algoritmo de referência, fracionamento em trechos).
- §8.1 Conferência (parte enviado→aprovado; recebimento e valores parciais de lote são §8.2/§8.3, fora desta fase): Tarefa 18.
- §11 Concorrência/idempotência: Tarefas 7 (bloqueio global), 8 (idempotência e auditoria); teste de serialização real na Tarefa 7.
- §11.3 Prévia não é autorização: comentado explicitamente na Tarefa 19 (o servidor recalcula tudo dentro da transação, nunca confia no total exibido na tela).
- §12 Validações: número único normalizado (Tarefa 13), rateio validado contra o total (Tarefas 5/12/13), saldo do cliente não ultrapassado (Tarefa 16), datas não futuras (Tarefas 3, 16), edição de OS após envio (parcialmente — ver limitação abaixo).
- §13 Telas: login (21), painel (fora de escopo, ver Goal), OS (15), baixas (16), gerar lote (19), lotes (18-20), configuração (12). Relatório interno por pessoa é Fase 2 (depende de `movimento_pessoa`, que depende de recebimento confirmado).
- §14 Relatórios/impressão: Tarefa 20 (documento de impressão do lote, sem rateio, com CSS de impressão A4). CSV de listagens fica para a fase de painéis/exportação.
- §4 Segurança: papel em `app_metadata` (Tarefa 9/10), autorização no servidor em toda leitura/mutação (`exigirSessao`/`exigirPapel` chamado em cada página e cada server action), RLS negando tudo exceto `app_writer` (Tarefa 7, arquivo de migração), rateio nunca projetado para financeiro (consultas com parâmetro `incluirRateio`, testado explicitamente nas Tarefas 14/18/20).

**Limitações conscientes desta Fase 1 (não são lacunas do plano, são escopo adiado — listadas para não serem confundidas com esquecimento):**
- Bloqueio de edição de `os.valor`/`percentual_comissao`/rateio após `primeiro_envio_em` (spec §12) **não tem UI de edição nesta fase** — como a Fase 1 não inclui tela de editar OS, a regra não tem como ser violada ainda; a tela de edição e sua trava ficam para a fase que introduzir updates de OS.
- Estorno de baixa do cliente, cancelamento de OS, `recebimento_financeiro` (pago de fato), ajustes/devoluções de comissão e pagamentos às vendedoras: todos fora desta fase, conforme o próprio pedido que originou este plano (itens 5 e 6 de §19).
- CSV, painel consolidado (§13.2) e comprovantes: fase de painéis/exportação (item 7 de §19).
- Restrição de exclusão no banco (`EXCLUDE` via `gist`) para reservas de intervalo: deliberadamente adiada — a Tarefa 7 já documenta essa decisão no comentário da migração, apoiada no bloqueio global da Tarefa 7 (transação serializada) como garantia suficiente para o volume desta fase.

**Checagem de placeholders:** nenhum "TBD"/"TODO" nas tarefas; os dois trechos que originalmente traziam código incompleto com correção posterior (Tarefa 14, Tarefa 17, Tarefa 18) foram reescritos para conter a versão final diretamente no passo de implementação.

**Consistência de tipos entre tarefas:** `Centavos`/`Percentual` (Tarefa 2) usados sem variação de nome em todas as tarefas seguintes; `PorPessoa`/`ORDEM_PESSOAS` (Tarefa 5) consumidos identicamente por `lote.ts` (Tarefa 6), `os/consultas.ts` (Tarefa 14) e `lotes/consultas.ts` (Tarefa 18); `comTransacaoFinanceira` (Tarefa 7) é sempre o primeiro parâmetro `tx` nas funções de serviço (`cadastrarOs`, `registrarBaixaCliente`, `gerarLote`, `aprovarLote`, `atualizarConfiguracao`) — conferido tarefa a tarefa.

## Próximas fases (fora deste plano)

1. Recebimentos parciais confirmados do financeiro (`recebimento_financeiro`, `recebimento_item*`) e extrato individual de Thiago/Geice/Gabrielle (`movimento_pessoa`) — depende deste plano.
2. Estornos de baixa, cancelamento de OS, ajustes de comissão e devoluções ao financeiro (§9) — depende da fase 1 acima.
3. Pagamentos e devoluções das vendedoras (`pagamento_vendedora`) — depende da fase 1 acima.
4. Painéis (§13.2), filtros avançados, exportação CSV e comprovantes — pode ser feita em paralelo às fases 2/3 depois que a fase 1 acima existir.

Cada uma vira seu próprio plano em `docs/superpowers/plans/`, seguindo o mesmo formato deste documento.
