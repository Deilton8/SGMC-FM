/**
 * =====================================================================
 * SISTEMA DE GESTÃO DE MICROCRÉDITO — BACKEND (Google Apps Script)
 * =====================================================================
 * Ficheiro: Codigo.gs
 * Função:   Ponto de entrada da Web App. Recebe todos os pedidos GET/POST
 *           vindos do frontend (fetch), roteia para o módulo correto e
 *           devolve sempre uma resposta JSON.
 *
 * Como publicar:
 *   Extensões > Apps Script > Implementar > Nova implementação
 *   Tipo: Aplicação Web | Executar como: Eu | Quem tem acesso: Qualquer pessoa
 *   (ver docs/INSTALACAO.md para o passo a passo completo)
 * =====================================================================
 */

// ID da Google Sheet que serve de base de dados.
// Deixe vazio ('') para usar a planilha onde o script está anexado (recomendado).
const SPREADSHEET_ID = '';

/**
 * Devolve o objeto Spreadsheet ativo (anexado) ou o indicado por SPREADSHEET_ID.
 */
function getSpreadsheet_() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Ponto de entrada para pedidos GET.
 * Usado para ações de leitura (listar, pesquisar, exportar) e também
 * aceite para todas as ações, já que alguns clientes preferem GET.
 */
function doGet(e) {
  return handleRequest_(e);
}

/**
 * Ponto de entrada para pedidos POST.
 * O corpo (e.postData.contents) deve ser um JSON com pelo menos o
 * campo "action". Usado para criar/atualizar/excluir e login.
 */
function doPost(e) {
  return handleRequest_(e);
}

/**
 * Router central: interpreta a ação pedida e delega ao módulo responsável.
 * Todas as respostas passam por jsonResponse_() para garantir um formato
 * consistente: { success: true|false, data: ..., message: "...", error: "..." }
 */
function handleRequest_(e) {
  const inicio = new Date().getTime();
  let params = {};

  try {
    // Suporta tanto parâmetros de query (GET) como corpo JSON (POST)
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
      // Quando enviado via GET com um campo "payload" serializado
      if (params.payload) {
        params = Object.assign({}, params, JSON.parse(params.payload));
      }
    }

    const action = params.action;
    if (!action) {
      return jsonResponse_(erro_('Parâmetro "action" em falta no pedido.'));
    }

    // Todas as ações exceto as abaixo exigem um token de sessão válido.
    // 'obterConfiguracoes' também dispensa token porque a tela de login
    // (login.html, ver js/auth.js) precisa dela para mostrar o nome e o
    // logotipo reais da empresa ANTES de qualquer sessão existir — sem
    // essa exceção, essa chamada falhava sempre com SESSAO_INVALIDA e a
    // tela de login nunca refletia a personalização feita em
    // Configurações, mostrando sempre o nome/logo padrão de fábrica. Os
    // dados devolvidos por essa ação (nome, logotipo, contacto e endereço
    // da empresa, moeda, taxa de juros e multa padrão) são informação
    // institucional pública, não dados sensíveis de clientes ou de
    // segurança — não há risco em não exigir sessão aqui.
    if (action !== 'login' && action !== 'ping' && action !== 'obterConfiguracoes') {
      const sessao = validarToken_(params.token);
      if (!sessao.valido) {
        return jsonResponse_(erro_('Sessão inválida ou expirada. Faça login novamente.', 'SESSAO_INVALIDA'));
      }
      params._utilizador = sessao.utilizador;
    }

    let resultado; // preenchida abaixo, com ou sem lock, antes de qualquer uso

    // Antes de qualquer ação que leia/apresente estados de empréstimo ou
    // parcela dependentes de data (listagens, dashboard, relatórios de
    // inadimplência/financeiro), sincroniza atrasos com a data de hoje.
    // Isto faz o sistema marcar "Em atraso" corretamente mesmo que o
    // trigger diário (ver docs/INSTALACAO.md) não tenha sido configurado,
    // e evita até 24h de desfasamento entre o vencimento real e a próxima
    // execução agendada do trigger. Falhas aqui são silenciadas de
    // propósito — um erro nesta sincronização de fundo não deve impedir a
    // ação que o utilizador pediu.
    const ACOES_QUE_EXIGEM_ATRASOS_SINCRONIZADOS = [
      'listarEmprestimos', 'obterEmprestimo', 'listarParcelas', 'obterDashboard',
      'relatorioInadimplentes', 'relatorioFinanceiro'
    ];
    if (ACOES_QUE_EXIGEM_ATRASOS_SINCRONIZADOS.indexOf(action) !== -1) {
      try {
        EmprestimosModulo.atualizarAtrasos();
      } catch (erroSincronizacao) {
        Logger.log('Aviso: falha ao sincronizar atrasos antes de "' + action + '": ' + erroSincronizacao);
      }
    }

    // Ações que geram um identificador/número sequencial (código de
    // cliente, número de contrato, número de recibo, id de movimento de
    // caixa, id de utilizador) fazem isso "lendo o maior número existente
    // e somando 1" (ver gerarProximoId_/gerarProximoNumeroContrato_/
    // gerarProximoNumeroRecibo_ em Utilitarios.gs). Se dois pedidos destas
    // ações chegarem ao mesmo tempo — duas pessoas a registar um cliente
    // ou um pagamento no mesmo instante, por exemplo — os dois podem ler o
    // mesmo "maior número" antes de qualquer um gravar a sua linha, e
    // acabar por gerar o MESMO código/número para dois registos diferentes.
    // O LockService.getScriptLock() serializa a execução destas ações
    // entre si (pedidos concorrentes ficam à espera da vez, em vez de
    // correr ao mesmo tempo), eliminando a janela onde a corrida acontece.
    // Não se aplica a ações só de leitura, que podem continuar a correr
    // livremente em paralelo sem risco nenhum.
    const ACOES_QUE_PRECISAM_DE_LOCK = [
      'criarCliente', 'criarEmprestimo', 'registarPagamento',
      'registarMovimento', 'aprovarEmprestimo', 'estornarPagamento',
      'criarUtilizador'
    ];

    if (ACOES_QUE_PRECISAM_DE_LOCK.indexOf(action) !== -1) {
      const bloqueio = LockService.getScriptLock();
      const conseguiuBloquear = bloqueio.tryLock(10000); // espera até 10s pela vez
      if (!conseguiuBloquear) {
        return jsonResponse_(erro_(
          'O sistema está a processar outro pedido em simultâneo. Tente novamente em alguns segundos.',
          'SISTEMA_OCUPADO'
        ));
      }
      try {
        resultado = executarAcao_(action, params);
      } finally {
        bloqueio.releaseLock();
      }
      resultado._tempoMs = new Date().getTime() - inicio;
      return jsonResponse_(resultado);
    }

    resultado = executarAcao_(action, params);
    resultado._tempoMs = new Date().getTime() - inicio;
    return jsonResponse_(resultado);

  } catch (err) {
    LoggerApp.erro('handleRequest_', err, params);
    return jsonResponse_(erro_('Erro interno no servidor: ' + err.message, 'ERRO_SERVIDOR'));
  }
}

/**
 * Executa a ação já identificada e autenticada, delegando ao módulo
 * responsável. Extraído de handleRequest_ para poder ser chamado tanto
 * dentro do bloco com lock quanto fora dele, sem duplicar o switch.
 */
function executarAcao_(action, params) {
    let resultado;

    switch (action) {
      case 'ping':
        resultado = sucesso_({ pong: true, hora: new Date().toISOString() });
        break;

      // ---------- AUTENTICAÇÃO ----------
      case 'login':
        resultado = AuthModulo.login(params);
        break;
      case 'validarSessao':
        resultado = AuthModulo.validarSessao(params);
        break;
      case 'alterarSenha':
        resultado = AuthModulo.alterarSenha(params);
        break;
      case 'listarUtilizadores':
        resultado = AuthModulo.listarUtilizadores(params);
        break;
      case 'criarUtilizador':
        resultado = AuthModulo.criarUtilizador(params);
        break;
      case 'atualizarUtilizador':
        resultado = AuthModulo.atualizarUtilizador(params);
        break;
      case 'excluirUtilizador':
        resultado = AuthModulo.excluirUtilizador(params);
        break;

      // ---------- CLIENTES ----------
      case 'listarClientes':
        resultado = ClientesModulo.listar(params);
        break;
      case 'obterCliente':
        resultado = ClientesModulo.obter(params);
        break;
      case 'criarCliente':
        resultado = ClientesModulo.criar(params);
        break;
      case 'atualizarCliente':
        resultado = ClientesModulo.atualizar(params);
        break;
      case 'excluirCliente':
        resultado = ClientesModulo.excluir(params);
        break;
      case 'pesquisarClientes':
        resultado = ClientesModulo.pesquisar(params);
        break;

      // ---------- EMPRÉSTIMOS ----------
      case 'listarEmprestimos':
        resultado = EmprestimosModulo.listar(params);
        break;
      case 'obterEmprestimo':
        resultado = EmprestimosModulo.obter(params);
        break;
      case 'simularEmprestimo':
        resultado = EmprestimosModulo.simular(params);
        break;
      case 'criarEmprestimo':
        resultado = EmprestimosModulo.criar(params);
        break;
      case 'atualizarEmprestimo':
        resultado = EmprestimosModulo.atualizar(params);
        break;
      case 'aprovarEmprestimo':
        resultado = EmprestimosModulo.aprovar(params);
        break;
      case 'cancelarEmprestimo':
        resultado = EmprestimosModulo.cancelar(params);
        break;
      case 'excluirEmprestimo':
        resultado = EmprestimosModulo.excluir(params);
        break;
      case 'listarParcelas':
        resultado = EmprestimosModulo.listarParcelas(params);
        break;

      // ---------- PAGAMENTOS ----------
      case 'listarPagamentos':
        resultado = PagamentosModulo.listar(params);
        break;
      case 'registarPagamento':
        resultado = PagamentosModulo.registar(params);
        break;
      case 'estornarPagamento':
        resultado = PagamentosModulo.estornar(params);
        break;
      case 'gerarReciboTexto':
        resultado = PagamentosModulo.gerarReciboTexto(params);
        break;

      // ---------- CAIXA ----------
      case 'listarCaixa':
        resultado = CaixaModulo.listar(params);
        break;
      case 'registarMovimento':
        resultado = CaixaModulo.registarMovimento(params);
        break;
      case 'saldoCaixa':
        resultado = CaixaModulo.saldoAtual(params);
        break;

      // ---------- DASHBOARD ----------
      case 'obterDashboard':
        resultado = DashboardModulo.obterIndicadores(params);
        break;

      // ---------- RELATÓRIOS ----------
      case 'relatorioClientes':
        resultado = RelatoriosModulo.clientes(params);
        break;
      case 'relatorioEmprestimos':
        resultado = RelatoriosModulo.emprestimos(params);
        break;
      case 'relatorioCaixa':
        resultado = RelatoriosModulo.caixa(params);
        break;
      case 'relatorioPagamentos':
        resultado = RelatoriosModulo.pagamentos(params);
        break;
      case 'relatorioInadimplentes':
        resultado = RelatoriosModulo.inadimplentes(params);
        break;
      case 'relatorioFinanceiro':
        resultado = RelatoriosModulo.financeiro(params);
        break;

      // ---------- PESQUISA GLOBAL ----------
      case 'pesquisaGlobal':
        resultado = PesquisaModulo.pesquisar(params);
        break;

      // ---------- CONFIGURAÇÕES ----------
      case 'obterConfiguracoes':
        resultado = ConfigModulo.obter(params);
        break;
      case 'atualizarConfiguracoes':
        resultado = ConfigModulo.atualizar(params);
        break;

      // ---------- MANUTENÇÃO / SETUP ----------
      case 'inicializarBaseDados':
        resultado = SetupModulo.inicializar(params);
        break;

      default:
        resultado = erro_('Ação desconhecida: ' + action);
    }

  return resultado;
}

/**
 * Empacota qualquer objeto de resultado como resposta HTTP JSON.
 * O ContentService do Apps Script não permite escolher livremente
 * cabeçalhos CORS; para contornar isto no fetch(), o frontend usa
 * modo 'no-cors' com JSONP-like fallback OU pede sempre via POST
 * com Content-Type text/plain (ver js/api.js para detalhes).
 */
function jsonResponse_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Helper para respostas de sucesso uniformes. */
function sucesso_(data, mensagem) {
  return { success: true, data: data, message: mensagem || '' };
}

/** Helper para respostas de erro uniformes. */
function erro_(mensagem, codigo) {
  return { success: false, error: mensagem, codigo: codigo || 'ERRO_GENERICO', data: null };
}
