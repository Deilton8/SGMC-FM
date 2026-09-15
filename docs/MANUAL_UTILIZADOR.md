# Manual do Utilizador — Sistema de Gestão de Microcrédito

Este manual explica como usar cada funcionalidade do sistema no dia a dia.

---

## Perfis de Acesso

O sistema tem dois perfis com permissões diferentes:

| Funcionalidade | Operador | Administrador |
|---|---|---|
| Consultar dashboard, clientes, empréstimos, pagamentos | ✅ | ✅ |
| Cadastrar/editar clientes | ✅ | ✅ |
| Criar e aprovar empréstimos | ✅ | ✅ |
| Registar pagamentos | ✅ | ✅ |
| Registar movimentos de caixa | ✅ | ✅ |
| Gerar relatórios | ✅ | ✅ |
| Alterar a própria senha | ✅ | ✅ |
| Estornar pagamentos | ❌ | ✅ |
| Alterar configurações do sistema (empresa, taxas, numeração) | ❌ | ✅ |
| Gerir utilizadores (criar, editar, excluir) | ❌ | ✅ |

---

## 1. Painel Principal (Dashboard)

Ao entrar no sistema, verá de imediato:

- **Cartões de indicadores**: total de clientes, empréstimos ativos, valor emprestado, valor recebido hoje, saldo de caixa, e empréstimos em atraso.
- **Últimos Pagamentos**: os 8 pagamentos mais recentes recebidos.
- **Próximos Vencimentos**: parcelas que vencem nos próximos 30 dias.

Clique em **Atualizar** a qualquer momento para recarregar os dados mais recentes.

---

## 2. Gestão de Clientes

### Cadastrar um novo cliente

1. Vá a **Clientes** no menu lateral.
2. Clique em **Novo Cliente**.
3. Preencha os dados pessoais (nome, BI, telefone são obrigatórios), contacto, endereço e, opcionalmente, os dados do fiador.
4. Clique em **Guardar Cliente**.

### Editar ou Excluir

Na tabela de clientes, use os ícones na coluna "Ações":
- 👁️ **Olho**: abre o perfil completo do cliente.
- ✏️ **Lápis**: abre o formulário de edição.
- 🗑️ **Lixo**: exclui o cliente (só é possível se o cliente não tiver nenhum empréstimo associado — caso contrário, considere **bloquear** o cliente em vez de excluir).

### Bloquear um cliente

Ao editar um cliente, mude o campo "Estado" para **Bloqueado**. Um cliente bloqueado não pode receber novos empréstimos, mas o seu histórico permanece intacto.

### Pesquisar

Use a caixa de pesquisa no topo da tabela de clientes para filtrar por nome, BI, telefone ou código — a pesquisa é instantânea.

---

## 3. Gestão de Empréstimos

### Simular e Criar um Empréstimo

1. Vá a **Empréstimos** e clique em **Novo Empréstimo**.
2. Pesquise e selecione o cliente.
3. Preencha:
   - **Valor Solicitado**: o que o cliente pediu.
   - **Valor Aprovado**: pode ser igual ou diferente do solicitado (deixe em branco para ser igual).
   - **Taxa de Juros (%)**: aplicada sobre o valor total do prazo (juro simples).
   - **Prazo** e **Unidade** (dias, semanas ou meses).
   - **Número de Parcelas**: por padrão, igual ao prazo (ex.: prazo de 3 meses = 3 parcelas mensais), mas pode ser ajustado.
4. À direita, o **Resumo da Simulação** atualiza-se automaticamente à medida que preenche os campos, mostrando os juros totais, o valor de cada prestação, e o plano de parcelas completo.
5. Clique em **Criar Empréstimo**. O contrato é criado com estado **Pendente**, aguardando aprovação.

### Aprovar um Empréstimo

Um empréstimo Pendente precisa de ser aprovado antes de se tornar ativo:

1. Na lista de Empréstimos (ou na página de detalhe do contrato), clique no ícone ✅ (ou no botão "Aprovar").
2. Confirme a ação.
3. Ao aprovar, o sistema:
   - Muda o estado do contrato para **Ativo**.
   - Regista automaticamente uma **saída de caixa** correspondente ao valor desembolsado.

### Consultar o Detalhe de um Contrato

Clique no número do contrato em qualquer lista para ver:
- O plano de parcelas completo (com estado de cada uma: Pendente, Paga, Parcial, Atrasada).
- Os dados do contrato e do fiador.
- O botão **Registar Pagamento** (se o contrato estiver Ativo ou Em Atraso).

### Estados de um Empréstimo

| Estado | Significado |
|---|---|
| Pendente | Criado, mas ainda não aprovado/desembolsado. |
| Ativo | Aprovado e desembolsado, com parcelas em aberto. |
| Em atraso | Tem pelo menos uma parcela vencida e não paga. |
| Liquidado | Saldo devedor chegou a zero — quitado. |
| Cancelado | Cancelado antes do desembolso (só é possível quando Pendente). |

---

## 4. Registo de Pagamentos

1. Abra o detalhe do contrato (ou vá à lista de Empréstimos).
2. Clique em **Registar Pagamento**.
3. Introduza o valor pago, uma eventual multa por atraso, e o método (Dinheiro, M-Pesa, e-Mola, ou Transferência Bancária).
4. Clique em **Confirmar Pagamento**.

O sistema automaticamente:
- Aplica o valor às parcelas em aberto, começando pela mais antiga.
- Se o valor pago for menor que a parcela, marca-a como **Parcial**; se cobrir totalmente, marca como **Paga**.
- Se sobrar valor depois de cobrir todas as parcelas vencidas, aplica-o às parcelas futuras (amortização antecipada).
- Atualiza o saldo devedor do contrato.
- Se o saldo chegar a zero, muda o estado do contrato para **Liquidado**.
- Regista uma **entrada de caixa** correspondente.
- Gera um **número de recibo** sequencial.

### Consultar e Imprimir Recibos

Na página **Pagamentos**, clique no ícone de recibo 🧾 em qualquer linha para ver o recibo formatado. Clique em **Baixar PDF** para gerar um ficheiro PDF pronto a imprimir ou enviar ao cliente.

### Estornar um Pagamento (apenas Administrador)

Se um pagamento foi lançado por engano, um Administrador pode estorná-lo na página de Pagamentos (ícone ↩️). Isto devolve o valor ao saldo devedor do contrato — use com cuidado, pois pode ser necessário conferir manualmente o estado das parcelas depois.

---

## 5. Caixa

A página **Caixa** mostra o livro de caixa completo:
- **Saldo Atual**, **Entradas/Saídas de Hoje**, e o **Líquido do Mês**.
- Todos os movimentos são listados, incluindo os gerados automaticamente por desembolsos de empréstimo e recebimento de pagamentos.

### Registar um movimento manual

Use os botões **Registar Entrada** ou **Registar Saída** para lançar movimentos que não vêm automaticamente do sistema (ex.: aporte de capital dos sócios, despesas administrativas, compra de material de escritório).

---

## 6. Relatórios

Na página **Relatórios**, escolha uma das categorias disponíveis:

- **Clientes**: lista completa com filtro por data de cadastro.
- **Empréstimos**: todos os contratos, com totais de carteira.
- **Caixa**: livro de caixa detalhado por período.
- **Pagamentos**: histórico de recebimentos por período.
- **Inadimplentes**: contratos em atraso, ordenados pelo maior número de dias de atraso, com dados de contacto do cliente e do fiador para facilitar a cobrança.
- **Financeiro**: resumo consolidado da carteira (total emprestado, juros projetados, taxa de inadimplência, etc.).

Depois de gerar um relatório, use os botões **Exportar PDF** ou **Exportar Excel** para descarregar o ficheiro correspondente.

---

## 7. Configurações

### A Minha Conta
Disponível para **qualquer utilizador**, independentemente do perfil. Permite alterar a sua própria senha de acesso — é necessário indicar a senha atual, mais a nova senha (mínimo de 4 caracteres) duas vezes, para confirmação.

As restantes secções desta página (Empresa, Parâmetros Financeiros, Numeração, Segurança e Utilizadores) são visíveis **apenas para o perfil Administrador**.

### Empresa (apenas Administrador)
Nome da empresa e logotipo, usados na barra lateral (em todas as páginas) e na página de login. O nome da empresa também aparece no cabeçalho dos recibos de pagamento gerados, e o logotipo aparece ali também quando configurado. O logotipo tem um limite de 35KB (a interface avisa e explica se a imagem escolhida for maior do que isso).

### Parâmetros Financeiros (apenas Administrador)
Taxa de juros e multa padrão sugeridas ao criar novos empréstimos (podem sempre ser ajustadas individualmente em cada contrato).

### Numeração (apenas Administrador)
Define a partir de que número os próximos contratos e recibos devem começar a ser gerados — útil ao migrar de outro sistema com numeração já em curso.

### Segurança (apenas Administrador)
Controla se a página de início de sessão mostra o utilizador e a senha das contas de exemplo (Administrador e Operador). Esta opção vem **desligada por predefinição** e só deve ser ligada temporariamente para fazer uma demonstração do sistema — enquanto estiver ligada, qualquer pessoa que aceda à página de login vê essas credenciais, incluindo a senha padrão da conta de Administrador.

### Utilizadores (apenas Administrador)
Criar, editar, ativar/desativar ou excluir utilizadores do sistema, e definir se são **Operador** ou **Administrador**.

---

## 8. Pesquisa Global

A barra de pesquisa no topo (visível em todas as páginas, exceto login) permite procurar simultaneamente por **clientes** (nome, BI, telefone, código) e **contratos de empréstimo** (número do contrato). Basta digitar pelo menos 2 caracteres para ver sugestões instantâneas.

---

## Dicas Gerais

- O sistema é totalmente responsivo — pode ser usado em computador, tablet ou telemóvel.
- Use o botão de **recolher menu** (canto inferior da barra lateral, em ecrãs grandes) para ganhar mais espaço de trabalho.
- Todos os valores monetários são exibidos em Metical (MT), com separador de milhares.
- As datas são sempre exibidas no formato **DD/MM/AAAA**, conforme o padrão moçambicano.
- A sessão expira automaticamente após 12 horas de inatividade, por segurança — basta iniciar sessão novamente.
