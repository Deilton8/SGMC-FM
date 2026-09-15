/**
 * =====================================================================
 * MÓDULO DE AUTENTICAÇÃO — Auth.gs
 * =====================================================================
 * Login por utilizador/senha, geração e validação de tokens de sessão,
 * e CRUD de utilizadores (apenas Administrador pode gerir utilizadores).
 *
 * A tabela "Sessoes" guarda: token, utilizadorId, criadoEm, expiraEm.
 * O token é devolvido ao frontend, que o guarda em LocalStorage e o
 * reenvia em todos os pedidos subsequentes.
 * =====================================================================
 */

const DURACAO_SESSAO_HORAS = 12;

const AuthModulo = {

  /**
   * Autentica um utilizador por nome de utilizador e senha.
   * Devolve um token de sessão válido por DURACAO_SESSAO_HORAS horas.
   */
  login: function (params) {
    Validador.obrigatorio(params.utilizador, 'utilizador');
    Validador.obrigatorio(params.senha, 'senha');

    const utilizadores = lerFolhaComoObjetos_(NOMES_FOLHAS.UTILIZADORES);
    const encontrado = utilizadores.find(function (u) {
      return String(u.utilizador).toLowerCase() === String(params.utilizador).toLowerCase();
    });

    if (!encontrado) {
      return erro_('Utilizador ou senha incorretos.', 'CREDENCIAIS_INVALIDAS');
    }

    if (String(encontrado.estado).toLowerCase() !== 'ativo') {
      return erro_('Esta conta está desativada. Contacte o administrador.', 'CONTA_INATIVA');
    }

    const verificacao = verificarSenha_(params.senha, encontrado.id, encontrado.senhaHash);
    if (!verificacao.valido) {
      return erro_('Utilizador ou senha incorretos.', 'CREDENCIAIS_INVALIDAS');
    }

    // Upgrade silencioso: se o hash gravado ainda é do esquema antigo (uma
    // única passada de SHA-256), agora que a senha em texto puro acabou de
    // ser confirmada como correta é o único momento em que dá para
    // recalculá-la com o esquema novo (mais lento de atacar por força
    // bruta) e regravar — sem exigir nenhuma ação da pessoa nem interromper
    // o login. Nas próximas vezes que este utilizador entrar, já vai cair
    // direto no ramo "v2" acima.
    if (verificacao.precisaAtualizar) {
      try {
        const linhaUtilizador = encontrarLinhaPorId_(NOMES_FOLHAS.UTILIZADORES, 'id', encontrado.id);
        if (linhaUtilizador) {
          const indiceSenhaHash = linhaUtilizador.cabecalhos.indexOf('senhaHash');
          obterFolha_(NOMES_FOLHAS.UTILIZADORES)
            .getRange(linhaUtilizador.linha, indiceSenhaHash + 1)
            .setValue(hashSenha_(params.senha, encontrado.id));
        }
      } catch (erroUpgrade) {
        // Uma falha ao regravar o hash não deve impedir o login em si —
        // a pessoa já provou que sabe a senha correta; o upgrade fica
        // simplesmente para a próxima tentativa.
        LoggerApp.erro('AuthModulo.login (upgrade de hash)', erroUpgrade, { utilizadorId: encontrado.id });
      }
    }

    // Cria sessão
    const token = gerarToken_();
    const agora = new Date();
    const expira = new Date(agora.getTime() + DURACAO_SESSAO_HORAS * 60 * 60 * 1000);

    const folhaSessoes = obterFolha_(NOMES_FOLHAS.SESSOES);
    folhaSessoes.appendRow([token, encontrado.id, agora.toISOString(), expira.toISOString()]);

    return sucesso_({
      token: token,
      utilizador: {
        id: encontrado.id,
        nome: encontrado.nome,
        utilizador: encontrado.utilizador,
        perfil: encontrado.perfil
      },
      expiraEm: expira.toISOString()
    }, 'Sessão iniciada com sucesso.');
  },

  /**
   * Verifica se um token continua válido (usado ao recarregar a página).
   */
  validarSessao: function (params) {
    const sessao = validarToken_(params.token);
    if (!sessao.valido) {
      return erro_('Sessão inválida ou expirada.', 'SESSAO_INVALIDA');
    }
    return sucesso_({ utilizador: sessao.utilizador });
  },

  /**
   * Permite ao utilizador autenticado trocar a própria senha.
   */
  alterarSenha: function (params) {
    Validador.obrigatorio(params.senhaAtual, 'senhaAtual');
    Validador.obrigatorio(params.senhaNova, 'senhaNova');
    if (String(params.senhaNova).length < 4) {
      throw new Error('A nova senha deve ter pelo menos 4 caracteres.');
    }

    const utilizadorId = params._utilizador.id;
    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.UTILIZADORES, 'id', utilizadorId);
    if (!linhaInfo) return erro_('Utilizador não encontrado.');

    const indiceSenhaHash = linhaInfo.cabecalhos.indexOf('senhaHash');
    const hashAtualGuardado = linhaInfo.dados[indiceSenhaHash];
    const verificacao = verificarSenha_(params.senhaAtual, utilizadorId, hashAtualGuardado);

    if (!verificacao.valido) {
      return erro_('A senha atual está incorreta.', 'SENHA_INCORRETA');
    }

    const novoHash = hashSenha_(params.senhaNova, utilizadorId);
    const folha = obterFolha_(NOMES_FOLHAS.UTILIZADORES);
    folha.getRange(linhaInfo.linha, indiceSenhaHash + 1).setValue(novoHash);

    return sucesso_(null, 'Senha alterada com sucesso.');
  },

  /**
   * Lista todos os utilizadores (sem expor a senhaHash). Apenas Administrador.
   */
  listarUtilizadores: function (params) {
    exigirPerfil_(params._utilizador, ['Administrador']);
    const utilizadores = lerFolhaComoObjetos_(NOMES_FOLHAS.UTILIZADORES);
    const semSenha = utilizadores.map(function (u) {
      return {
        id: u.id, nome: u.nome, utilizador: u.utilizador,
        perfil: u.perfil, estado: u.estado, criadoEm: u.criadoEm
      };
    });
    return sucesso_(semSenha);
  },

  /**
   * Cria um novo utilizador do sistema. Apenas Administrador.
   */
  criarUtilizador: function (params) {
    exigirPerfil_(params._utilizador, ['Administrador']);
    Validador.obrigatorio(params.nome, 'nome');
    Validador.obrigatorio(params.utilizador, 'utilizador');
    Validador.obrigatorio(params.senha, 'senha');
    Validador.obrigatorio(params.perfil, 'perfil');

    if (!['Administrador', 'Operador'].includes(params.perfil)) {
      throw new Error('Perfil inválido. Use "Administrador" ou "Operador".');
    }

    const utilizadoresExistentes = lerFolhaComoObjetos_(NOMES_FOLHAS.UTILIZADORES);
    const jaExiste = utilizadoresExistentes.some(function (u) {
      return String(u.utilizador).toLowerCase() === String(params.utilizador).toLowerCase();
    });
    if (jaExiste) {
      return erro_('Já existe um utilizador com este nome de login.', 'UTILIZADOR_DUPLICADO');
    }

    const id = gerarProximoId_(NOMES_FOLHAS.UTILIZADORES, 'USR', 4);
    const senhaHash = hashSenha_(params.senha, id);
    const folha = obterFolha_(NOMES_FOLHAS.UTILIZADORES);

    folha.appendRow([
      id, params.nome, params.utilizador, senhaHash,
      params.perfil, 'Ativo', agoraISO_()
    ]);

    return sucesso_({ id: id }, 'Utilizador criado com sucesso.');
  },

  /**
   * Atualiza dados de um utilizador (nome, perfil, estado, e opcionalmente senha).
   */
  atualizarUtilizador: function (params) {
    exigirPerfil_(params._utilizador, ['Administrador']);
    Validador.obrigatorio(params.id, 'id');

    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.UTILIZADORES, 'id', params.id);
    if (!linhaInfo) return erro_('Utilizador não encontrado.');

    const folha = obterFolha_(NOMES_FOLHAS.UTILIZADORES);
    const c = linhaInfo.cabecalhos;

    if (params.nome) folha.getRange(linhaInfo.linha, c.indexOf('nome') + 1).setValue(params.nome);
    if (params.perfil) folha.getRange(linhaInfo.linha, c.indexOf('perfil') + 1).setValue(params.perfil);
    if (params.estado) folha.getRange(linhaInfo.linha, c.indexOf('estado') + 1).setValue(params.estado);
    if (params.senha) {
      const novoHash = hashSenha_(params.senha, params.id);
      folha.getRange(linhaInfo.linha, c.indexOf('senhaHash') + 1).setValue(novoHash);
    }

    return sucesso_(null, 'Utilizador atualizado com sucesso.');
  },

  /**
   * Exclui um utilizador. Impede a auto-exclusão para evitar bloqueio do sistema.
   */
  excluirUtilizador: function (params) {
    exigirPerfil_(params._utilizador, ['Administrador']);
    Validador.obrigatorio(params.id, 'id');

    if (String(params.id) === String(params._utilizador.id)) {
      return erro_('Não é possível excluir o seu próprio utilizador enquanto tem sessão iniciada.', 'AUTO_EXCLUSAO');
    }

    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.UTILIZADORES, 'id', params.id);
    if (!linhaInfo) return erro_('Utilizador não encontrado.');

    obterFolha_(NOMES_FOLHAS.UTILIZADORES).deleteRow(linhaInfo.linha);
    return sucesso_(null, 'Utilizador excluído com sucesso.');
  }
};

/**
 * Verifica se um token de sessão é válido e não expirou.
 * Devolve { valido: boolean, utilizador: {...} }.
 */
function validarToken_(token) {
  if (!token) return { valido: false };

  const sessoes = lerFolhaComoObjetos_(NOMES_FOLHAS.SESSOES);
  const sessao = sessoes.find(function (s) { return s.token === token; });
  if (!sessao) return { valido: false };

  const agora = new Date();
  const expira = new Date(sessao.expiraEm);
  if (agora > expira) return { valido: false };

  const utilizadores = lerFolhaComoObjetos_(NOMES_FOLHAS.UTILIZADORES);
  const utilizador = utilizadores.find(function (u) { return String(u.id) === String(sessao.utilizadorId); });
  if (!utilizador || String(utilizador.estado).toLowerCase() !== 'ativo') {
    return { valido: false };
  }

  return {
    valido: true,
    utilizador: {
      id: utilizador.id,
      nome: utilizador.nome,
      utilizador: utilizador.utilizador,
      perfil: utilizador.perfil
    }
  };
}

/**
 * Lança um erro se o utilizador atual não tiver um dos perfis permitidos.
 * Usado para restringir ações (ex.: apenas Administrador pode configurar o sistema).
 */
function exigirPerfil_(utilizador, perfisPermitidos) {
  if (!utilizador || perfisPermitidos.indexOf(utilizador.perfil) === -1) {
    throw new Error('Acesso negado. Esta ação requer o perfil: ' + perfisPermitidos.join(' ou ') + '.');
  }
}
