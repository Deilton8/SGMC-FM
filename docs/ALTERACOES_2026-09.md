# Registo de Alterações — Revisão de Setembro de 2026

Este documento resume as correções e melhorias aplicadas ao SGMC nesta
revisão. Todas as alterações foram validadas com testes de integração
automatizados que executam o código real do sistema (não uma
reimplementação) contra um simulador do runtime do Google Apps Script —
41 verificações no total, todas a passar no estado final do código.

Não foi alterado nenhum comportamento além do descrito abaixo. Se algo
parecer diferente do esperado que não esteja listado aqui, é provável
que já fosse assim antes desta revisão.

---

## 1. Correções críticas (dinheiro e segurança)

### 1.1 Estorno de pagamento sem controlo de acesso

**O que estava errado:** `docs/MANUAL_UTILIZADOR.md` já documentava o
estorno de pagamento como "apenas Administrador", e o botão já ficava
oculto para Operadores na interface — mas o backend
(`PagamentosModulo.estornar`) não verificava o perfil de quem fazia o
pedido. Um Operador que soubesse o nome da ação podia estornar
pagamentos livremente através de um pedido direto à API, contornando a
interface.

**Correção:** adicionada a verificação `exigirPerfil_(params._utilizador,
['Administrador'])` no início da função, no ficheiro
`apps-script/Pagamentos.gs`. Agora a mesma restrição já documentada no
manual é também aplicada no servidor, que é o único lugar onde uma
restrição deste tipo é realmente eficaz (a interface pode sempre ser
contornada por quem souber fazer o pedido diretamente).

### 1.2 Multa "perdida" no estorno de pagamento

**O que estava errado:** quando um pagamento incluía multa e era
estornado, o valor retirado do caixa não incluía a multa — apenas o
valor que tinha sido aplicado às parcelas. A entrada original no caixa
tinha incluído a multa; a saída do estorno, não. Isto significava que,
a cada estorno de um pagamento com multa, o livro-caixa ficava com uma
diferença que nunca mais desaparecia.

**Correção:** `PagamentosModulo.estornar` agora regista no caixa a
saída pelo valor total que tinha entrado (valor aplicado às parcelas +
multa), mas continua a devolver ao saldo devedor do empréstimo apenas a
parte que tinha reduzido esse saldo (a multa nunca afeta o saldo
devedor, nem devia passar a afetar agora).

### 1.3 Hash de senha com uma única iteração

**O que estava errado:** as senhas eram protegidas com uma única
passagem de SHA-256. O próprio comentário no código já reconhecia que
isto era insuficiente para um cenário de vazamento de dados — um
atacante com acesso à folha de utilizadores conseguiria testar grandes
listas de senhas muito rapidamente.

**Correção:** o hash agora aplica SHA-256 repetidamente (10 000
iterações, técnica equivalente a PBKDF2), tornando um ataque de força
bruta offline milhares de vezes mais lento, sem precisar de nenhuma
biblioteca externa ou infraestrutura adicional — o Apps Script já tem
tudo o que é necessário nativamente.

Como isto muda o formato do hash gravado, foi preciso cuidar da
compatibilidade com contas já existentes: no primeiro login
bem-sucedido de cada utilizador após esta atualização, o sistema
deteta automaticamente que o hash gravado ainda é do formato antigo e
regrava-o já no formato novo, sem que a pessoa precise de fazer nada
nem perceba que isto aconteceu. Ninguém fica impedido de entrar por
causa desta alteração.

### 1.4 Condição de corrida na geração de números sequenciais

**O que estava errado:** códigos de cliente, números de contrato, de
recibo, e ids de movimento de caixa são gerados lendo "o maior número
já usado" e somando um. Se dois pedidos chegassem ao mesmo tempo — por
exemplo, duas pessoas a registar um pagamento no mesmo instante —, os
dois podiam ler o mesmo "maior número" antes de qualquer um gravar a
sua linha, resultando em dois registos diferentes com o mesmo número.

**Correção:** as ações que criam estes números (criar cliente, criar
empréstimo, registar pagamento, registar movimento de caixa, aprovar
empréstimo, estornar pagamento, criar utilizador) agora usam
`LockService.getScriptLock()` do Apps Script, que faz pedidos
concorrentes destas ações específicas esperarem a sua vez em vez de
correrem ao mesmo tempo. Ações que só leem dados (listagens,
dashboard, relatórios) não foram afetadas e continuam a correr
livremente em paralelo.

### 1.5 Estado "Em atraso" revertido incorretamente após pagamento parcial

**O que estava errado:** quando um empréstimo tinha várias parcelas em
atraso e a pessoa pagava apenas uma delas, o sistema revertia o estado
do empréstimo de "Em atraso" para "Ativo" mesmo que ainda restasse
outra parcela vencida por pagar. O contrato aparecia como saudável no
dashboard e nas listagens até à próxima sincronização automática de
atrasos (que só acontece nalgumas ações específicas), apesar de ainda
ter uma parcela vencida.

**Correção:** `PagamentosModulo.registar` agora verifica, antes de
reverter o estado, se ainda resta alguma parcela "Atrasada" que este
pagamento não tenha quitado por completo. Só reverte para "Ativo"
quando não sobra nenhuma. O valor devolvido na própria resposta da
chamada também passou a corresponder sempre ao valor realmente gravado
— antes podiam divergir dentro da mesma resposta.

---

## 2. Consistência e limpeza de código

### 2.1 Padronização de manipulação de dados nos elementos de interface

Em `emprestimos.js`, `cliente-perfil.js`, `emprestimo-detalhe.js` e
`pagamentos.js`, alguns botões inseriam dados diretamente num atributo
`onclick="..."`. Noutros ficheiros do próprio projeto (`clientes.js`,
`config.js`), o mesmo tipo de botão já usava o padrão mais robusto de
atributos `data-*` com um único recetor de eventos (delegação de
eventos) — inclusive com um comentário no código explicando a escolha.
Esta revisão estendeu esse padrão já existente aos ficheiros que ainda
não o seguiam, por consistência.

### 2.2 Comentário desalinhado em `Emprestimos.gs`

Um comentário ao lado do código que grava as parcelas geradas descrevia
as colunas na ordem errada. Não tinha impacto na execução (os valores
em si estavam corretos), mas podia confundir alguém a dar manutenção
ao código no futuro. Corrigido para refletir a ordem real das colunas.

### 2.3 Código morto no cálculo de parcelas

Dentro de `EmprestimosModulo._calcular`, o valor de `saldo` de cada
parcela era calculado uma primeira vez dentro do ciclo principal e
depois sempre substituído por um segundo cálculo, correto, feito
logo a seguir. O primeiro cálculo nunca chegava a ser usado. Removido.

---

## 3. Acessibilidade e usabilidade da interface

### 3.1 Contraste de cor insuficiente no indicador de parcela atrasada

O número identificador de uma parcela em atraso (ecrã de detalhe do
empréstimo) usava uma combinação de cor de texto sobre fundo que
ficava a 4.31:1 de contraste — abaixo do mínimo de 4.5:1 recomendado
pelas diretrizes de acessibilidade (WCAG 2.1, nível AA) para texto
normal. É precisamente a informação mais crítica de toda essa tela.

Ao investigar, verificou-se que os casos equivalentes para "pago"
(verde) e "pendente" (âmbar) já usavam uma variante mais escura da cor
exatamente por este motivo — só o caso "atrasado" (terracota) tinha
ficado por tratar da mesma forma. Foi acrescentada uma variável de cor
nova (`--cor-terracota-700`) e aplicada nos seis pontos do CSS onde a
mesma combinação aparecia (badges de estado, ícones de alerta, botão de
estorno), elevando o contraste para 5.12:1.

### 3.2 Campos de pesquisa e filtro sem rótulo associado

Em todas as páginas, o campo de pesquisa global e os filtros de tabela
(pesquisa por nome/BI/telefone, filtro de estado, filtro de método de
pagamento, filtro de datas, etc.) dependiam apenas do texto de
`placeholder` para comunicar a sua função. Um `placeholder` desaparece
assim que a pessoa começa a escrever e não é tratado como rótulo
persistente por todos os leitores de ecrã.

Foi adicionado um `<label>` associado a cada um destes campos, usando a
classe `.visualmente-oculto` que já existia no CSS do projeto (já
usada num ponto de `configuracoes.html`) mas ainda não tinha sido
aplicada de forma abrangente. Estes rótulos não mudam nada visualmente
— continuam a aparecer exatamente como antes — mas agora um leitor de
ecrã anuncia corretamente o que cada campo faz.

### 3.3 Credenciais de exemplo sempre visíveis na tela de início de sessão

A tela de login mostrava sempre, para qualquer pessoa que a
visualizasse, o utilizador e a senha das duas contas de exemplo
(`admin`/`admin123` e `operador`/`operador123`). Isto é útil durante
uma avaliação ou demonstração do sistema, mas representa um risco real
numa instalação em produção: bastaria conhecer o endereço do sistema
para poder iniciar sessão como Administrador, antes mesmo de a empresa
trocar essa senha padrão.

Esta informação passou a ficar **oculta por predefinição**. Foi
acrescentada uma nova opção em Configurações → Segurança
("Mostrar credenciais de exemplo...") que um Administrador pode ligar
explicitamente sempre que precisar de fazer uma demonstração, com um
aviso claro sobre o que isso implica.

### 3.4 Nome e logótipo da empresa nunca apareciam na tela de início de sessão

Foi detetado, como efeito colateral da investigação do ponto anterior,
que a tela de login já tinha código preparado para mostrar o nome e o
logótipo reais da empresa (configuráveis em Configurações), mas essa
chamada falhava sempre, silenciosamente, porque pedia esses dados antes
de existir qualquer sessão — e a ação correspondente exigia uma sessão
para responder. Na prática, a tela de login nunca refletia a
personalização feita pela empresa, mostrando sempre o nome e o "F"
genérico de exemplo.

Como os dados devolvidos por essa ação (nome, logótipo, contacto e
morada da empresa, moeda, taxas padrão) são informação institucional
pública, e não dados sensíveis de clientes, esta ação foi
adicionada à pequena lista de ações que não exigem sessão para
responder — juntamente com `login` e `ping`, que já estavam nessa
situação. As restantes ações de Configurações (nomeadamente
`atualizarConfiguracoes`, que grava alterações) continuam a exigir
sessão de Administrador exatamente como antes.

---

## 4. Como isto foi validado

Cada alteração desta lista foi acompanhada de um teste que reproduz o
comportamento problemático antes da correção e confirma o
comportamento correto depois dela, correndo sobre o código real do
sistema — não uma reimplementação da lógica à parte. Nenhuma correção
foi dada como concluída apenas por leitura do código.

Isto não substitui testes num ambiente real do Google Apps Script com
dados de teste antes de considerar esta versão pronta para produção,
mas dá uma confiança bastante superior à de uma simples revisão visual
do código.
