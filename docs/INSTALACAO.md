# Guia de Instalação — Sistema de Gestão de Microcrédito

Este guia explica, passo a passo, como colocar o sistema completo a funcionar: a base de dados no Google Sheets, o backend no Google Apps Script, e o frontend (HTML/CSS/JS).

Tempo estimado: 15 a 25 minutos na primeira configuração.

---

## Visão geral da arquitetura

```
┌─────────────────┐         fetch() em JSON        ┌──────────────────────┐        ┌───────────────┐
│   Frontend       │  ─────────────────────────►    │  Google Apps Script  │  ───►  │  Google Sheets │
│  (HTML/CSS/JS)    │  ◄─────────────────────────    │   (Web App / API)     │  ◄───  │  (base de dados)│
└─────────────────┘                                  └──────────────────────┘        └───────────────┘
```

- **Google Sheets** guarda todos os dados (clientes, empréstimos, parcelas, pagamentos, caixa, configurações, utilizadores).
- **Google Apps Script** é publicado como "Web App" e funciona como uma API REST simplificada: recebe pedidos POST em JSON e responde em JSON.
- **O frontend** (os ficheiros `.html`, `.css`, `.js` fornecidos) pode ser aberto localmente, hospedado em qualquer alojamento estático (GitHub Pages, Netlify, Vercel, ou até um servidor cPanel simples), e comunica com o Apps Script via `fetch()`.

---

## Parte 1 — Criar a Google Sheet

1. Aceda a [sheets.google.com](https://sheets.google.com) e crie uma nova folha de cálculo em branco.
2. Dê-lhe um nome, por exemplo: **"FIEL Microcrédito — Base de Dados"**.
3. Não precisa de criar manualmente nenhuma folha (aba) — o próprio sistema cria tudo automaticamente no Passo 4 abaixo.

---

## Parte 2 — Configurar o Google Apps Script

1. Na Google Sheet que acabou de criar, vá a **Extensões → Apps Script**.
2. Isto abre o editor do Apps Script, já ligado a esta planilha específica.
3. Vai ver um ficheiro `Código.gs` vazio por padrão. **Apague todo o conteúdo** desse ficheiro.
4. Para cada ficheiro `.gs` fornecido na pasta `apps-script/` deste projeto (`Codigo.gs`, `Utilitarios.gs`, `Auth.gs`, `Clientes.gs`, `Emprestimos.gs`, `Pagamentos.gs`, `Caixa.gs`, `Dashboard.gs`, `Relatorios.gs`, `Pesquisa.gs`, `Config.gs`, `Setup.gs`):
   - No editor do Apps Script, clique no ícone **"+"** ao lado de "Ficheiros" e escolha **"Script"**.
   - Dê ao novo ficheiro o mesmo nome do ficheiro fornecido (sem a extensão `.gs`, o editor adiciona automaticamente).
   - Copie e cole todo o conteúdo do ficheiro correspondente.
5. Confirme que tem 12 ficheiros de script no total (mais o `Código.gs` inicial, que deve corresponder ao conteúdo de `Codigo.gs`).
6. Clique no ícone de disquete (Guardar) ou prima `Ctrl+S` / `Cmd+S`.

### Passo importante: inicializar a base de dados

1. No topo do editor, no menu suspenso de seleção de função (ao lado do botão "Executar" ▶), escolha a função **`inicializarTudo`**.
2. Clique em **Executar** (▶).
3. Na primeira execução, o Google vai pedir autorização — clique em **"Rever permissões"**, escolha a sua conta Google, clique em **"Avançado"** e depois em **"Aceder a [nome do projeto] (não seguro)"** (esta mensagem aparece porque o script ainda não foi verificado pela Google, mas é seguro pois o código é seu).
4. Aguarde a execução terminar (deve demorar poucos segundos). Verá "Execução concluída" na parte inferior.
5. Volte à sua Google Sheet — deverá agora ver várias folhas novas: `Utilizadores`, `Clientes`, `Emprestimos`, `Parcelas`, `Pagamentos`, `Caixa`, `Configuracoes`, `Sessoes`, `Logs`, já com dados de exemplo preenchidos.

### Publicar como Web App

1. No editor do Apps Script, clique em **Implementar → Nova implementação** (canto superior direito).
2. Clique no ícone de engrenagem ⚙️ ao lado de "Selecionar tipo" e escolha **"Aplicação Web"**.
3. Preencha:
   - **Descrição**: "API FIEL Microcrédito" (ou o que preferir)
   - **Executar como**: **Eu** (a sua conta)
   - **Quem tem acesso**: **Qualquer pessoa** (isto é necessário para que o frontend consiga chamar a API sem exigir login Google separado — a autenticação do sistema é feita pelo próprio ecrã de login da aplicação)
4. Clique em **Implementar**.
5. O Google vai gerar um **URL da aplicação Web**, algo como:
   ```
   https://script.google.com/macros/s/AKfycbxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec
   ```
6. **Copie este URL** — vai precisar dele no próximo passo.

> ⚠️ **Sempre que alterar o código do Apps Script depois desta publicação inicial**, precisa de criar uma **nova implementação** (ou editar a implementação existente em "Gerir implementações" e publicar uma "Nova versão") para que as alterações tenham efeito no URL publicado.

---

## Parte 3 — Ligar o Frontend à API

1. Abra o ficheiro `js/api.js` num editor de texto.
2. Localize a linha:
   ```javascript
   const URL_BASE = 'https://script.google.com/macros/s/SUBSTITUA_PELO_SEU_ID_DE_IMPLEMENTACAO/exec';
   ```
3. Substitua o valor pelo URL que copiou no passo anterior. Deve ficar semelhante a:
   ```javascript
   const URL_BASE = 'https://script.google.com/macros/s/AKfycbxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec';
   ```
4. Guarde o ficheiro.

---

## Parte 4 — Executar o Sistema

### Opção A: Testar localmente (mais rápido, para desenvolvimento)

1. Certifique-se de que tem o [Python](https://python.org) instalado (ou o Node.js).
2. Abra um terminal na pasta raiz do projeto (onde está o `index.html`).
3. Execute:
   ```bash
   python3 -m http.server 8080
   ```
   (ou, com Node.js instalado: `npx serve .`)
4. Abra o navegador em `http://localhost:8080`.

> **Nota:** Abrir o `index.html` diretamente com duplo clique (protocolo `file://`) pode causar problemas de CORS em alguns navegadores. Usar um servidor local simples, como acima, evita esse problema.

### Opção B: Publicar online (para uso real pela empresa)

Qualquer serviço de alojamento estático funciona, pois o sistema não precisa de um servidor com backend próprio (o backend é o Google Apps Script). Opções gratuitas populares:

- **GitHub Pages**: crie um repositório, faça upload de todos os ficheiros do projeto, ative o GitHub Pages nas definições do repositório.
- **Netlify** ou **Vercel**: arraste a pasta do projeto para o painel de "deploy" — publica em segundos.
- **Alojamento cPanel tradicional**: faça upload de todos os ficheiros via FTP para a pasta `public_html`.

---

## Parte 5 — Primeiro Acesso

1. Aceda à página `login.html` (ou `index.html`, que redireciona automaticamente).
2. Use uma das credenciais de exemplo criadas automaticamente pelo `inicializarTudo`:

   | Perfil | Utilizador | Senha |
   |---|---|---|
   | Administrador | `admin` | `admin123` |
   | Operador | `operador` | `operador123` |

3. **Recomendação de segurança**: assim que aceder pela primeira vez, vá a **Configurações → Utilizadores** e altere a senha do administrador (ou crie um novo utilizador administrador e desative/exclua o de exemplo).

---

## Parte 6 — Personalização Inicial

Depois do primeiro login como Administrador, aceda a **Configurações** e ajuste:

- **Nome da Empresa** e **Logotipo** (aparecem na barra lateral de todas as páginas, na página de login, e no cabeçalho dos recibos gerados). O logotipo é guardado dentro de uma célula da folha de cálculo, por isso tem um limite de tamanho: até 35KB, idealmente uma imagem pequena (150x150px) e bem comprimida — este é o máximo que a arquitetura atual permite com segurança, sem passar para um serviço de armazenamento como o Google Drive.
- **Telefone**, **Email** e **Endereço** da empresa (aparecem no cabeçalho dos recibos de pagamento)
- **Taxa de Juros Padrão** e **Multa Padrão**
- **Número Inicial dos Contratos** e **Número Inicial dos Recibos** (se já tiver uma numeração em curso vinda de outro sistema)

---

## Parte 7 (opcional) — Manter a Folha de Cálculo Sempre Sincronizada com Atrasos

O sistema marca automaticamente empréstimos e parcelas como "Em atraso" quando a data de vencimento passa — isto já acontece sozinho sempre que alguém abre o Painel, a lista de Empréstimos, ou os relatórios de Inadimplentes/Financeiro, não é necessário nenhum passo extra para isso funcionar.

Este passo adicional serve para manter a própria folha do Google Sheets sempre atualizada mesmo quando ninguém está a usar a Web App (por exemplo, se quiser consultar ou exportar a folha diretamente, sem passar pelo sistema) e para reduzir o processamento repetido em sistemas com muitos contratos. Para ativar:

1. No editor do Apps Script, no menu de funções, selecione **`criarTriggerDiario`**.
2. Clique em **Executar** (▶) uma única vez.
3. Isto cria um acionador (trigger) que corre todos os dias por volta das 06:00, sem necessidade de intervenção manual.

Pode confirmar que o trigger foi criado no menu **Acionadores** (ícone de relógio) no editor do Apps Script.

---

## Resolução de Problemas Comuns

**"Não foi possível ligar ao servidor"**
→ Verifique se o URL em `js/api.js` está correto e termina em `/exec`. Verifique também se a implementação foi feita com "Quem tem acesso: Qualquer pessoa".

**"O servidor devolveu uma resposta inesperada"**
→ Normalmente significa que a implementação do Apps Script não está publicada corretamente, ou que houve um erro de sintaxe ao colar algum dos ficheiros `.gs`. Verifique a aba "Execuções" no editor do Apps Script para ver mensagens de erro detalhadas.

**Login não funciona mesmo com as credenciais corretas**
→ Confirme que executou `inicializarTudo` com sucesso e que a folha `Utilizadores` tem as linhas de exemplo preenchidas.

**Alterei o código do Apps Script mas nada mudou**
→ Precisa de publicar uma **nova versão** da implementação (Implementar → Gerir implementações → ícone de lápis → Nova versão → Implementar).

**Erro de permissões ao executar `inicializarTudo`**
→ Normal na primeira vez. Siga o fluxo de "Rever permissões" → "Avançado" → "Aceder a [projeto] (não seguro)" como descrito na Parte 2.

---

## Estrutura de Ficheiros do Projeto

```
/
├── index.html                  → redirecionador (login ou dashboard)
├── login.html                  → ecrã de autenticação
├── dashboard.html               → painel principal com indicadores
├── clientes.html                → gestão de clientes
├── cliente-perfil.html          → perfil detalhado de um cliente
├── emprestimos.html             → gestão de empréstimos + simulação
├── emprestimo-detalhe.html      → detalhe de contrato + plano de parcelas
├── pagamentos.html              → histórico de pagamentos + recibos
├── caixa.html                   → livro de caixa
├── relatorios.html              → relatórios + exportação PDF/Excel
├── configuracoes.html           → parâmetros do sistema + utilizadores
├── css/
│   ├── variaveis.css             → paleta de cores, tipografia, espaçamento
│   ├── base.css                  → reset e estilos globais
│   ├── layout.css                → barra lateral, barra superior, grelha
│   ├── componentes.css           → botões, badges, cartões
│   ├── formularios.css           → inputs, selects, validação
│   ├── tabelas.css               → tabelas, paginação, pesquisa
│   ├── modais.css                → janelas modais
│   ├── alertas.css               → toasts e loaders
│   ├── login.css                 → estilos exclusivos do login
│   └── paginas.css               → estilos específicos (perfil, parcelas, recibo)
├── js/
│   ├── api.js                    → comunicação com o backend (fetch)
│   ├── utils.js                  → formatação, máscaras, validação, alertas
│   ├── modal.js                  → modais genéricos e de confirmação
│   ├── layout.js                 → barra lateral, pesquisa global, sessão
│   ├── auth.js                   → lógica do login
│   ├── dashboard.js               → lógica do painel principal
│   ├── clientes.js               → lógica de gestão de clientes
│   ├── cliente-perfil.js         → lógica do perfil individual
│   ├── emprestimos.js            → lógica de empréstimos + simulação
│   ├── emprestimo-detalhe.js     → lógica do detalhe de contrato
│   ├── pagamentos.js             → lógica de pagamentos + recibo PDF
│   ├── caixa.js                  → lógica de caixa
│   ├── relatorios.js              → lógica de relatórios + exportação
│   └── config.js                 → lógica de configurações + utilizadores
├── apps-script/                  → código para colar no Google Apps Script
│   ├── Codigo.gs                 → ponto de entrada / router
│   ├── Utilitarios.gs            → funções auxiliares partilhadas
│   ├── Auth.gs                   → autenticação e sessões
│   ├── Clientes.gs               → CRUD de clientes
│   ├── Emprestimos.gs            → motor de cálculo + CRUD de empréstimos
│   ├── Pagamentos.gs             → registo de pagamentos
│   ├── Caixa.gs                  → livro de caixa
│   ├── Dashboard.gs              → indicadores agregados
│   ├── Relatorios.gs             → geração de relatórios
│   ├── Pesquisa.gs               → pesquisa global
│   ├── Config.gs                 → configurações do sistema
│   └── Setup.gs                  → inicialização automática da base de dados
├── assets/                       → (pasta para logotipos/imagens adicionais)
└── docs/
    ├── INSTALACAO.md              → este ficheiro
    └── MANUAL_UTILIZADOR.md       → guia de uso das funcionalidades
```
