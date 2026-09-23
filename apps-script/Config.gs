/**
 * =====================================================================
 * MÓDULO DE CONFIGURAÇÕES — Config.gs
 * =====================================================================
 * A folha "Configuracoes" guarda pares chave/valor (uma linha por
 * configuração), o que facilita adicionar novas opções no futuro sem
 * alterar a estrutura da folha.
 * =====================================================================
 */

const ConfigModulo = {

  /** Lê todas as configurações e devolve como um único objeto chave->valor. */
  obter: function (params) {
    const folha = obterFolha_(NOMES_FOLHAS.CONFIGURACOES);
    const dados = folha.getDataRange().getValues();
    const configuracoes = {};

    for (let i = 1; i < dados.length; i++) {
      const chave = dados[i][0];
      const valor = dados[i][1];
      if (chave) configuracoes[chave] = valor;
    }

    return sucesso_(configuracoes);
  },

  /**
   * Atualiza uma ou mais configurações. Apenas Administrador.
   * params: { nomeEmpresa, moeda, taxaJurosPadrao, multaPadrao,
   *           numeroInicialContratos, numeroInicialRecibos, logotipoUrl,
   *           telefoneEmpresa, emailEmpresa, enderecoEmpresa, ... }
   */
  atualizar: function (params) {
    exigirPerfil_(params._utilizador, ['Administrador']);

    const folha = obterFolha_(NOMES_FOLHAS.CONFIGURACOES);
    const dados = folha.getDataRange().getValues();
    const mapaLinhas = {};
    for (let i = 1; i < dados.length; i++) {
      mapaLinhas[dados[i][0]] = i + 1;
    }

    const camposConfiguraveis = [
      'nomeEmpresa', 'logotipoUrl', 'telefoneEmpresa', 'emailEmpresa', 'enderecoEmpresa',
      'moeda', 'taxaJurosPadrao', 'multaPadrao',
      'tipoMulta', 'valorFixoMultaDiaria', 'numeroInicialContratos', 'numeroInicialRecibos',
      'mostrarCredenciaisTeste',
      'notificacoesAtivas', 'notificacoesDiasAntesVencimento', 'notificacoesCanal',
      'notificacoesMensagemAntes', 'notificacoesMensagemAtraso'
    ];

    // Uma célula do Google Sheets aceita no máximo 50 000 caracteres.
    // O logotipo (guardado como Data URL/Base64) é o campo com maior risco
    // de ultrapassar isso, mas a verificação aplica-se a qualquer campo de
    // texto, já que o limite é da própria planilha, não específico do
    // logotipo. Falhar aqui com uma mensagem clara é preferível a deixar
    // folha.getRange(...).setValue(...) lançar uma exceção genérica do
    // Google Sheets mais abaixo.
    const LIMITE_CARACTERES_CELULA = 49000;
    for (let i = 0; i < camposConfiguraveis.length; i++) {
      const campo = camposConfiguraveis[i];
      const valor = params[campo];
      if (typeof valor === 'string' && valor.length > LIMITE_CARACTERES_CELULA) {
        return erro_(
          'O valor de "' + campo + '" é demasiado grande para ser guardado (' + valor.length + ' caracteres; o limite é ' + LIMITE_CARACTERES_CELULA + '). Se for uma imagem de logotipo, escolha um ficheiro mais pequeno.',
          'VALOR_DEMASIADO_GRANDE'
        );
      }
    }

    camposConfiguraveis.forEach(function (campo) {
      if (params[campo] !== undefined) {
        if (mapaLinhas[campo]) {
          folha.getRange(mapaLinhas[campo], 2).setValue(params[campo]);
        } else {
          folha.appendRow([campo, params[campo]]);
        }
      }
    });

    return sucesso_(null, 'Configurações atualizadas com sucesso.');
  }
};
