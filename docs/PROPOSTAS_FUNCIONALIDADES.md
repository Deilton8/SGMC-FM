# Propostas de Novas Funcionalidades

Estas são ideias levantadas durante a revisão de setembro de 2026, com
base no que já existe no sistema e no domínio de microcrédito. **Nada
aqui foi implementado.** São propostas para avaliação e priorização,
não bugs nem correções — cada uma implica decisões de produto (regras
de negócio, permissões, o que mostrar e quando) que fazem mais sentido
vindas de quem opera o negócio do dia a dia do que assumidas por mim.

Estão agrupadas por tema e, dentro de cada tema, por esforço estimado
aproximado (não é uma estimativa rigorosa, serve só para orientar a
conversa sobre por onde começar).

---

## Cobrança e relacionamento com clientes

**Notificações automáticas de vencimento e atraso (esforço médio).**
O sistema já sabe exatamente quando cada parcela vence e já distingue
"Pendente" de "Atrasada". O que falta é agir sobre essa informação:
enviar um lembrete automático (SMS ou WhatsApp, sendo os dois canais
mais comuns em Moçambique) 2-3 dias antes do vencimento, e um aviso
diferente quando a parcela já está atrasada. O Apps Script já tem um
trigger diário configurado para `tarefaDiariaAtualizarAtrasos`
(`docs/INSTALACAO.md`) — seria natural estender essa mesma rotina para
também disparar notificações, em vez de criar um mecanismo à parte.
Isto reduziria trabalho manual de cobrança e é provavelmente a
funcionalidade com maior impacto direto no negócio de tudo o que está
nesta lista.

**Histórico de comunicação por cliente (esforço pequeno).** Um campo
simples de notas/registo de contactos no perfil do cliente ("liguei a
dia X, disse que paga até Y"), visível na aba de perfil que já existe
em `cliente-perfil.html`. Ajuda quando mais do que uma pessoa da equipa
lida com cobrança do mesmo cliente.

**Pontuação de risco simples do cliente (esforço médio).** Com base no
histórico já registado (pagamentos pontuais vs. atrasados, número de
empréstimos anteriores liquidados sem incidentes), calcular um
indicador simples de risco para ajudar na decisão de aprovar um novo
pedido de crédito. Não é um modelo de crédito sofisticado — algo tão
simples quanto "X% dos pagamentos anteriores foram pontuais" já teria
valor prático nesta escala de operação.

---

## Operação do dia a dia

**Renegociação/reestruturação de empréstimo (esforço médio-alto).** É
comum, em microcrédito, um cliente em dificuldade pedir para
renegociar as condições em vez de simplesmente entrar em
incumprimento. O sistema atual não tem um fluxo para isto — hoje, a
única forma de lidar com isto seria cancelar o contrato e criar um
novo manualmente, o que perde o histórico e a rastreabilidade. Um
fluxo dedicado (que gerasse um novo plano de parcelas preservando a
ligação ao contrato original) seria mais correto para efeitos de
relatório e de histórico do cliente.

**Anexar documentos ao cliente/contrato (esforço médio).** Cópia do
BI, comprovativo de residência ou de rendimento, contrato assinado.
Google Drive já é uma integração natural aqui, já que o sistema inteiro
já vive dentro do ecossistema Google (a base de dados é uma Google
Sheet). Guardar o link do ficheiro no Drive junto ao registo do cliente
seria mais simples do que gerir upload de ficheiros dentro do próprio
Apps Script.

**Exportação de recibo/comprovativo por WhatsApp (esforço pequeno).**
O sistema já gera recibos (mencionado no manual do utilizador,
secção 4). Adicionar um botão que prepara a mensagem e abre o
WhatsApp Web/App com o recibo pronto para enviar ao cliente seria uma
melhoria pequena com uso frequente no dia a dia.

---

## Gestão e visão do negócio

**Metas e comissões de operadores (esforço médio).** Se a equipa
comercial trabalha com metas de carteira ou de cobrança, um painel
simples por operador (quanto foi desembolsado, quanto foi cobrado,
taxa de inadimplência da sua carteira) seria uma extensão natural do
`Dashboard.gs` que já existe, filtrando pelos registos que cada
operador processou.

**Alertas de concentração de risco (esforço pequeno-médio).** Um aviso
simples quando uma parcela muito grande da carteira total está
concentrada num único cliente ou é liquidada num único mês — útil para
gestão de risco/liquidez da própria instituição, não do cliente
individual.

**Backup/exportação periódica automática (esforço pequeno).** Como a
"base de dados" inteira é uma Google Sheet, já beneficia do histórico
de versões nativo do Google Sheets — mas um backup automático semanal
para uma cópia separada (outra Sheet ou um ficheiro Excel no Drive)
daria uma camada extra de proteção contra edição acidental ou exclusão
da folha principal, sem depender de alguém lembrar-se de o fazer
manualmente.

---

## Observação técnica geral

Vale notar, para qualquer uma destas frentes que venha a avançar, que a
arquitetura atual (Google Sheets como base de dados) tem um teto de
escala conhecido e já reconhecido pela própria documentação do projeto
(`docs/INSTALACAO.md` já assume isto como uma opção deliberada, dado o
custo zero de infraestrutura). Funcionalidades que envolvam grandes
volumes de leitura/escrita (por exemplo, notificações em massa para
uma carteira de milhares de clientes) devem ter isso em conta desde o
desenho — o que é tranquilamente viável para uma carteira de centenas
de clientes pode exigir uma abordagem diferente numa escala maior.
