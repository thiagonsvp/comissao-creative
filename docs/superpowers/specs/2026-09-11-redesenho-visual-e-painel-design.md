# Redesenho visual e painel de início — Design

**Data:** 2026-09-11
**Estado:** aprovado no brainstorming, aguardando revisão do usuário
**Spec anterior:** `2026-09-10-controle-comissao-design.md` (v2.0) — este documento não a substitui, complementa.

## 1. Objetivo

Dar ao sistema uma linguagem visual própria e transformar a rota `/`, hoje um simples
redirecionamento, numa tela de início que responde "como estão minhas comissões agora".

O sistema funciona, mas não tem nenhuma decisão de design: as telas usam o visual
padrão do `create-next-app` — fonte Arial (a Geist está carregada mas o `body` a
sobrescreve), botões `blue-600`, tabelas com linha cinza, só tema claro, e tabelas
que no celular exigem rolagem lateral. O celular é uso de primeira classe para o
admin, e hoje não é atendido.

## 2. Escopo

**Dentro:**

- Fundação visual: paleta, tipografia, escala, tokens, alternador de tema claro/escuro.
- Biblioteca de componentes compartilhados.
- Redesenho de todas as telas existentes, com layout de celular de primeira classe.
- Nova tela de início (painel), com conteúdo distinto por papel.
- Redesenho do relatório de impressão do lote, com quatro valores por OS.

**Fora:**

- Qualquer mudança em `src/dominio` ou `src/servidor` além das consultas novas de
  agregação do painel. Nenhuma regra financeira muda.
- Tabelas novas ou migrações. O painel usa apenas dados que já existem.
- Blocos do painel que dependem da Fase 2 (`recebimento_financeiro`,
  `movimento_pessoa`, `pagamento_vendedora`): o espaço é desenhado e rotulado, os
  dados entram depois.
- Filtros avançados e exportação CSV (§13.2/§14 da spec original).

## 3. Direção visual

Direção escolhida: **Cofre** — grafite frio com um único azul-ciano de destaque, todo
valor monetário em fonte monoespaçada. A intenção é "instrumento financeiro sério",
não "SaaS genérico": a cor trabalha pouco e sempre com significado.

### 3.1 Paleta

Neutros frios (grafite, não bege — azul sobre bege fica barrento).

| Papel | Claro | Escuro |
|---|---|---|
| Fundo | `#F7F8FA` | `#0E1116` |
| Superfície (cartão) | `#FFFFFF` | `#171B22` |
| Superfície secundária | `#EFF1F5` | `#1D222B` |
| Borda | `#DFE3EA` | `#262C37` |
| Borda forte | `#CBD2DD` | `#333A47` |
| Texto | `#131720` | `#EEF1F6` |
| Texto secundário | `#5A6373` | `#9AA3B2` |
| Rótulo | `#8A93A3` | `#6E7788` |
| **Destaque (ciano)** | `#0F72B5` | `#49C2F0` |
| Destaque — hover | `#0B5B91` | `#74D2F5` |
| Destaque — fundo suave | `#E1F0F9` | `#0C222C` |
| Sobre o destaque | `#FFFFFF` | `#062029` |
| Sucesso | `#2F7D52` | `#5FCB8C` |
| Sucesso — fundo | `#E4F0E8` | `#15241B` |
| Erro / destrutivo | `#B4301F` | `#F0705C` |
| Erro — fundo | `#FBE9E6` | `#2A1512` |

**Regra do destaque (inviolável):** o ciano aparece em no máximo **um lugar por bloco
visual** — a ação primária, o número em foco da tela, ou o status pendente. Nunca em
texto corrido, nunca dois cianos competindo na mesma área. É o que separa "moderno"
de "poluído".

**Semântica de status:** neutro = aberta/rascunho; ciano = parcial/aguardando
conferência; sucesso = quitada/aprovado; erro = cancelado/falha.

### 3.2 Tipografia

- **Bricolage Grotesque** — interface, títulos, rótulos, texto corrido.
- **JetBrains Mono** — todo valor monetário, percentual, data e número de OS.

Ambas via `next/font/google`: baixadas no build e servidas do próprio domínio, sem
requisição externa em produção e sem deslocamento de layout. Isso também corrige o
`font-family: Arial` que hoje sobrescreve a fonte no `body`.

Escala (celular → computador):

| Uso | Tamanho | Fonte |
|---|---|---|
| Número em destaque | 36 → 48 px | Mono 700, tracking −0.045em |
| Número secundário (KPI) | 25 px | Mono 700 |
| Título de página | 22 → 24 px | Bricolage 700 |
| Título de seção | 14 px | Bricolage 600 |
| Corpo | 15 px | Bricolage 400 |
| Número em tabela | 14 px tabular | Mono 500 |
| Rótulo | 11 px, caixa alta, tracking 0.16em | Bricolage 600 |

### 3.3 Tema

Três estados: **Sistema** (padrão, segue `prefers-color-scheme`), **Claro**, **Escuro**.
A escolha é por navegador, guardada em `localStorage`.

Implementação: atributo `data-tema` no `<html>`, variante custom do Tailwind v4, e um
script mínimo no `<head>` que aplica o tema antes da primeira pintura — sem flash
branco no carregamento. Sem biblioteca nova.

## 4. Componentes

Vivem em `src/componentes/`. Cada um é usável isoladamente e não conhece o domínio
além dos tipos que recebe.

| Componente | Responsabilidade |
|---|---|
| `Botao` | Variantes primário / secundário / fantasma / destrutivo; estados foco, desabilitado, carregando. Altura mínima 44 px. |
| `Campo` (existente, reescrito) | Rótulo, controle, texto de ajuda, erro embaixo do campo que o causou. |
| `CampoMoeda` | Prefixo `R$` fixo, entrada em monoespaçada, `inputMode="decimal"`. |
| `Selo` | Status: cor + texto + ponto sólido, sempre os três juntos. |
| `CartaoValor` | O número em destaque com borda superior ciano. |
| `Tabela` / `ListaCartoes` | Mesma informação: tabela no computador, cartões no celular. |
| `BarraEmpilhada` | A barra de composição da comissão. |
| `GraficoBarras` | SVG escrito à mão, sem biblioteca. |
| `EstadoVazio` | Explica *por que* está vazio e oferece o próximo passo. |
| `AlternadorTema` | Sistema / Claro / Escuro. |
| `Moeda` (existente) | Mantido, passa a usar a fonte monoespaçada. |

**Acessibilidade como critério, não enfeite:** contraste verificado nos dois temas,
foco visível em tudo que recebe teclado, status legível sem depender de cor, alvos de
toque de 44 px.

## 5. Telas

Rotas atuais, todas redesenhadas: `/login`, `/os`, `/os/nova`, `/os/[id]`,
`/os/[id]/baixas/nova`, `/lotes`, `/lotes/gerar`, `/lotes/[id]`,
`/lotes/[id]/imprimir`, `/configuracao`, `/sem-permissao`, mais `(app)/error.tsx`.

**Navegação:** no computador, barra no topo com o item ativo sublinhado em ciano. No
celular, barra fixa no rodapé com quatro destinos (Início, OS, Lotes, Mais) — com tão
poucos destinos, barra inferior bate menu hambúrguer: fica no alcance do polegar e
mostra onde você está o tempo todo.

**Listas:** no computador são tabelas; no celular viram lista de cartões, com o valor
que importa em ciano. Nunca rolagem lateral.

**Detalhe da OS** é a tela mais densa e ganha hierarquia explícita:

- O número que mais se olha — *disponível para lote* — é o maior da tela e o único em
  ciano. Os outros dois KPIs têm o mesmo tamanho entre si e não competem.
- Uma barra empilhada mostra a composição da comissão: liberada e disponível,
  comprometida em lotes, e o que ainda está preso ao que o cliente não pagou. Isso
  torna visível uma parte do modelo que hoje o usuário precisa deduzir.
- O bloco de rateio recebe marca visual explícita de "visível só para admin".

**Formulários no celular:** campos confortáveis ao toque, teclado numérico nos campos
de valor, botão de ação com largura total.

## 6. Painel (rota `/`)

Substitui o redirecionamento atual. Conteúdo distinto por papel — mesmo esqueleto,
pergunta diferente.

**Admin — "quanto posso enviar agora":**

1. Destaque: comissão disponível para envio (soma de todas as OS) + contagem de OS +
   botão "Gerar lote agora".
2. Comprometido aguardando conferência (lotes `enviado`) e aprovado (lotes `aprovado`).
3. Gráfico de comissão gerada por mês, 12 meses.
4. Lotes na mesa do financeiro, com idade em dias.
5. Rateio do disponível por pessoa — **só admin**.
6. Bloco rotulado "Entra na próxima fase", com valores em `— — —`: efetivamente
   recebido do financeiro, e a pagar às vendedoras.

**Financeiro — "o que está parado na minha mesa":**

1. Destaque: total aguardando sua conferência + contagem + botão para os lotes.
2. Aprovado por você no mês.
3. Idade do lote mais antigo na fila.
4. Lista de lotes a conferir.

Nenhum dado de rateio chega ao painel do financeiro, nem no HTML.

**Alerta de lote parado:** lote em estado `enviado` há mais de **15 dias corridos**
recebe destaque em vermelho nos dois painéis. O limite é uma constante nomeada.

### 6.1 Decisão técnica crítica: onde a soma acontece

As agregações do painel **não podem recalcular comissão em SQL**. O arredondamento
half-up e o rateio `divisores_v1` vivem em `src/dominio` operando em `bigint`; uma
segunda implementação em SQL divergiria por centavos e o painel passaria a discordar
das telas.

Portanto as consultas novas retornam **componentes crus por OS** — `valor`,
`percentual_comissao`, total pago pelo cliente, comprometido em lotes — e a soma é
feita em TypeScript, com as mesmas funções de domínio que as telas usam. Só há uma
implementação do cálculo no sistema inteiro.

Isso é adequado à escala do negócio (centenas de OS). Se o volume passar de alguns
milhares de OS, a solução é materializar a comissão por OS numa coluna mantida pelo
serviço transacional — nunca duplicar a regra em SQL. Registrado aqui para a decisão
futura ser tomada com o contexto certo.

**Consultas novas** (em `src/servidor/painel/consultas.ts`, com executor opcional
como as demais):

- `componentesPorOs()` — uma linha por OS com os componentes crus; base do disponível
  total, da contagem por status e do rateio do disponível.
- `serieMensalComissao(meses)` — uma linha por OS com mês de `data_venda`, valor e
  percentual; a soma por mês é feita em TypeScript.
- `lotesPorEstado()` — total e contagem por `estado_conferencia`, mais a idade em
  dias do lote `enviado` mais antigo.

**Definição da série mensal:** comissão total das OS agrupadas pelo **mês de
`data_venda`** — responde "quanto de comissão aquele mês de vendas gerou". A
alternativa seria agrupar pelo mês do pagamento do cliente (quando a comissão foi
liberada); são perguntas diferentes e esta escolha precisa ser confirmada na revisão.

**Gráficos:** SVG escrito à mão. Uma biblioteca custaria cerca de 100 KB no navegador
para desenhar retângulos, e traria a estética dela em vez desta.

## 7. Relatório de impressão

É o único artefato que circula fora do sistema. Regras fixas:

- **Sempre claro**, independente do tema da tela.
- **Sem ciano** — hierarquia por peso e régua; sai igual em impressora preto e branco.
- **Nunca rateio** — nenhum nome, percentual ou valor por pessoa; a página não carrega
  esses dados do banco.
- Cabeçalho repetido a cada página em lotes longos; "Página X de Y" no rodapé.
- Números alinhados à direita em monoespaçada, para conferir contra o extrato.
- Linha discreta de "Conferido por / Data".

**Colunas por item:** OS · Cliente e produto · Valor da OS · Pago pelo cliente ·
Comissão já enviada · **Liberada para pagamento**.

Os quatro valores vêm do snapshot gravado na geração do lote
(`valor_os_snapshot`, `total_pago_cliente_snapshot`,
`comissao_comprometida_anterior_snapshot`, `valor_comissao`), então o relatório é um
documento congelado: se a OS mudar depois, o relatório já emitido não muda.

Duas decisões de leitura:

- **Só "Liberada para pagamento" totaliza.** As outras três são contexto. É a única
  em negrito e corpo maior — ninguém olha o rodapé e paga o valor errado.
- **"Comissão já enviada" mostra `—`**, não `R$ 0,00`, quando é a primeira vez que a
  OS entra num lote. Zero e "não se aplica" são coisas diferentes.

**Exposição nova, aceita conscientemente:** o financeiro passa a ver o valor das
vendas e quanto os clientes pagaram — informação que não recebia antes. Justifica-se
porque permite conferir cada linha sem perguntar nada ao admin.

## 8. Arquitetura e impacto no repositório

O redesenho toca **apenas** `src/app`, `src/componentes` e `src/app/globals.css`. A
única adição fora disso é `src/servidor/painel/consultas.ts`.

`src/dominio` e o restante de `src/servidor` não mudam. Nenhuma migração, nenhuma
dependência nova de runtime.

Tokens ficam em `globals.css` como variáveis CSS dentro de `@theme` — o projeto já usa
Tailwind v4, então a fundação encaixa no que existe sem reescrever configuração.

## 9. Verificação

- **Os 90 testes atuais precisam continuar passando sem nenhuma alteração.** Como o
  redesenho não toca domínio nem serviços, um teste que quebre é sinal de que o
  trabalho saiu do escopo. Isso é um teste do próprio redesenho.
- **Testes novos** só para as consultas do painel, no padrão dos existentes:
  transação com rollback, usuário real do Auth, sem privilégio de exclusão. Inclui um
  caso explícito de que o painel do financeiro não retorna rateio.
- **Verificação visual dirigida por navegador**: todas as telas mais o painel, nos dois
  papéis, nas duas larguras e nos dois temas, sem gravar dado no banco.
- **Impressão**: conferir que o PDF sai claro e sem rateio mesmo com o sistema em
  tema escuro.

## 10. Fases de implementação

1. **Fundação** — tokens, fontes, alternador de tema, correção do Arial. Nenhuma tela.
2. **Componentes** — a biblioteca, isoladamente.
3. **Telas** — as 11 rotas listadas em §5 mais o boundary de erro, do login ao relatório de impressão.
4. **Painel** — consultas novas, agregação em TypeScript, as duas visões e os gráficos.

Cada fase deixa o sistema funcionando; nenhuma depende da seguinte para não quebrar.

## 11. Restrições herdadas que continuam valendo

- Rateio (padrões, `os_rateio`, `lote_item_rateio`) nunca é projetado para o papel
  `financeiro` — em HTML, JSON, erros ou auditoria.
- Autorização no servidor em toda leitura e mutação; páginas usam `sessaoDaPagina()`,
  server actions usam `exigirSessao`/`exigirPapel`.
- Nenhum valor monetário passa por `Number` em cálculo.
- Idioma pt-BR, moeda BRL com duas casas, fuso `America/Sao_Paulo`.
