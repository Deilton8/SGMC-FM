# Sistema de Gestão de Microcrédito — FIEL Microcrédito, E.I.

Sistema web completo de gestão de microcrédito, construído com **HTML5, CSS3 e JavaScript puro (Vanilla JS)**, sem frameworks, usando o **Google Sheets** como base de dados através do **Google Apps Script**.

Desenhado para pequenas empresas de microcrédito em Moçambique: valores em Metical (MZN), telefones no formato local, métodos de pagamento M-Pesa e e-Mola, e datas no formato DD/MM/AAAA.

---

## Início Rápido

1. Leia **[docs/INSTALACAO.md](docs/INSTALACAO.md)** para o guia completo de configuração (Google Sheets + Apps Script + frontend). Leva cerca de 15–25 minutos.
2. Depois de instalado, consulte **[docs/MANUAL_UTILIZADOR.md](docs/MANUAL_UTILIZADOR.md)** para aprender a usar todas as funcionalidades.
3. Para saber o que mudou na revisão mais recente, veja **[docs/ALTERACOES_2026-09.md](docs/ALTERACOES_2026-09.md)**. Para ideias de próximas funcionalidades ainda por avaliar, veja **[docs/PROPOSTAS_FUNCIONALIDADES.md](docs/PROPOSTAS_FUNCIONALIDADES.md)**.

---

## Funcionalidades

- ✅ Dashboard com indicadores em tempo real
- ✅ Gestão completa de clientes (com dados de fiador)
- ✅ Simulação e criação de empréstimos com cálculo automático de juros e parcelas
- ✅ Ciclo de vida completo do empréstimo (Pendente → Ativo → Liquidado / Em Atraso / Cancelado)
- ✅ Registo de pagamentos parciais e totais, com aplicação automática às parcelas
- ✅ Geração de recibos em PDF
- ✅ Livro de caixa com entradas e saídas
- ✅ Relatórios de Clientes, Empréstimos, Caixa, Pagamentos, Inadimplentes e Financeiro
- ✅ Exportação de relatórios em PDF e Excel
- ✅ Pesquisa global (clientes e contratos)
- ✅ Configurações personalizáveis (empresa, taxas padrão, numeração)
- ✅ Gestão de utilizadores com dois perfis (Administrador e Operador), cada um podendo alterar a própria senha
- ✅ Interface responsiva (computador, tablet, telemóvel)
- ✅ Autenticação com sessão via LocalStorage

## Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6+ (sem frameworks) |
| Backend / API | Google Apps Script (Web App) |
| Base de Dados | Google Sheets |
| Ícones | Font Awesome 6 |
| Geração de PDF | jsPDF + jsPDF-AutoTable |
| Exportação Excel | SheetJS (xlsx) |

## Estrutura do Projeto

Ver a árvore de ficheiros completa em [docs/INSTALACAO.md](docs/INSTALACAO.md#estrutura-de-ficheiros-do-projeto).

## Credenciais de Teste (dados de exemplo)

Depois de executar `inicializarTudo` no Apps Script (ver guia de instalação):

| Perfil | Utilizador | Senha |
|---|---|---|
| Administrador | `admin` | `admin123` |
| Operador | `operador` | `operador123` |

**Altere estas credenciais antes de usar o sistema em produção.**

## Licença e Uso

Este sistema foi desenvolvido como um projeto sob encomenda. Sinta-se à vontade para o personalizar, estender e adaptar às necessidades específicas do seu negócio.
