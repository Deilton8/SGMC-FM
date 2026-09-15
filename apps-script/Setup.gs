/**
 * =====================================================================
 * MÓDULO DE INICIALIZAÇÃO — Setup.gs
 * =====================================================================
 * Cria automaticamente todas as folhas necessárias na Google Sheet,
 * com os cabeçalhos corretos, formatação básica e dados de exemplo
 * para testes imediatos do sistema.
 *
 * COMO EXECUTAR (apenas uma vez, na primeira configuração):
 *   1. Abra o editor de Apps Script.
 *   2. Selecione a função "inicializarTudo" no menu suspenso.
 *   3. Clique em Executar (▶). Aceite as permissões pedidas.
 *   4. Verifique a Google Sheet: as folhas devem aparecer preenchidas.
 *
 * Também pode ser chamado remotamente via action=inicializarBaseDados,
 * mas por segurança essa via exige um token administrativo simples
 * (ver SetupModulo.inicializar) — o método pelo editor é o recomendado.
 * =====================================================================
 */

/**
 * Função de conveniência para executar diretamente no editor do
 * Apps Script (aparece no seletor de funções do topo).
 */
function inicializarTudo() {
  const resultado = SetupModulo.inicializar({ chaveSetup: 'EXECUTAR_DO_EDITOR' });
  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

const SetupModulo = {

  /**
   * Cria (se não existirem) todas as folhas do sistema com cabeçalhos,
   * congela a linha de cabeçalho, aplica formatação básica e, se as
   * folhas estiverem vazias, insere dados de exemplo.
   *
   * Pode ser chamado múltiplas vezes em segurança: nunca apaga dados
   * já existentes, apenas cria o que faltar.
   */
  inicializar: function (params) {
    // Proteção simples: só corre via editor (chaveSetup específica) ou
    // se ainda não existir NENHUMA folha do sistema (primeira instalação).
    const ss = getSpreadsheet_();
    const jaTemAlgumaFolha = Object.values(NOMES_FOLHAS).some(function (nome) {
      return ss.getSheetByName(nome) !== null;
    });

    if (params.chaveSetup !== 'EXECUTAR_DO_EDITOR' && jaTemAlgumaFolha) {
      return erro_('A base de dados já foi inicializada. Para reconfigurar, execute "inicializarTudo" diretamente no editor do Apps Script.', 'JA_INICIALIZADO');
    }

    const folhasCriadas = [];

    folhasCriadas.push(this._criarFolhaUtilizadores(ss));
    folhasCriadas.push(this._criarFolhaClientes(ss));
    folhasCriadas.push(this._criarFolhaEmprestimos(ss));
    folhasCriadas.push(this._criarFolhaParcelas(ss));
    folhasCriadas.push(this._criarFolhaPagamentos(ss));
    folhasCriadas.push(this._criarFolhaCaixa(ss));
    folhasCriadas.push(this._criarFolhaConfiguracoes(ss));
    folhasCriadas.push(this._criarFolhaSessoes(ss));
    folhasCriadas.push(this._criarFolhaLogs(ss));

    // Remove a folha "Página1"/"Sheet1" padrão, se existir e estiver vazia
    const folhaPadrao = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1');
    if (folhaPadrao && ss.getSheets().length > 1) {
      try { ss.deleteSheet(folhaPadrao); } catch (e) { /* ignora se não conseguir remover */ }
    }

    return sucesso_({ folhas: folhasCriadas.filter(Boolean) }, 'Base de dados inicializada com sucesso.');
  },

  _configurarCabecalho: function (folha, cabecalhos) {
    folha.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
    folha.getRange(1, 1, 1, cabecalhos.length)
      .setFontWeight('bold')
      .setBackground('#1F3A5F')
      .setFontColor('#FFFFFF');
    folha.setFrozenRows(1);
    folha.autoResizeColumns(1, cabecalhos.length);
  },

  _criarFolhaUtilizadores: function (ss) {
    if (ss.getSheetByName(NOMES_FOLHAS.UTILIZADORES)) return null;
    const folha = ss.insertSheet(NOMES_FOLHAS.UTILIZADORES);
    const cabecalhos = ['id', 'nome', 'utilizador', 'senhaHash', 'perfil', 'estado', 'criadoEm'];
    this._configurarCabecalho(folha, cabecalhos);

    // Utilizador administrador de exemplo: login "admin" / senha "admin123"
    const idAdmin = 'USR0001';
    folha.appendRow([idAdmin, 'Administrador do Sistema', 'admin', hashSenha_('admin123', idAdmin), 'Administrador', 'Ativo', agoraISO_()]);

    const idOperador = 'USR0002';
    folha.appendRow([idOperador, 'Operador de Caixa', 'operador', hashSenha_('operador123', idOperador), 'Operador', 'Ativo', agoraISO_()]);

    return NOMES_FOLHAS.UTILIZADORES;
  },

  _criarFolhaClientes: function (ss) {
    if (ss.getSheetByName(NOMES_FOLHAS.CLIENTES)) return null;
    const folha = ss.insertSheet(NOMES_FOLHAS.CLIENTES);
    const cabecalhos = [
      'codigo', 'nomeCompleto', 'bi', 'nuit', 'telefone', 'telefoneAlternativo',
      'email', 'sexo', 'dataNascimento', 'profissao', 'endereco', 'bairro',
      'distrito', 'provincia', 'nomeFiador', 'telefoneFiador', 'observacoes',
      'estado', 'criadoEm', 'criadoPor'
    ];
    this._configurarCabecalho(folha, cabecalhos);

    const exemplos = [
      ['CLI0001', 'Amélia da Conceição Machava', '110100123456A', '400123456', '841234567', '',
        'amelia.machava@exemplo.co.mz', 'Feminino', '15/03/1988', 'Comerciante', 'Av. Julius Nyerere, 245', 'Sommerschield',
        'KaMpfumo', 'Maputo Cidade', 'João Machava', '847654321', 'Cliente pontual, já teve 2 empréstimos anteriores.',
        'Ativo', agoraISO_(), 'Sistema'],
      ['CLI0002', 'Carlos Alberto Nhaca', '110100987654B', '400987654', '823456789', '861112233',
        'carlos.nhaca@exemplo.co.mz', 'Masculino', '22/07/1979', 'Taxista', 'Rua da Resistência, 88', 'Bairro Central',
        'KaMpfumo', 'Maputo Cidade', 'Fátima Nhaca', '829998877', '',
        'Ativo', agoraISO_(), 'Sistema'],
      ['CLI0003', 'Isabel Cristina Sitoe', '110100555222C', '400555222', '871239876', '',
        '', 'Feminino', '05/11/1992', 'Cabeleireira', 'Av. Acordos de Lusaka, 1200', 'Zimpeto',
        'KaTembe', 'Maputo Cidade', 'Manuel Sitoe', '843332211', 'Recomendada por outro cliente.',
        'Ativo', agoraISO_(), 'Sistema']
    ];
    exemplos.forEach(function (linha) { folha.appendRow(linha); });

    return NOMES_FOLHAS.CLIENTES;
  },

  _criarFolhaEmprestimos: function (ss) {
    if (ss.getSheetByName(NOMES_FOLHAS.EMPRESTIMOS)) return null;
    const folha = ss.insertSheet(NOMES_FOLHAS.EMPRESTIMOS);
    const cabecalhos = [
      'numeroContrato', 'contrato', 'clienteCodigo', 'valorSolicitado', 'valorAprovado',
      'taxaJuros', 'prazo', 'unidadePrazo', 'numeroParcelas', 'juroTotal', 'valorTotal',
      'valorPrestacao', 'saldoDevedor', 'estado', 'dataDesembolso', 'observacoes',
      'criadoEm', 'criadoPor'
    ];
    this._configurarCabecalho(folha, cabecalhos);

    // Um contrato de exemplo já ativo com histórico, para permitir testar pagamentos
    folha.appendRow([
      '1', '1', 'CLI0001', 15000, 15000, 10, 3, 'meses', 3, 1500, 16500, 5500, 11000,
      'Ativo', agoraISO_(), 'Empréstimo para expansão de negócio de mercearia.', agoraISO_(), 'Sistema'
    ]);

    return NOMES_FOLHAS.EMPRESTIMOS;
  },

  _criarFolhaParcelas: function (ss) {
    if (ss.getSheetByName(NOMES_FOLHAS.PARCELAS)) return null;
    const folha = ss.insertSheet(NOMES_FOLHAS.PARCELAS);
    const cabecalhos = [
      'id', 'numeroContrato', 'numero', 'vencimento', 'capital', 'juros',
      'total', 'valorEmAberto', 'valorPago', 'saldo', 'estado'
    ];
    this._configurarCabecalho(folha, cabecalhos);

    const hoje = new Date();
    const parcela1Venc = adicionarMeses_(hoje, -1); // já paga (mês passado)
    const parcela2Venc = new Date(hoje); // vence este mês
    const parcela3Venc = adicionarMeses_(hoje, 1); // futura

    folha.appendRow(['1-1', '1', 1, parcela1Venc.toISOString(), 5000, 500, 5500, 5500, 5500, 11000, 'Paga']);
    folha.appendRow(['1-2', '1', 2, parcela2Venc.toISOString(), 5000, 500, 5500, 5500, 0, 5500, 'Pendente']);
    folha.appendRow(['1-3', '1', 3, parcela3Venc.toISOString(), 5000, 500, 5500, 5500, 0, 0, 'Pendente']);

    return NOMES_FOLHAS.PARCELAS;
  },

  _criarFolhaPagamentos: function (ss) {
    if (ss.getSheetByName(NOMES_FOLHAS.PAGAMENTOS)) return null;
    const folha = ss.insertSheet(NOMES_FOLHAS.PAGAMENTOS);
    const cabecalhos = [
      'id', 'numeroRecibo', 'numeroContrato', 'valorPago', 'multa', 'metodo',
      'dataPagamento', 'observacoes', 'operador', 'estado'
    ];
    this._configurarCabecalho(folha, cabecalhos);

    const mesPassado = adicionarMeses_(new Date(), -1);
    folha.appendRow(['PAG00001', '1', '1', 5500, 0, 'M-Pesa', mesPassado.toISOString(), 'Primeira prestação', 'Administrador do Sistema', 'Confirmado']);

    return NOMES_FOLHAS.PAGAMENTOS;
  },

  _criarFolhaCaixa: function (ss) {
    if (ss.getSheetByName(NOMES_FOLHAS.CAIXA)) return null;
    const folha = ss.insertSheet(NOMES_FOLHAS.CAIXA);
    const cabecalhos = ['id', 'tipo', 'categoria', 'valor', 'descricao', 'referencia', 'data', 'operador'];
    this._configurarCabecalho(folha, cabecalhos);

    const doisMesesAtras = adicionarMeses_(new Date(), -2);
    const mesPassado = adicionarMeses_(new Date(), -1);

    folha.appendRow(['MOV000001', 'Entrada', 'Aporte de Capital', 50000, 'Capital inicial da empresa', '', doisMesesAtras.toISOString(), 'Administrador do Sistema']);
    folha.appendRow(['MOV000002', 'Saída', 'Desembolso de Empréstimo', 15000, 'Desembolso do contrato 1', '1', doisMesesAtras.toISOString(), 'Administrador do Sistema']);
    folha.appendRow(['MOV000003', 'Entrada', 'Pagamento de Prestação', 5500, 'Recibo #1 — Contrato 1', '1', mesPassado.toISOString(), 'Administrador do Sistema']);

    return NOMES_FOLHAS.CAIXA;
  },

  _criarFolhaConfiguracoes: function (ss) {
    if (ss.getSheetByName(NOMES_FOLHAS.CONFIGURACOES)) return null;
    const folha = ss.insertSheet(NOMES_FOLHAS.CONFIGURACOES);
    this._configurarCabecalho(folha, ['chave', 'valor']);

    const configuracoesIniciais = [
      ['nomeEmpresa', 'FIEL Microcrédito, E.I.'],
      ['logotipoUrl', ''],
      ['telefoneEmpresa', '+258 82 723 3067 / +258 85 398 3532'],
      ['emailEmpresa', 'comercial@fielmicrocredito.com'],
      ['enderecoEmpresa', 'Av. Emília Daússe, Nr. 574, Maputo Cidade, Moçambique'],
      ['moeda', 'MZN'],
      ['taxaJurosPadrao', 10],
      ['multaPadrao', 5],
      ['tipoMulta', 'percentual'],
      ['valorFixoMultaDiaria', 50],
      ['numeroInicialContratos', 1],
      ['numeroInicialRecibos', 1]
    ];
    configuracoesIniciais.forEach(function (linha) { folha.appendRow(linha); });

    return NOMES_FOLHAS.CONFIGURACOES;
  },

  _criarFolhaSessoes: function (ss) {
    if (ss.getSheetByName(NOMES_FOLHAS.SESSOES)) return null;
    const folha = ss.insertSheet(NOMES_FOLHAS.SESSOES);
    this._configurarCabecalho(folha, ['token', 'utilizadorId', 'criadoEm', 'expiraEm']);
    return NOMES_FOLHAS.SESSOES;
  },

  _criarFolhaLogs: function (ss) {
    if (ss.getSheetByName(NOMES_FOLHAS.LOGS)) return null;
    const folha = ss.insertSheet(NOMES_FOLHAS.LOGS);
    this._configurarCabecalho(folha, ['data', 'origem', 'mensagem', 'contexto']);
    return NOMES_FOLHAS.LOGS;
  }
};

/**
 * Trigger diário sugerido: cria um acionador que corre todos os dias
 * de manhã para atualizar automaticamente empréstimos e parcelas em
 * atraso. Execute esta função UMA VEZ a partir do editor para ativar.
 */
function criarTriggerDiario() {
  // Remove triggers antigos desta função para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'tarefaDiariaAtualizarAtrasos') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('tarefaDiariaAtualizarAtrasos')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  Logger.log('Trigger diário criado: correrá todos os dias por volta das 06:00.');
}

/** Função executada pelo trigger diário (ver criarTriggerDiario). */
function tarefaDiariaAtualizarAtrasos() {
  const resultado = EmprestimosModulo.atualizarAtrasos();
  Logger.log('Atrasos atualizados: ' + JSON.stringify(resultado));
}
