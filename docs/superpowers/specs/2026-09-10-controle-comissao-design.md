Controle de Comissões — Especificação Funcional e Técnica

Versão: 2.0
Data: 10/09/2026
Documento revisado a partir da SPEC original.
Status: especificação para implementação; não representa um sistema já desenvolvido ou testado.

1. Objetivo

Sistema web para controlar as comissões de Thiago sobre ordens de serviço (OS) registradas no Mubisys.

O sistema deve acompanhar quatro fatos distintos:

A venda e sua comissão prevista.

O pagamento do cliente, que libera comissão proporcionalmente.

O envio, a conferência e o recebimento da comissão do financeiro.

O repasse interno às vendedoras Geice e Gabrielle.

O financeiro conhece somente o percentual total e o valor total de comissão. Percentuais internos, valores por pessoa, repasses e saldos individuais são exclusivos de Thiago, inclusive nas APIs, nos relatórios, nas exportações e nos registros de auditoria.

2. Premissas comerciais adotadas nesta versão

Estas decisões tornam a especificação executável e devem ficar documentadas nas regras do produto:

A operação pertence a uma única empresa. Não há multiempresa no MVP.

Thiago, Geice e Gabrielle são os três beneficiários fixos. Isso não implica três contas de acesso.

Há duas contas de acesso: Thiago, com papel admin, e um usuário identificado do financeiro, com papel financeiro.

O valor líquido comercial da OS, após os descontos já negociados, é integralmente comissionável. Não há base comissionável separada no MVP.

Frete, materiais ou outros componentes incluídos no valor cadastrado também entram na base. Se o acordo comercial exigir exclusões, essa regra deverá ser alterada antes de cadastrar vendas reais.

Juros, multas, taxas de cartão e antecipação não são lançados como pagamento do principal e não geram comissão adicional. O valor da baixa representa o principal liquidado da OS, não necessariamente o valor líquido depositado após taxas.

Em cartão parcelado, registrar o principal efetivamente liquidado para a empresa, conforme a conciliação do Mubisys. A venda no cartão, isoladamente, não representa quitação.

O financeiro pode pagar um lote parcialmente. O repasse às vendedoras é liberado somente após a confirmação do recebimento por Thiago.

Recebimentos parciais são distribuídos entre os itens do lote na ordem fixa exibida no documento. Essa ordem fica congelada no envio. O financeiro pode consultar essa regra.

Não há adiantamento às vendedoras: pagamentos novos dependem de saldo disponível positivo.

Estornos podem gerar valores a devolver ou compensar. Essas dívidas aparecem separadas dos valores disponíveis.

Cancelamento parcial de uma OS é representado por estorno de pagamentos e tratamento da comissão afetada, sem reescrever lotes anteriores. Renegociar preço de uma OS já enviada exige encerrar/corrigir a OS original e cadastrar uma nova OS vinculada; não há edição retroativa do preço.

2.1 Percentuais

Padrão inicial:

Beneficiário

Percentual sobre a base da venda

Thiago

5,00%

Geice

1,00%

Gabrielle

1,00%

Comissão total

7,00%

Os percentuais internos são pontos percentuais sobre a mesma base da venda. Assim, 1% para Geice corresponde a 1/7 da comissão quando a comissão total é 7%.

Alterar os padrões só muda as sugestões para novas OS.

3. Arquitetura

3.1 Componentes

Aplicação: Next.js com App Router e TypeScript.

Interface e mensagens: português do Brasil.

Moeda: BRL, apresentação com duas casas decimais.

Banco: Supabase Postgres.

Autenticação: Supabase Auth, e-mail e senha.

Hospedagem: ambiente compatível com Next.js e uso comercial. Não presumir elegibilidade ao Vercel Hobby para este sistema empresarial.

Dependências: versões fixadas e arquivo de lock versionado.

Migrações de banco: versionadas junto ao código.

3.2 Cálculos e transações

As regras de cálculo ficam em uma camada de domínio TypeScript, composta por funções testáveis. Não usar triggers para calcular comissões ou rateios.

As operações financeiras devem executar em uma conexão Postgres transacional no servidor: iniciar transação, bloquear os registros necessários, reler dados, calcular, validar, gravar todos os movimentos e confirmar. Usar um cliente/ORM que mantenha a mesma transação para todas essas etapas, com configuração de conexão compatível com a hospedagem escolhida.

Não executar a criação de lote, confirmação de recebimento ou pagamento de vendedora como várias chamadas REST independentes e presumir que elas formam uma transação.

O banco também aplica NOT NULL, CHECK, UNIQUE, chaves estrangeiras e restrições de acesso. Validações de somas entre várias linhas exigem transação e bloqueio; não são resolvidas por um CHECK simples.

3.3 Precisão

Valores persistidos: numeric(12,2).

Percentuais: numeric(5,2).

Cálculos: decimal exato ou inteiros em centavos com BigInt. Não converter valores monetários para Number durante os cálculos.

Percentuais podem ser representados internamente como inteiros em centésimos de ponto percentual: 7,00% = 700.

Arredondamento dos totais monetários: half-up.

Rateio de centavos: algoritmo específico do §7, que substitui o arredondamento independente de cada pessoa.

JSON: enviar dinheiro como string decimal e intervalos de centavos como strings de inteiros quando necessário.

3.4 Datas

Fuso do negócio: America/Sao_Paulo.

Datas comerciais: date.

Instantes de criação, confirmação e auditoria: timestamptz, armazenados em UTC e apresentados no fuso do negócio.

Separar data efetiva do fato e instante em que ele foi registrado.

Não usar a data de cadastro da OS como substituta da data da venda.

Datas futuras não são aceitas em recebimentos, pagamentos ou estornos realizados. Datas previstas podem ser futuras.

Lançamentos retroativos são permitidos, identificam o responsável e exigem justificativa quando corrigem período já conferido.

4. Segurança e permissões

4.1 Autenticação

Criar as duas contas manualmente; desabilitar cadastro público e acesso anônimo.

Armazenar o papel em app_metadata.role, nunca em user_metadata.

Autorizar cada leitura e mutação no servidor; não depender de botões escondidos.

Verificar sessão e papel também ao gerar relatórios e baixar comprovantes.

Alterações de papel devem considerar renovação/revogação de sessão; não presumir atualização imediata de um JWT já emitido.

Sem recuperação automática por e-mail no MVP. Documentar procedimento manual pelo responsável pelo Supabase, incluindo redefinição de senha e revogação de sessões quando necessária.

Credenciais privilegiadas, chaves secretas e senhas de banco ficam exclusivamente no servidor, nunca em variáveis NEXT_PUBLIC_*.

4.2 Separação dos dados privados

RLS protege linhas, não colunas. Dados de rateio devem ficar em tabelas próprias, e não em colunas das tabelas compartilhadas com o financeiro.

Grupo

Exemplos

Política

Comercial

OS, baixas, lotes, itens e recebimentos totais

Leitura conforme a matriz de papéis

Interno

Padrões de rateio, rateio da OS, rateio de itens, movimentos por pessoa

Somente admin

Operacional restrito

Idempotência, auditoria completa e controles transacionais

Servidor; exposição filtrada quando necessária

Tabelas internas ficam em schema privado, não exposto pela Data API, com privilégios restritos e RLS como defesa adicional. Aplicar RLS às tabelas expostas e conceder apenas as operações necessárias.

Todas as mutações financeiras passam pelo servidor. Revogar escrita direta das tabelas financeiras para os papéis de cliente anon e authenticated, inclusive quando o usuário é admin na aplicação. A conexão de escrita do servidor deve ter o menor conjunto de privilégios necessário.

Consultas do financeiro usam projeções explícitas. Nenhum JSON, HTML, payload de Server Component, relatório ou mensagem de erro enviado ao financeiro pode conter rateio. A geração do rateio em uma ação autorizada ocorre internamente no servidor.

Não criar views que inadvertidamente contornem RLS. Se houver views expostas, revisar privilégios e usar security_invoker quando aplicável. Nenhum comprovante terá URL pública permanente.

4.3 Matriz funcional

Ação

Admin — Thiago

Financeiro

Consultar OS e recebimentos do cliente

Sim

Sim

Cadastrar OS e alterar dados comerciais permitidos

Sim

Não

Definir percentual total de comissão

Sim

Não

Registrar baixa do cliente

Sim

Sim

Solicitar correção de uma baixa

Sim

Sim

Confirmar estorno, cancelamento ou ajuste financeiro

Sim

Não

Preparar e enviar lote

Sim

Consultar

Aprovar lote ou apontar divergência

Consultar

Sim

Informar pagamento do lote e anexar comprovante

Sim

Sim

Confirmar que o dinheiro foi recebido

Sim

Não

Consultar rateio e saldos individuais

Sim

Não

Registrar pagamentos/devoluções das vendedoras

Sim

Não

Alterar padrões

Sim

Não

Consultar auditoria comercial

Sim

Somente eventos comerciais permitidos

Uma correção não concede ao financeiro acesso ao rateio. Toda exceção operacional deve ter ação própria e auditoria; não conceder edição genérica de saldos ou estados.

5. Modelo de dados

5.1 Convenções

PKs: uuid, salvo sequências legíveis de lotes.

Toda entidade mutável tem criado_em, criado_por, atualizado_em e controle de versão para detectar edição desatualizada.

Movimentos financeiros confirmados são imutáveis; correção por movimento vinculado de estorno.

Chaves estrangeiras de registros financeiros usam RESTRICT para evitar exclusões em cascata.

Restringir valores aos limites do tipo numérico, sem truncamento silencioso.

Onde se menciona estorno, o vínculo, motivo, autor e data são obrigatórios. Impedir estorno acumulado maior que o movimento original.

5.2 configuracao_comercial

Uma linha, protegida por PK fixa e restrição que impeça múltiplas configurações.

Campo

Tipo

Regra

id

smallint

Valor fixo 1

percentual_comissao_padrao

numeric(5,2)

Entre 0 e 100; inicial 7,00

fuso_negocio

text

America/Sao_Paulo no MVP

O financeiro pode consultar o percentual total padrão; somente admin altera.

5.3 configuracao_rateio — privada

Uma linha vinculada à configuração comercial, com rateio_thiago_padrao, rateio_geice_padrao e rateio_gabrielle_padrao, todos numeric(5,2).

A soma deve ser igual ao percentual total padrão. Atualização das duas configurações ocorre em uma única transação. Percentuais individuais entre 0 e 100.

5.4 os

Campo

Tipo

Descrição

id

uuid

PK

numero_os

text

Obrigatório e único após normalização

cliente

text

Obrigatório

produto

text

Obrigatório

tipo_pagamento

text

Informação descritiva; não determina baixa automaticamente

valor

numeric(12,2)

Valor líquido comercial, maior que zero

percentual_comissao

numeric(5,2)

Snapshot do padrão, editável antes do primeiro envio

data_venda

date

Data comercial da venda

data_cadastro

date

Data de entrada no sistema

situacao

enum

ativa, cancelada

primeiro_envio_em

timestamptz

Preenchido no primeiro envio e nunca apagado

os_origem_id

uuid

Opcional; vínculo com OS substituída/renegociada

observacao

text

Opcional

versao

integer

Controle de edição concorrente

Normalizar número removendo espaços nas extremidades e padronizando letras para comparação. Preservar zeros à esquerda; não converter o número em inteiro. Não remover caracteres internos que tenham significado no Mubisys.

status_recebimento é derivado; não se confunde com situacao.

5.5 os_rateio — privada

Uma linha por OS: os_id como PK/FK, percentuais rateio_thiago, rateio_geice, rateio_gabrielle e algoritmo_rateio.

O algoritmo desta versão é divisores_v1, definido no §7. Os percentuais internos e total são gravados/alterados na mesma transação, com validação da soma.

5.6 baixa_cliente

Campo

Tipo

Descrição

id

uuid

PK

os_id

uuid

FK da OS

tipo

enum

recebimento, estorno

baixa_origem_id

uuid

Obrigatória para estorno

data_efetiva

date

Data do recebimento ou estorno

valor

numeric(12,2)

Magnitude positiva

referencia_externa

text

Referência de liquidação no Mubisys, se disponível

observacao

text

Motivo obrigatório no estorno

operacao_id

uuid

Vínculo à operação idempotente

O sinal é determinado por tipo. Baixas confirmadas não são editadas nem excluídas. Erro é corrigido por estorno e novo lançamento.

A referência externa, quando preenchida, deve impedir duplicação do mesmo recebimento da mesma origem. Não tratar data e valor iguais como duplicidade automática: dois pagamentos legítimos podem coincidir.

5.7 lote_financeiro

Campo

Tipo

Descrição

id

uuid

PK

numero

bigint identity

Único, sequencial e legível; lacunas são aceitáveis e números não são reutilizados

estado_conferencia

enum

rascunho, enviado, aprovado, cancelado

data_envio

date

Preenchida no envio

enviado_em / enviado_por

timestamptz / uuid

Auditoria do envio

aprovado_em / aprovado_por

timestamptz / uuid

Auditoria da aprovação

data_prevista_pagamento

date

Opcional; permite identificar atraso

valor_total_original

numeric(12,2)

Soma dos itens; congelada no envio

lote_origem_id

uuid

Opcional; lote substituído

motivo_divergencia

text

Apontamento do financeiro

motivo_cancelamento

text

Obrigatório no cancelamento

observacao

text

Opcional; alterações auditadas

Situação de recebimento é derivada: nao_recebido, parcial, recebido ou sem_valor_exigivel. Estado de conferência e recebimento são dimensões distintas.

5.8 lote_item

Cada item reserva um intervalo contínuo de centavos da comissão liberada de uma OS, conforme §7.3.

Campo

Tipo

Descrição

id

uuid

PK

lote_id

uuid

FK do lote

os_id

uuid

FK da OS

ordem

integer

Ordem fixa de recebimento parcial dentro do lote

inicio_centavo

bigint

Início inclusivo do intervalo de comissão, base zero

fim_centavo

bigint

Final exclusivo do intervalo

valor_comissao

numeric(12,2)

(fim_centavo - inicio_centavo) / 100

numero_os_snapshot

text

Número na data do envio

cliente_snapshot

text

Cliente na data do envio

produto_snapshot

text

Produto na data do envio

valor_os_snapshot

numeric(12,2)

Valor da OS no envio

percentual_comissao_snapshot

numeric(5,2)

Percentual total no envio

total_pago_cliente_snapshot

numeric(12,2)

Recebimento líquido do cliente considerado

comissao_liberada_snapshot

numeric(12,2)

Total liberado considerado

comissao_comprometida_anterior_snapshot

numeric(12,2)

Total líquido já comprometido antes deste envio

versao_calculo

text

Identificador das regras aplicadas

Unicidade de (lote_id, ordem). Uma OS normalmente gera um item por lote; pode gerar mais de um quando houver intervalos liberados por cancelamentos anteriores. O relatório pode agrupá-los por OS, mantendo a discriminação disponível.

5.9 lote_item_rateio — privada

Uma linha por item, com lote_item_id PK/FK, valor_thiago, valor_geice, valor_gabrielle, os percentuais internos congelados e algoritmo_rateio.

Os três valores são não negativos e sua soma é exatamente lote_item.valor_comissao. Não recalcular usando configurações atuais.

5.10 recebimento_financeiro

Campo

Tipo

Descrição

id

uuid

PK

lote_id

uuid

Lote aprovado ao qual o pagamento se refere

estado

enum

informado, confirmado, cancelado

data_efetiva

date

Data em que o valor entrou

valor

numeric(12,2)

Maior que zero

referencia_pagamento

text

Referência bancária ou identificador disponível

comprovante_id

uuid

Opcional

confirmado_em / confirmado_por

timestamptz / uuid

Somente admin confirma

observacao

text

Opcional

Recebimento apenas informado não libera saldo. O valor confirmado não pode superar o valor exigível ainda não recebido do lote.

Correção de recebimento confirmado gera um registro de estorno em estorno_recebimento_financeiro, vinculado ao original. Não apagar a confirmação original.

5.11 recebimento_item e recebimento_item_rateio

recebimento_item registra os intervalos exatos de comissão cobertos por cada recebimento confirmado: ID, recebimento, item do lote, início/fim do intervalo e valor.

recebimento_item_rateio, privada, registra os três valores correspondentes àqueles intervalos. Cada confirmação é distribuída na ordem dos itens e, em cada item, do menor para o maior índice de centavo ainda devido e não recebido.

Estornos de recebimento indicam os intervalos revertidos. Reverter primeiro os intervalos de maior índice dentro do recebimento original, em ordem inversa à alocação. Não reverter intervalos já estornados ou já devolvidos ao financeiro.

5.12 ajuste_comissao e ajuste_comissao_item

Registram a redução de comissão provocada por estorno/cancelamento da venda. Não alteram os valores originais do lote.

Cabeçalho: ID, OS, baixa/ação de origem, data efetiva, motivo, autor, estado (pendente, resolvido) e total do ajuste.

Itens: ID, ajuste, item de lote afetado, início/fim do intervalo removido e tratamento:

reduzir_a_receber: intervalo ainda não recebido; deixa de ser exigível no lote.

devolver_recebido: intervalo efetivamente recebido; gera obrigação de devolução ao financeiro.

O rateio de cada intervalo fica em ajuste_comissao_item_rateio, privada. Ajustes sem impacto em lotes ficam apenas no histórico da OS; não inventar um item de lote para eles.

Uma redução comercial real deve ser registrada assim que confirmada por admin. Não bloquear o registro do estorno do cliente porque a comissão já foi paga.

5.13 devolucao_financeiro

Registra devolução efetiva de comissão recebida em excesso: ID, ajuste, data, valor positivo, comprovante opcional, autor e observação.

Se parcial, alocar aos intervalos devolver_recebido ainda pendentes, em ordem de item e índice. Persistir intervalos em devolucao_financeiro_item e rateio privado correspondente.

O total devolvido não pode exceder a obrigação pendente. Não registrar devolução sobre intervalo já estornado como erro de recebimento.

No MVP, devolução é liquidada por transferência/retorno financeiro explícito. Compensação automática em outro lote não está incluída.

5.14 movimento_pessoa — privada

Extrato imutável por beneficiário, incluindo Thiago para apuração informativa.

Campo

Tipo

Descrição

id

uuid

PK

pessoa

enum

thiago, geice, gabrielle

tipo

enum

credito_recebimento, debito_estorno_recebimento, debito_ajuste_comissao, pagamento, estorno_pagamento, devolucao_vendedora

valor

numeric(12,2)

Magnitude positiva; não gerar movimentos de valor zero

data_efetiva

date

Data do fato

origem_tipo / origem_id

text / uuid

Vínculo obrigatório ao evento que gerou o movimento

movimento_origem_id

uuid

Obrigatório quando houver reversão direta

criado_em / criado_por

timestamptz / uuid

Auditoria

Crédito de recebimento é gerado quando Thiago confirma o dinheiro. Débito de ajuste de comissão é gerado quando se confirma que um intervalo já recebido deixou de ser devido, mesmo que Thiago ainda não tenha devolvido o dinheiro ao financeiro. A devolução ao financeiro liquida essa obrigação e não debita a pessoa novamente.

Pagamentos a vendedoras têm cabeçalho próprio pagamento_vendedora: pessoa, data, valor, meio, referência e comprovante opcionais. O extrato recebe movimento vinculado. Não vincular o pagamento a uma OS: o saldo é global por pessoa.

Devolução da vendedora representa dinheiro efetivamente devolvido por ela, limitado à dívida individual existente. Reduz a dívida. Estorno de pagamento corrige um registro errado e exige vínculo com o pagamento original; não confundir com devolução real.

Unicidade de evento de origem por pessoa impede gerar o mesmo crédito ou débito duas vezes. Thiago não tem baixa de retirada no MVP: sua parte é informativa, líquida dos ajustes.

5.15 operacao_idempotente

Campos: ID/chave da requisição, usuário, tipo da ação, hash do conteúdo, resultado/IDs criados e instante de conclusão.

Repetir a mesma chave com o mesmo conteúdo devolve o resultado anterior. Repetir a chave com conteúdo diferente é erro. A operação e seu resultado financeiro são confirmados na mesma transação.

5.16 auditoria_evento e comprovante

Auditoria: entidade, ID, ação, responsável, instante, data efetiva quando houver, motivo, valores anteriores/novos e identificador da operação. A aplicação não oferece edição ou exclusão do histórico.

Dados internos na auditoria são privados. A projeção comercial oferecida ao financeiro contém somente campos autorizados.

Comprovantes: metadados e chave de objeto em bucket privado, com autorização de upload/download. Aceitar PDF, JPEG e PNG até 10 MB no MVP, verificando conteúdo e tipo. Comprovantes comerciais podem ser consultados pelo financeiro; comprovantes de repasse são exclusivos do admin.

6. Cálculo de comissão e estados da OS

Definições, sempre com aritmética exata:

total_pago_cliente = soma(recebimentos) - soma(estornos)
comissao_total = round_half_up(valor_os × percentual_comissao / 100, 2)
percentual_pago = total_pago_cliente / valor_os
comissao_liberada = round_half_up(comissao_total × percentual_pago, 2)
comissao_pendente_liberar = comissao_total - comissao_liberada

Manter o cálculo sobre a comissão total já arredondada, como na SPEC original. Não alternar essa fórmula com arredondamentos independentes por pagamento. Na quitação, comissao_liberada = comissao_total exatamente.

6.1 Status de recebimento

aberta: total pago igual a zero.

parcial: total pago maior que zero e menor que o valor da OS.

quitada: total pago igual ao valor da OS.

Uma OS pode estar cancelada e ainda ter devoluções em andamento. Exibir separadamente situação comercial, status de recebimento e pendências de regularização.

6.2 Comissão comprometida e disponível

Comissão comprometida líquida: soma dos intervalos reservados por lotes enviados/aprovados, descontados intervalos removidos por ajustes. Lote recebido continua reservando seus intervalos.

Lotes em rascunho não reservam valores.

Lotes cancelados liberam suas reservas.

Comissão disponível para novo envio: valor dos intervalos liberados ainda não reservados.

Uma OS com obrigação pendente de devolução de comissão não pode gerar novo lote até sua regularização.

Não ocultar inconsistências aplicando max(0, ...) indiscriminadamente. Erros de reserva devem bloquear a operação e gerar registro técnico; obrigações reais de devolução devem aparecer em campo próprio.

6.3 Comissão zero

Se percentual total for zero, todos os percentuais internos devem ser zero. A OS continua recebendo baixas normalmente, mas não gera lote ou divisão por zero. Comissão total arredondada para zero tem o mesmo tratamento.

7. Rateio determinístico dos centavos

7.1 Objetivo e mudança em relação à versão original

Não arredondar Geice e Gabrielle separadamente em cada lote, deixando o restante para Thiago. Essa regra pode produzir parcelas negativas e alterar o resultado final conforme a divisão dos lotes.

Esta versão usa uma sequência determinística de distribuição de centavos. A soma sempre fecha, nenhuma parcela é negativa e fracionar o mesmo conjunto de centavos em lotes não altera o total de cada beneficiário.

A divisão do total entre pessoas usa este método, não half-up independente por pessoa. Pode haver diferença de centavos em relação à multiplicação isolada de cada percentual; esse comportamento é deliberado.

7.2 Função acumulada A(n) — algoritmo divisores_v1

Sejam w_T, w_G e w_B os pesos inteiros dos percentuais internos. Beneficiário com peso zero nunca recebe centavo.

A(n) retorna os centavos acumulados atribuídos a cada pessoa nos primeiros n centavos da comissão da OS.

Algoritmo de referência:

atribuido = {thiago: 0, geice: 0, gabrielle: 0}

para cada centavo de 1 até n:
    escolher a pessoa de maior peso / (atribuido[pessoa] + 1)
    ignorar pessoas de peso zero
    desempatar na ordem fixa: Thiago, Geice, Gabrielle
    atribuido[pessoa] += 1

retornar atribuido

Comparar quocientes por multiplicação cruzada de inteiros, sem ponto flutuante. Para n = 0, retornar três zeros. Se todos os pesos forem zero, só n = 0 é permitido.

Propriedades obrigatórias:

A soma das três componentes de A(n) é n.

Cada componente é não negativa e não diminui quando n cresce.

O resultado depende somente dos pesos, de n e da regra fixa de desempate.

A versão do algoritmo e os pesos ficam congelados após o primeiro envio da OS.

O laço é referência de correção. Para produção, usar a forma equivalente abaixo, com aritmética inteira exata:

se n == 0: retornar três zeros
W = soma dos pesos; exigir W > 0
atribuido[pessoa] = floor(n × peso[pessoa] / W)
restantes = n - soma(atribuido)

repetir restantes vezes:
    escolher a pessoa de maior peso / (atribuido[pessoa] + 1)
    ignorar peso zero; aplicar o mesmo desempate fixo
    atribuido[pessoa] += 1

retornar atribuido

Com três beneficiários, há no máximo dois centavos restantes nessa inicialização. A base atribui a cada pessoa sua quota inteira inferior; os maiores quocientes distribuem o restante. Isso evita um laço proporcional ao valor da comissão. Validar a equivalência com o algoritmo de referência em entradas pequenas e aleatórias e comparar quocientes por multiplicação cruzada com inteiros grandes.

7.3 Intervalos de comissão

Tratar os centavos da comissão como posições a partir de zero. Um trecho [a, b) tem b - a centavos. Seu rateio é:

rateio_trecho = A(b) - A(a)

Exemplo: com R$ 70,00 liberados, o universo disponível é [0, 7000). Um primeiro lote pode reservar [0, 3500); o seguinte reserva [3500, 7000).

Cancelar o primeiro lote libera exatamente seu intervalo. Um novo lote que o reutilize terá exatamente o mesmo rateio, mesmo que o segundo já esteja pago. Não é necessário cancelar lotes posteriores para restaurar a coerência dos centavos.

O cálculo por intervalos também é usado em recebimentos parciais, estornos e devoluções. Persistir apenas os intervalos e seus totais, não uma linha por centavo.

7.4 Geração de itens

Dentro da transação:

Calcular o universo liberado [0, comissao_liberada_em_centavos).

Subtrair reservas válidas e considerar ajustes já registrados.

Selecionar os intervalos livres das OS escolhidas pelo admin.

Gerar um item para cada intervalo contínuo, com seu rateio privado.

Ordenar os itens por número normalizado da OS, ID da OS e início do intervalo; congelar ordem.

Gravar snapshots, totais, auditoria e estado enviado.

Em uma confirmação de lote, incluir todo o saldo livre de cada OS selecionada. Seleção parcial de valor dentro de uma OS não faz parte da interface do MVP.

Nenhum intervalo ativo de uma OS pode se sobrepor a outro. A garantia é aplicada pelo serviço transacional sob bloqueio da OS, sem escrita direta pelos clientes; acrescentar restrição de exclusão no banco sobre a representação das reservas ativas, quando usada.

8. Lotes, recebimentos e pagamentos parciais

8.1 Conferência

rascunho → enviado: admin confirma; validar e congelar o documento.

enviado → aprovado: financeiro confere e aprova.

rascunho → cancelado ou exclusão física: permitido ao admin; não existe efeito financeiro.

enviado → cancelado: admin, com motivo obrigatório, desde que não haja recebimento confirmado.

Lote aprovado não é cancelado pelo fluxo comum: correção por ajuste documentado.

Divergência em lote enviado mantém o estado enviado, registra motivo e impede aprovação até resolução por cancelamento/substituição ou esclarecimento registrado.

Um pagamento apenas informado deve ser cancelado, com justificativa, antes de cancelar seu lote.

8.2 Recebimento

Informar data, valor e referência/comprovante.

Admin confirma a entrada efetiva do dinheiro.

Dentro da transação, validar lote aprovado, saldo exigível e ausência de repetição.

Alocar o valor aos itens na ordem congelada, consumindo seus intervalos válidos ainda não recebidos.

Persistir alocações e rateios.

Creditar o extrato das pessoas somente pelos valores confirmados.

Não registrar comissão como recebida com base apenas na aprovação ou no comprovante informado.

8.3 Valores do lote

valor_original = soma dos itens originais
reducao_comercial = soma dos intervalos removidos por ajustes
valor_exigivel_atual = valor_original - reducao_comercial
recebido_confirmado = recebimentos confirmados - estornos de recebimento
recebido_valido = recebido_confirmado - parcelas recebidas invalidadas por ajuste
saldo_a_receber = valor_exigivel_atual - recebido_valido
obrigacao_devolver = parcelas recebidas invalidadas - devolucoes realizadas

Não confundir redução comercial com estorno de um lançamento errado. Um intervalo recebido invalidado continua sendo caixa recebido até a devolução, mas não é mais receita válida de comissão.

Situação do recebimento:

sem_valor_exigivel: valor exigível atual igual a zero.

nao_recebido: valor exigível positivo e recebido válido igual a zero.

parcial: recebido válido entre zero e valor exigível.

recebido: recebido válido igual ao valor exigível.

Exibir obrigação de devolver e atraso como indicadores independentes. Um lote pode estar recebido e ainda ter devolução a regularizar.

9. Estornos, cancelamentos e correções

9.1 Baixa de cliente incorreta ou devolvida

Registrar estorno vinculado à baixa original, limitado ao valor ainda não estornado. Recalcular a comissão liberada na mesma transação.

Se a comissão cair de C_antiga para C_nova, os intervalos a partir de C_nova deixam de ser liberados. Para cada trecho afetado:

Situação do trecho

Tratamento

Nunca reservado

Reduzir somente a disponibilidade da OS

Reservado e ainda não recebido

Criar ajuste que reduz o valor exigível do lote

Já recebido

Criar ajuste com obrigação de devolução e débito no extrato das pessoas

Já removido por ajuste anterior

Não ajustar novamente

Excluir os trechos ajustados das reservas válidas. Preservar snapshots e emitir demonstrativo de ajuste vinculado ao documento original. Registrar a baixa, ajustes, débitos e auditoria atomicamente.

Intervalos já recebidos que forem invalidados não podem sofrer também estorno de recebimento. Essa exclusão impede redução duplicada do mesmo fato. Uma correção de erro de digitação identificada antes de confirmar deve ser feita no rascunho/informação pendente.

9.2 Cancelamento da OS

Admin informa motivo. Cancelamento completo só é concluído quando os recebimentos do cliente tiverem sido estornados/devolvidos de acordo com os fatos registrados. Enquanto isso, sinalizar solicitação/pendência de cancelamento no histórico, sem fingir que o dinheiro foi devolvido.

Ao concluir, definir situacao = cancelada. Obrigações de devolver comissão podem permanecer abertas e visíveis. OS cancelada não aceita novas baixas positivas nem novos lotes.

Retenção de multa/sinal em cancelamento e sua eventual comissão exigem regra comercial própria e ficam fora do MVP; não converter esses valores em comissão automaticamente.

9.3 Estorno de recebimento do financeiro

Usar para corrigir recebimento lançado indevidamente. Reverter apenas intervalos válidos do recebimento original, com débito correspondente no extrato das pessoas. O lote volta a ter saldo a receber referente àqueles intervalos.

Se a vendedora já recebeu sua parte, seu extrato pode ficar negativo. Isso é dívida real decorrente da correção, não um erro a ocultar. Pagamentos novos ficam bloqueados até existir saldo positivo.

9.4 Devolução de comissão já recebida

O ajuste cria a obrigação e reduz o direito das pessoas. A devolução efetiva ao financeiro é registrada à parte para comprovar saída de caixa e liquidar a obrigação, sem novo débito no extrato.

Saldo negativo de vendedora pode ser resolvido por novos créditos futuros ou devolução efetiva da vendedora. Não criar um pagamento negativo para representar essa situação.

Enquanto houver obrigação de devolver comissão de uma OS, bloquear seu reenvio. Após liquidação e eventual novo recebimento do cliente, intervalos novamente liberados podem ser usados sem reativar os registros históricos removidos.

9.5 Correções dos próprios ajustes

Não editar nem excluir ajustes confirmados, devoluções ou movimentos de repasse. Correção exige evento inverso vinculado, com restituição documentada dos intervalos e dos efeitos de caixa/direito, sem duplicação.

No MVP, o fluxo de reversão automática de um ajuste comercial fica fora de escopo. Se o evento comercial mudou novamente, registrar novo recebimento real do cliente após regularizar obrigações anteriores, ou encaminhar correção excepcional ao administrador técnico por procedimento transacional auditado e com backup. Nunca corrigir saldos por edição livre de tabela.

10. Extrato e saldo por pessoa

Para Geice e Gabrielle:

saldo_contabil =
    creditos_recebimento
  - debitos_estorno_recebimento
  - debitos_ajuste_comissao
  - pagamentos
  + estornos_pagamento
  + devolucoes_vendedora

saldo_disponivel = max(saldo_contabil, 0)
saldo_devedor = max(-saldo_contabil, 0)

O uso de max aqui separa dois estados de negócio legítimos; não mascara divergência de reserva.

Antes de confirmar um pagamento, bloquear o registro de controle da pessoa e reler seu saldo. Exigir 0 < pagamento <= saldo_disponivel.

Para Thiago, mostrar créditos líquidos de estornos e ajustes. Não há controle de retiradas pessoais.

Extrato por período:

saldo_final = saldo_inicial + creditos_do_periodo - debitos_do_periodo

Saldo inicial inclui todos os movimentos anteriores à data inicial. Exibir cada movimento com data efetiva, origem, responsável e documento relacionado, respeitando privacidade.

11. Concorrência, consistência e idempotência

11.1 Operações obrigatoriamente atômicas

Cadastrar/alterar OS junto com rateio.

Alterar padrões comerciais e internos.

Registrar baixa e seus eventuais ajustes.

Enviar ou cancelar lote e suas reservas.

Confirmar/estornar recebimento e gerar movimentos por pessoa.

Confirmar devolução ao financeiro.

Pagar, estornar pagamento ou registrar devolução de vendedora.

Se qualquer gravação falhar, fazer rollback de toda a operação, inclusive auditoria e idempotência.

11.2 Ordem de bloqueio

Para o volume do MVP, adotar uma linha de controle financeiro global bloqueada com SELECT ... FOR UPDATE no início de toda mutação financeira. Isso serializa as mutações entre os dois usuários e simplifica a proteção de operações que cruzam OS, lotes e pessoas.

Manter a transação curta: não gerar PDF, carregar arquivo, chamar serviço externo ou esperar interação humana com o bloqueio aberto. Preparar anexos antes; registrar referência autorizada na transação.

Se o volume exigir evolução, substituir por bloqueios por entidade em ordem global consistente, preservando as mesmas garantias. Não otimizar essa parte removendo a proteção do saldo.

11.3 Prévia e confirmação

Prévia de lote e saldo exibido não são autorização para gravar. Recalcular no servidor ao confirmar. Se dados relevantes mudaram desde a prévia, retornar a prévia atualizada e pedir nova confirmação da operação, sem gravar um total diferente silenciosamente.

Desabilitar botão durante envio melhora a experiência, mas não substitui idempotência e transação.

12. Validações e bloqueios de edição

OS: número único normalizado, cliente/produto preenchidos e valor positivo.

Percentuais: entre 0 e 100; soma interna igual ao total, com comparação decimal exata.

Antes do primeiro envio, valor e percentuais podem ser alterados por admin, com histórico. O novo valor nunca pode ser menor que o principal já recebido.

Após primeiro_envio_em, valor e percentuais ficam bloqueados definitivamente para edição direta, mesmo que o primeiro lote tenha sido cancelado.

Número da OS fica bloqueado após o primeiro envio. Correção excepcional deve preservar número anterior e documentos; não apagar a identificação histórica.

Cliente, produto, tipo de pagamento e observação permanecem editáveis por admin; documentos já emitidos usam os snapshots.

OS só pode ser excluída fisicamente se não possuir baixa, lote enviado, ajuste ou qualquer movimento financeiro. Nos demais casos, usar cancelamento.

Principal recebido líquido deve permanecer entre zero e o valor da OS.

Não permitir baixa positiva em OS cancelada.

Não permitir lote vazio ou item com valor zero/negativo.

Não permitir sobreposição de reservas válidas nem alocação duplicada de recebimento.

Não permitir recebimento acima do saldo exigível, estorno acima do original, devolução acima da obrigação ou pagamento de vendedora acima do saldo.

Aprovação exige lote enviado sem divergência pendente.

Recebimento confirmado exige lote aprovado e data efetiva compatível com o envio. Aprovação registrada tardiamente pode ter data de registro posterior ao pagamento; exibir os dois fatos sem adulterar datas.

Toda correção de evento confirmado exige motivo.

Mensagens de validação em português, associadas aos campos, sem recarregar a página.

13. Telas e fluxos

13.1 Login

E-mail, senha, mensagens de acesso e instrução de contato para recuperação manual. Sem cadastro público.

13.2 Painel

Indicador

Definição

Vendas no período

OS pela data de venda; cancelamentos destacados separadamente

Comissão prevista

Comissão total das OS ativas na seleção

Aguardando pagamento do cliente

Comissão ainda não liberada das OS ativas

Disponível para enviar

Intervalos liberados e livres, com pendências impeditivas destacadas

Enviada e ainda não recebida

Soma dos saldos exigíveis de lotes válidos

Recebida no período

Recebimentos confirmados por data efetiva, com estornos separados

Comissão líquida no período

Créditos de comissão menos ajustes/estornos por data efetiva

A devolver ao financeiro

Obrigações geradas menos devoluções efetivas

Saldo disponível/devedor por vendedora

Extrato individual; somente admin

Cards de saldo mostram a data de referência. Cards de movimento mostram o período. Não somar indicadores de etapas sobrepostas como se fossem valores independentes.

13.3 OS

Lista com busca por número, cliente e produto; filtros por situação, recebimento e data da venda. Cadastro com padrões preenchidos. Detalhe com linha do tempo das baixas, lotes, recebimentos, ajustes e pendências.

Admin vê o rateio. Financeiro recebe somente dados comerciais autorizados.

13.4 Baixas do cliente

Formulário a partir da OS: data, principal liquidado, referência e observação. Mostrar saldo antes/depois. Histórico oferece solicitar correção e, para admin, confirmar estorno com prévia do impacto em lotes e obrigações.

13.5 Gerar lote

Lista OS elegíveis, comissão livre e total selecionado. Permitir desmarcar OS. Salvar rascunho é opcional; rascunho não reserva saldo. Confirmação exibe destinatário financeiro, total e quantidade de OS.

Após envio, abrir detalhe e versão de impressão. Não considerar a abertura de window.print() prova de entrega externa; a disponibilização ao usuário financeiro no sistema é o envio operacional do MVP.

13.6 Lotes

Lista com número, envio, total original, ajustes, valor exigível, recebido válido, saldo, conferência, recebimento e atraso. Detalhe mostra itens, documentos, divergências, pagamentos informados, confirmações, estornos e devoluções.

13.7 Relatório interno por pessoa

Saldo inicial, créditos, ajustes, pagamentos, saldo final e eventual dívida. Filtros por pessoa e período. Ação de registrar pagamento ou devolução, com prévia do saldo resultante.

13.8 Configurações

Admin define padrões totais/internos em uma única operação. Explicar que a alteração só vale para novas OS.

14. Relatórios, impressão e exportação

14.1 Relatório original do lote — financeiro

Deve conter número do lote, data do envio, identificação do emissor, número da OS, cliente, produto, valor da OS, percentual total, principal recebido considerado, comissão liberada, comissão previamente comprometida e comissão deste lote, além do total.

Usar exclusivamente snapshots. Não incluir nomes de vendedoras, percentuais internos, valores de rateio ou observações privadas, nem no HTML oculto.

14.2 Documentos de atualização

Relatório original é imutável após o envio.

Ajustes e cancelamento geram demonstrativos vinculados, sem reescrever o original.

Extrato atual do lote mostra situação atual e deve ser identificado como extrato, distinto do documento original.

Reimpressão do original não consulta dados comerciais atuais da OS para substituir snapshots.

14.3 Formato

Impressão e salvar como PDF pelo navegador, com CSS de impressão. Papel A4, cabeçalho de tabela repetido, totais legíveis, quebras de página sem cortar linhas e versão responsiva para tela.

O MVP garante estabilidade dos dados do documento. Não garante identidade binária/pixel a pixel do PDF gerado por navegadores diferentes; arquivamento de PDF gerado no servidor pode ser adicionado posteriormente.

Exportação CSV de listagens e extratos com as mesmas permissões da interface. Usar UTF-8, cabeçalhos em português e formato documentado para abertura em planilhas; neutralizar células de texto interpretáveis como fórmulas. Não usar exportação como substituto de backup do banco.

14.4 Períodos e datas de referência

Vendas: data_venda.

Recebimentos do cliente: data_efetiva da baixa.

Comissões enviadas: data_envio.

Caixa recebido/devolvido: data efetiva dos movimentos correspondentes.

Direito por pessoa: data efetiva dos movimentos do extrato.

Relatório histórico de saldo usa eventos até a data de referência, sem aplicar retroativamente um ajuste ocorrido depois. Não reconstruir o passado apenas pelo estado atual das tabelas.

15. Auditoria, backup e operação

Registrar autor e instante em toda ação financeira, inclusive tentativas rejeitadas relevantes para suporte, sem dados sensíveis desnecessários.

Logs técnicos não devem registrar senha, token, segredo, comprovante completo ou rateio em contexto acessível ao financeiro.

Configurar backup diário do banco com retenção inicial de 30 dias e cópia fora do ambiente principal. Se o plano contratado não oferecer essa garantia, implementar rotina própria.

Incluir arquivos de comprovantes na estratégia de backup; backup de banco não pressupõe cópia dos objetos de Storage.

Validar uma restauração antes de produção e repetir após mudanças relevantes no procedimento.

Objetivos iniciais: perda máxima planejada de até 24 horas de dados e restauração em até um dia útil, sujeitos ao procedimento e infraestrutura efetivamente contratados.

Monitorar falhas de gravação, inconsistências de reserva, erros de autenticação e indisponibilidade de backup.

Na indisponibilidade do banco, bloquear confirmação financeira. Não mostrar sucesso nem registrar operações financeiras somente no navegador para sincronizar depois.

Registrar custos e limites da infraestrutura antes de produção; planos gratuitos não são garantia de disponibilidade, backup ou permissão de uso comercial.

Usar dados fictícios no ambiente de desenvolvimento e testes.

16. Índices e restrições essenciais

Índice único do número normalizado da OS.

Índices nas FKs de baixas, itens, recebimentos, ajustes, devoluções e movimentos.

Índices em OS por data de venda/situação; lotes por conferência/envio/data prevista; movimentos por pessoa/data efetiva.

Unicidade de número de lote, ordem do item no lote e eventos idempotentes.

Unicidade de os_id em os_rateio e de lote_item_id em lote_item_rateio.

CHECK de magnitudes positivas, percentuais válidos e limites de intervalos.

Somas entre tabelas, saldo e reservas validados pelo serviço na transação protegida.

Tabela de controle global deve existir por migração e não ser excluível pela aplicação.

Revisar planos de consulta com dados representativos antes de acrescentar índices indiscriminadamente.

17. Testes e critérios de aceitação

Ferramentas: Vitest para domínio; integração contra Supabase local e uma conexão Postgres real com o mesmo modelo de autorização de produção. Testes de permissão devem usar credenciais de cliente do papel avaliado, não apenas credencial privilegiada.

17.1 Domínio

OS sem pagamento, pagamento parcial e quitação.

Comissão zero e comissão arredondada para zero.

Half-up em limites de meio centavo e manutenção da comissão total na quitação.

Todos os pesos em uma pessoa; duas pessoas com Thiago zero; empates; pesos mínimos e máximo permitido.

Propriedades de A(n): soma exata, monotonicidade, não negatividade e peso zero sem atribuição.

Equivalência entre algoritmo otimizado e referência.

Ratear um intervalo inteiro ou dividi-lo em vários trechos produz os mesmos totais por pessoa.

Cancelar um intervalo antigo e reenviá-lo após um lote posterior recebido preserva o rateio.

Não há sobreposição de reservas, recebimentos ou estornos.

Extrato com saldo inicial, dívida, novos créditos, pagamento e devolução.

17.2 Fluxo nominal de referência

Com OS de R$ 10.000,00 e percentuais 5% + 1% + 1%:

Registrar R$ 5.000,00 do cliente: comissão liberada de R$ 350,00.

Enviar lote de R$ 350,00: rateio total do trecho R$ 250,00 / R$ 50,00 / R$ 50,00.

Aprovar lote.

Informar recebimento de R$ 175,00: nenhum saldo individual é liberado ainda.

Admin confirma R$ 175,00: créditos R$ 125,00 / R$ 25,00 / R$ 25,00; lote parcialmente recebido.

Confirmar outros R$ 175,00: lote recebido; créditos acumulados R$ 250,00 / R$ 50,00 / R$ 50,00.

Pagar R$ 50,00 a cada vendedora: saldos disponíveis individuais zeram.

Registrar os R$ 5.000,00 restantes do cliente: liberar novo trecho de R$ 350,00, sem repetir o primeiro.

17.3 Correções e concorrência

Duas confirmações simultâneas de lote não reservam o mesmo intervalo.

Duas baixas simultâneas não ultrapassam o principal da OS.

Dois pagamentos simultâneos não ultrapassam o saldo da pessoa.

Requisição repetida devolve o mesmo resultado sem duplicar movimentos.

Falha entre gravação de cabeçalho e itens reverte tudo.

Prévia antiga exige reconfirmação se o total ou composição mudou.

Estorno do cliente antes do envio reduz disponibilidade.

Estorno após envio reduz exigibilidade, preservando documento original.

Estorno após recebimento cria obrigação de devolver e débito individual uma única vez.

Devolução ao financeiro liquida a obrigação sem debitar novamente as pessoas.

Estorno de recebimento correto reabre saldo do lote e pode criar dívida individual.

Redução do valor da OS abaixo do principal já recebido é rejeitada, mesmo sem lote.

Pagamento parcial de lote com várias OS segue a ordem congelada.

Cancelamento de rascunho não interfere nos saldos.

17.4 Permissões e documentos

Financeiro não consegue consultar nem alterar rateio pela Data API, rotas, server actions, HTML ou exportação.

Financeiro não consegue alterar o próprio papel ou confirmar recebimento em nome do admin.

Anônimo e usuário sem papel autorizado não acessam dados do sistema.

Downloads de comprovantes respeitam o vínculo e o papel.

Reimprimir lote após editar cliente/produto mantém os dados originais.

Relatório de várias páginas mantém cabeçalho e totais legíveis.

Filtros por data não apagam saldo anterior e não aplicam ajustes futuros ao saldo histórico.

Backup restaurado permite conciliar OS, lotes, recebimentos e saldos por pessoa.

18. Limites do MVP e evolução

Incluído: cadastro manual de OS, baixas, rateio privado, lotes, divergência/cancelamento, recebimentos parciais confirmados, estornos, ajustes de comissão, devolução explícita ao financeiro, pagamentos e devoluções de vendedoras, extratos, auditoria, impressão, CSV e comprovantes privados.

Fora do MVP:

Integração/importação automática do Mubisys.

Multiempresa e cadastro dinâmico de beneficiários.

Recuperação automática de senha, convites e novos papéis.

Parcelas previstas e cobrança de inadimplência do cliente por vencimento.

Base comissionável diferente do valor líquido cadastrado.

Adiantamento de comissão ou saldo negativo por pagamento voluntário.

Compensação automática de devolução de comissão em outro lote.

Renegociação retroativa do preço/percentual de OS já enviada.

Reversão automática de ajustes comerciais já confirmados.

Comissões sobre multas, juros ou retenção de sinal em cancelamento.

Notificações por e-mail/WhatsApp e envio automático de PDF.

Assinatura digital ou PDF com identidade binária garantida.

Controle de retiradas pessoais de Thiago.

19. Ordem sugerida de implementação

Domínio decimal, rateio, intervalos e testes de propriedades.

Migrações, tabelas privadas, autenticação, privilégios, auditoria e transações.

OS, configuração e recebimentos de cliente.

Lotes com snapshots, reservas, conferência e impressão.

Recebimentos parciais, confirmação e extrato individual.

Pagamentos às vendedoras, estornos, ajustes e devoluções.

Painéis, filtros, CSV, comprovantes e restauração de backup.

Validação integrada com dados fictícios e conferência de uma amostra operacional antes do uso real.

Nenhuma etapa entra em produção com movimentação financeira real antes de passar pelos testes de concorrência, privacidade e reconciliação aplicáveis.

20. Referências técnicas

Referências consultadas na revisão; verificar compatibilidade com as versões escolhidas ao implementar:

Supabase — segurança em nível de coluna e distinção de RLS.

PostgreSQL — bloqueios explícitos e bloqueios de linha.

Vercel — condições do plano Hobby.