# Controle de Comissão — Design

Data: 2026-09-10

## 1. Objetivo

Sistema web para controlar as comissões de venda do Thiago sobre ordens de serviço (OS) registradas no Mubisys. A comissão é liberada proporcionalmente ao pagamento do cliente, é enviada ao financeiro em lotes para conferência e pagamento, e depois é rateada internamente entre Thiago, Geice e Gabrielle.

Usuários: Thiago (admin) e o financeiro. O financeiro só conhece o % total de comissão (ex: 7%); o rateio entre as vendedoras é controle interno do Thiago e nunca aparece nos relatórios enviados ao financeiro.

## 2. Arquitetura

- **Aplicação**: Next.js (App Router, TypeScript), servindo as telas e as rotas de API/server actions.
- **Banco de dados**: Supabase (Postgres). Toda regra de cálculo fica no código da aplicação (camada de domínio), não em triggers do banco.
- **Autenticação**: Supabase Auth com e-mail/senha. Sem confirmação de e-mail, sem recuperação automática de senha. Dois usuários criados manualmente no painel do Supabase. Papéis: `admin` (Thiago) e `financeiro`. Só `admin` acessa a configuração e os relatórios internos de rateio.
- **Hospedagem**: Vercel (aplicação) e Supabase (banco/auth), ambos em plano gratuito.
- **Idioma da interface**: português do Brasil. Moeda: BRL.

## 3. Modelo de dados

### 3.1 `configuracao` (uma única linha)

| Campo | Tipo | Descrição |
|---|---|---|
| percentual_comissao_padrao | numeric(5,2) | Padrão 7.00 |
| rateio_thiago_padrao | numeric(5,2) | Padrão 5.00 |
| rateio_geice_padrao | numeric(5,2) | Padrão 1.00 |
| rateio_gabrielle_padrao | numeric(5,2) | Padrão 1.00 |

Alterar a configuração afeta apenas os valores sugeridos em OS novas; OS já cadastradas não mudam.

### 3.2 `os`

| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| numero_os | text | Único, obrigatório |
| cliente | text | Obrigatório |
| produto | text | Obrigatório |
| tipo_pagamento | text | Texto livre (ex: "Boleto", "Cartão 3x") |
| valor | numeric(12,2) | > 0 |
| percentual_comissao | numeric(5,2) | Copiado da configuração ao criar; editável |
| rateio_thiago | numeric(5,2) | Copiado da configuração ao criar; editável |
| rateio_geice | numeric(5,2) | idem |
| rateio_gabrielle | numeric(5,2) | idem |
| data_cadastro | date | Padrão: hoje |
| observacao | text | Opcional |
| criado_em / atualizado_em | timestamptz | |

Regra: `rateio_thiago + rateio_geice + rateio_gabrielle = percentual_comissao` (validado na aplicação).

Status da OS não é armazenado; é derivado do total pago (ver §4).

### 3.3 `baixa_cliente` (pagamentos recebidos do cliente)

| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| os_id | uuid | FK → os |
| data | date | |
| valor | numeric(12,2) | > 0; soma das baixas da OS não pode ultrapassar `os.valor` |
| observacao | text | Opcional |

### 3.4 `lote_financeiro` (relatório enviado ao financeiro)

| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| numero | serial | Número sequencial legível (Lote 1, 2, 3…) |
| status | enum | `enviado` → `aprovado` → `pago` |
| data_envio | date | |
| data_aprovacao | date | Nulo até aprovar |
| data_pagamento | date | Nulo até pagar |
| valor_total | numeric(12,2) | Soma dos itens, congelada no envio |
| observacao | text | Opcional |

### 3.5 `lote_item`

| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| lote_id | uuid | FK → lote_financeiro |
| os_id | uuid | FK → os |
| valor_comissao | numeric(12,2) | Comissão total (ex: 7%) daquele trecho, congelada |
| valor_thiago | numeric(12,2) | Rateio congelado no momento do envio |
| valor_geice | numeric(12,2) | idem |
| valor_gabrielle | numeric(12,2) | idem |

Os valores de rateio são congelados no item para que mudanças posteriores no rateio da OS não alterem lotes já enviados. `valor_thiago + valor_geice + valor_gabrielle = valor_comissao` sempre.

Uma mesma OS pode aparecer em vários lotes (um trecho por lote, conforme o cliente vai pagando).

### 3.6 `baixa_vendedora` (pagamentos feitos pelo Thiago às vendedoras)

| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| pessoa | enum | `geice` \| `gabrielle` |
| data | date | |
| valor | numeric(12,2) | > 0; não pode exceder o saldo disponível da pessoa |
| observacao | text | Opcional |

Pagamento em lote, sem vínculo com OS.

## 4. Regras de cálculo

Todos os valores em reais com 2 casas decimais. Arredondamento half-up.

**Por OS:**

- `comissao_total = round(valor × percentual_comissao / 100)`
- `total_pago_cliente = Σ baixa_cliente.valor`
- `percentual_pago = total_pago_cliente / valor` (0 a 1)
- `status`: `aberta` se `total_pago_cliente = 0`; `quitada` se `total_pago_cliente = valor`; senão `parcial`
- `comissao_liberada = round(comissao_total × percentual_pago)`
- `comissao_pendente_liberar = comissao_total − comissao_liberada`
- `comissao_enviada = Σ lote_item.valor_comissao` da OS (todos os lotes, qualquer status)
- `comissao_liberada_nao_enviada = comissao_liberada − comissao_enviada` — é o valor candidato ao próximo lote. Nunca negativo (se for, é bug de validação).

**Ao gerar um lote:**

- Para cada OS com `comissao_liberada_nao_enviada > 0`, cria-se um `lote_item` com `valor_comissao = comissao_liberada_nao_enviada`.
- Rateio do item: `valor_geice = round(valor_comissao × rateio_geice / percentual_comissao)`, `valor_gabrielle` idem, `valor_thiago = valor_comissao − valor_geice − valor_gabrielle` (o centavo de arredondamento fica com Thiago).
- `lote.valor_total = Σ valor_comissao`.
- O usuário pode desmarcar OS antes de confirmar o lote (para segurar alguma OS para o próximo envio).

**Por pessoa (Geice/Gabrielle):**

- `recebido_do_financeiro = Σ lote_item.valor_<pessoa>` onde `lote.status = 'pago'`
- `pago_a_pessoa = Σ baixa_vendedora.valor` da pessoa
- `saldo_disponivel = recebido_do_financeiro − pago_a_pessoa`

**Por Thiago (informativo):**

- `recebido_do_financeiro = Σ lote_item.valor_thiago` em lotes pagos (não há baixa; é a parte que fica com ele).

## 5. Fluxo principal

1. Cadastrar OS (valores de comissão e rateio já vêm preenchidos da configuração; podem ser ajustados).
2. Registrar cada pagamento do cliente como uma `baixa_cliente`. A comissão liberada sobe proporcionalmente.
3. Tela "Gerar relatório para o financeiro" lista todas as OS com valor liberado e não enviado. Ao confirmar, cria o lote com status `enviado` e abre a versão para impressão/PDF (sem rateio).
4. Após a conferência do financeiro (≈2 dias), o usuário marca o lote como `aprovado`, informando a data.
5. Quando o dinheiro é recebido, marca como `pago`, informando a data. Nesse momento a parte da Geice e da Gabrielle das OS do lote passa a compor o saldo disponível delas.
6. Thiago registra os pagamentos às vendedoras em `baixa_vendedora` quando quiser, abatendo do saldo.

## 6. Telas

1. **Login** — e-mail e senha.
2. **Painel** — cards: total vendido, comissão gerada, liberada, enviada ao financeiro, recebida (lotes pagos), saldo a pagar Geice, saldo a pagar Gabrielle (os dois últimos só para admin). Atalhos para as ações principais.
3. **OS** — listagem com filtros (status, cliente, período, busca por nº OS), cadastro/edição, e detalhe da OS com as baixas do cliente e o histórico de lotes em que entrou.
4. **Baixas do cliente** — lançadas a partir do detalhe da OS.
5. **Gerar relatório para o financeiro** — prévia com seleção das OS, total, botão confirmar (gera o lote).
6. **Lotes** — listagem (número, data, total, status), detalhe com as OS do lote, botões "Marcar aprovado" / "Marcar pago", e impressão/PDF do relatório.
7. **Relatórios**:
   - Saldo pendente por OS (abertas/parciais): valor pago, faltante, comissão pendente de liberar.
   - Comissão por pessoa (admin): recebido do financeiro rateado, pago a cada uma, saldo disponível; lista de baixas às vendedoras com botão para lançar nova.
   - Extrato por período: filtro de datas; OS cadastradas, baixas do cliente e lotes no período; totais de venda, comissão gerada, enviada e recebida.
8. **Configuração** (admin) — % padrão de comissão e rateio padrão.

Impressão/PDF: via CSS de impressão do navegador (`window.print()`), sem biblioteca extra.

## 7. Validações

- `numero_os` único; `valor > 0`; percentuais entre 0 e 100; soma do rateio igual ao % de comissão.
- Baixa do cliente: `valor > 0` e `Σ baixas ≤ os.valor`.
- OS que já está em algum lote: não pode ser excluída; `valor`, `percentual_comissao` e rateio ficam bloqueados para edição (cliente, produto, tipo de pagamento e observação continuam editáveis).
- Baixa do cliente não pode ser excluída/reduzida se isso deixar `comissao_liberada < comissao_enviada`.
- Lote: transições só para frente (`enviado → aprovado → pago`). Excluir lote só se status `enviado`.
- Baixa à vendedora: `valor ≤ saldo_disponivel` no momento do lançamento.
- Erros de validação aparecem no formulário, em português, sem recarregar a página.

## 8. Permissões

| Ação | admin | financeiro |
|---|---|---|
| OS, baixas do cliente, gerar lote, mudar status do lote | sim | sim |
| Ver rateio nas telas de OS e lotes | sim | não |
| Relatório por pessoa, baixas às vendedoras | sim | não |
| Configuração | sim | não |

Papel armazenado em `app_metadata.role` do usuário no Supabase Auth. Verificação de papel feita no servidor (server actions/rotas), e RLS no Postgres restringindo `configuracao`, `baixa_vendedora` e as colunas de rateio a `admin`. Como o rateio fica em colunas da própria tabela `os` e `lote_item`, a aplicação omite essas colunas nas consultas feitas para o papel `financeiro`; RLS protege as tabelas exclusivas.

## 9. Testes

- **Unitários (domínio)**: funções puras de cálculo — status da OS, comissão liberada, liberada não enviada, geração de itens do lote (incluindo arredondamento e o centavo para Thiago), saldo por pessoa, todas as validações do §7.
- **Integração**: fluxo completo contra um banco Supabase local: cadastrar OS → duas baixas parciais → gerar lote → segunda baixa depois do lote gera novo trecho → marcar pago → saldo Geice/Gabrielle → baixa à vendedora → saldo zera.
- Ferramentas: Vitest para unitários; para integração, Vitest contra Supabase CLI local.

## 10. Fora de escopo (por enquanto)

- Importação de arquivo do Mubisys.
- Recuperação de senha, convite de usuários, mais de dois papéis.
- Cadastro de vendedoras dinâmico (Geice e Gabrielle são fixas; adicionar uma terceira exige mudança de código).
- Rejeição/devolução de lote pelo financeiro (se acontecer, exclui-se o lote `enviado` e gera-se outro).
- Notificações por e-mail.
