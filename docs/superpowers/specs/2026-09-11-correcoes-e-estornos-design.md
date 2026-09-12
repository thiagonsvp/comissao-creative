# Correções, estornos e refazimento de lote — Design

**Data:** 2026-09-11
**Estado:** aprovado no brainstorming, aguardando revisão do usuário
**Specs anteriores:** `2026-09-10-controle-comissao-design.md` (v2.0) e
`2026-09-11-redesenho-visual-e-painel-design.md`. Este documento complementa
ambas e, em dois pontos marcados, **diverge conscientemente** da v2.0.
**Base:** ramifica de `feature/redesenho-visual` — as telas afetadas são as
que o redesenho reescreveu.

## 1. Objetivo

Dar ao admin uma saída dentro do sistema para os quatro erros que acontecem de
verdade: digitou errado, o negócio mudou depois, lançou o pagamento errado, e
precisa refazer um lote incluindo ou tirando uma OS.

Hoje não existe nenhuma: uma OS cadastrada é imutável pela aplicação, um
pagamento lançado não pode ser corrigido, e um lote enviado não pode ser
desfeito. A única saída é `UPDATE` manual no SQL Editor do Supabase — sem
auditoria, sem validação e sem rede de segurança.

## 2. Escopo

**Dentro:**

- Editar OS, com duas classes de campo e travas precisas (§3).
- Cancelar lote, com motivo obrigatório (§4).
- Desfazer aprovação de lote, com motivo obrigatório (§4).
- Gerar lote substituto, vinculado ao cancelado (§4).
- Estornar recebimento do cliente, total ou parcial (§5).

**Fora:**

- **Corrigir o que já foi pago.** Aprovar um lote é, no fluxo real do usuário,
  o próprio pagamento. Corrigir uma OS presa num lote **aprovado** exigiria
  acertar dinheiro com o financeiro — `ajuste_comissao`, `devolucao_financeiro`
  e a compensação entre lotes (§5.12 e §5.13 da v2.0). O sistema recusa essa
  correção com mensagem explícita, e o caso volta à mesa quando aparecer na
  prática. O "desfazer aprovação" (§4) existe para que um clique errado não
  caia aqui.
- Cancelamento de OS (`os.situacao`) e OS de renegociação (`os.os_origem_id`).
  As colunas existem e continuam sem uso.
- Recebimento efetivo do financeiro (`recebimento_financeiro`), extrato por
  pessoa (`movimento_pessoa`) e pagamento às vendedoras.
- Bloqueio otimista por `versao` — ver §8.

## 3. Editar OS

A regra que organiza tudo: **um campo só trava se mexer em dinheiro que já saiu
da sua mão.**

### 3.1 Campos sempre editáveis

`numero_os`, `cliente`, `produto`, `tipo_pagamento`, `observacao` e
`data_venda`.

Nenhum deles altera comissão. Os quatro primeiros já foram copiados para
`lote_item` no envio, então o documento que o financeiro recebeu não muda ao
editá-los — é o comportamento desejado: o relatório é um retrato daquele dia.
`data_venda` não entra em cálculo nenhum; ela só reposiciona a OS na série
mensal do painel.

`numero_os` é renormalizado e revalidado contra a unicidade, como no cadastro.

### 3.2 Campos com trava

`valor`, `percentual_comissao` e o rateio.

**Trava de valor e percentual — regra precisa:** a edição é recusada se, com os
valores novos, a **comissão liberada ficaria menor que a comissão já
comprometida** em lotes não cancelados.

Essa formulação é deliberadamente mais permissiva que "tem lote, não edita":
aumentar o valor de uma OS nunca quebra reserva nenhuma e passa direto.
Só a redução que invadiria dinheiro já reservado é barrada.

**Trava de rateio:** recusada enquanto existir qualquer lote não cancelado
referenciando a OS. Rateio não altera quanto se recebe, só como se divide —
mas mudá-lo no meio de um lote pendente faria a mesma OS ser dividida por dois
acordos diferentes, sem que nada na tela explique por quê. Com lote pendente, a
saída é cancelar, ajustar e gerar de novo.

### 3.3 As duas mensagens de recusa

Elas não dizem "não pode". Dizem o que fazer.

- **Lote pendente:** "O lote 14 reservou R$ 700,00 desta OS. Cancele esse lote
  para liberar a correção." — com link direto para o lote.
- **Lote aprovado:** "O lote 14 já foi aprovado, e aprovar é o registro de
  pagamento. Corrigir agora exigiria acertar R$ 280,00 com o financeiro, o que
  este sistema ainda não registra. Se a aprovação foi engano, desfaça-a no
  lote 14."

Quando houver mais de um lote afetado, a mensagem cita o mais recente e informa
a quantidade.

### 3.4 Divergência consciente da spec v2.0

A v2.0 (linha 1201) determina: *"Após `primeiro_envio_em`, valor e percentuais
ficam bloqueados definitivamente para edição direta, mesmo que o primeiro lote
tenha sido cancelado."*

**Este documento revoga essa regra** e a substitui pela trava de §3.2. Razão: a
v2.0 escreveu a regra pensando em renegociação de preço, onde congelar o
passado é correto. Ela transforma um erro de digitação percebido tarde num
retrabalho desproporcional — cancelar a OS e recadastrar tudo. Com o lote
cancelado, nenhum dinheiro está reservado e nenhum documento vigente depende
daquele valor; a correção é exata e auditada.

O que a v2.0 protegia continua protegido por outro caminho: os lotes já
emitidos guardam seus próprios *snapshots* e não mudam nunca.

## 4. Lote: cancelar, desfazer aprovação, substituir

### 4.1 Cancelar

Permitido só a partir de `enviado`. Exige motivo. Grava `motivo_cancelamento`,
muda `estado_conferencia` para `cancelado`, audita.

Cancelar **libera as reservas automaticamente**: o cálculo de comissão
comprometida já ignora lotes cancelados (`estado_conferencia <> 'cancelado'`,
em `carregarOsParaLote` e nas consultas de OS e painel). Nenhuma linha de
`lote_item` é apagada — o documento continua existindo, marcado como cancelado.

### 4.2 Desfazer aprovação

Devolve um lote `aprovado` para `enviado`, limpando `aprovado_em` e
`aprovado_por`. Exige motivo. Só `admin`.

Existe porque aprovar é um clique e, no fluxo do usuário, equivale a declarar
que o dinheiro entrou. Sem isso, um clique errado empurra a OS para o caso que
este documento deixou fora de escopo, sem saída dentro do sistema.

### 4.3 Gerar lote substituto

Não existe edição de itens de lote. Um lote é um documento congelado; reescrevê-lo
faria o financeiro ter conferido um papel diferente do que está no sistema.

Refazer é: cancelar, corrigir o que precisar, gerar de novo. "Tirar uma OS do
lote" é desmarcá-la na tela de geração; "incluir" é marcá-la. É o fluxo que já
existe.

A tela de um lote cancelado ganha **"Gerar lote substituto"**, que leva à
geração com as OS daquele lote pré-marcadas. O lote novo grava
`lote_origem_id`. A partir daí, a tela do cancelado mostra "substituído pelo
lote 15" e a do novo mostra "substitui o lote 14".

## 5. Estornar recebimento do cliente

Recebimento não se edita nem se exclui — o papel de banco da aplicação tem
apenas `select` e `insert` em `baixa_cliente`, por desenho. Corrigir é estornar
e lançar de novo, o que deixa na história que houve um erro e quando ele foi
percebido.

**O estorno** é uma linha com `tipo = 'estorno'`, `baixa_origem_id` apontando
para o recebimento original e `observacao` com o motivo — o banco já recusa
estorno sem esses dois (`baixa_cliente_estorno_exige_origem_e_motivo`).

**Regras:**

- Valor positivo, padrão igual ao do recebimento original (o caso comum é
  estorno integral seguido de novo lançamento correto).
- A soma dos estornos de um mesmo recebimento não pode exceder o valor original
  (v2.0, linha 304).
- Data efetiva não futura.
- Mesma trava de §3.2: recusado se a comissão liberada resultante ficaria menor
  que a comprometida em lotes não cancelados, com as mesmas mensagens de §3.3.

**Metade do trabalho já está pronta.** `totalPagoCliente` em `src/dominio/comissao.ts`
já soma recebimento e subtrai estorno, e as quatro consultas SQL já usam a soma
com sinal (`case when tipo = 'estorno' then -valor else valor end`). Falta só o
caminho de escrita e a tela.

## 6. Invariantes — o que o sistema recusa

Cada uma vira um teste que precisa falhar:

1. Editar `valor` ou `percentual_comissao` de modo que a liberada fique menor
   que a comprometida.
2. Editar rateio com lote não cancelado.
3. Estornar acima do valor do recebimento original (acumulado).
4. Estornar de modo que a liberada fique menor que a comprometida.
5. Cancelar lote que não está `enviado`.
6. Desfazer aprovação de lote que não está `aprovado`.
7. Qualquer uma dessas ações por quem não é `admin`.
8. Estorno ou cancelamento sem motivo.
9. Data efetiva futura no estorno.

Todas as mutações seguem o padrão da Fase 1: uma transação, sob o bloqueio
global de `controle_financeiro`, com auditoria.

## 7. Telas

- **Detalhe da OS** ganha "Editar" (admin). Cada pagamento na lista ganha
  "Estornar". Estornos aparecem como linha negativa com o motivo à vista.
- **Editar OS** reusa o formulário do cadastro, com os campos travados
  desabilitados e a explicação de §3.3 ao lado deles — a trava é visível antes
  de tentar salvar, não só depois.
- **Detalhe do lote** ganha "Cancelar lote" (de `enviado`) e "Desfazer
  aprovação" (de `aprovado`), ambos pedindo motivo. Lote cancelado mostra
  motivo, quem cancelou, e "Gerar lote substituto".
- **Lista de lotes** mostra o selo `Cancelado`, que já existe em
  `seloDeEstadoLote`.

## 8. Decisões conscientes

**Nenhuma migração.** Conferido coluna por coluna: `motivo_cancelamento`,
`lote_origem_id`, `baixa_origem_id`, `tipo`, a constraint de estorno e os
privilégios necessários já existem desde a Fase 1. Esta entrega não pede
nenhum `ALTER TABLE`, e portanto nenhuma janela de risco no banco de produção.

**Sem bloqueio otimista.** A v2.0 pede controle de versão para detectar edição
desatualizada, e `os.versao` existe sem uso. Fica sem uso: com um único admin,
o cenário protegido é abrir a mesma OS em duas abas e salvar a mais velha por
último. A transação sob bloqueio global já serializa as escritas; o que falta é
só a detecção de formulário obsoleto. Se acontecer uma vez, implementa-se —
`ErroConcorrencia` já existe para isso.

**Divergência de §3.4** — registrada ali.

## 9. Verificação

- Testes de integração no padrão do repositório: usuário real do Auth, cenário
  montado na transação e desfeito por rollback (o papel de banco não tem
  privilégio de exclusão).
- Cada invariante de §6 tem um teste que exige a recusa.
- Caminho feliz de cada ação, incluindo o ciclo completo: gerar lote → cancelar
  → conferir que a comissão voltou a "disponível" → corrigir a OS → gerar
  substituto → conferir `lote_origem_id`.
- Os 107 testes existentes continuam passando sem alteração.
- Verificação no navegador das telas novas, nos dois papéis e nos dois temas.
