/**
 * =====================================================================
 * MÓDULO DE CLIENTES — Clientes.gs
 * =====================================================================
 * CRUD completo de clientes, incluindo os dados do fiador e o estado
 * (Ativo/Bloqueado). O código do cliente é gerado automaticamente no
 * formato CLI0001, CLI0002, ...
 * =====================================================================
 */

const ClientesModulo = {

  /**
   * Lista clientes com paginação e filtro opcional por estado.
   * params: { pagina, porPagina, estado }
   */
  listar: function (params) {
    let clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);

    if (params.estado) {
      clientes = clientes.filter(function (c) {
        return String(c.estado).toLowerCase() === String(params.estado).toLowerCase();
      });
    }

    // Mais recentes primeiro
    clientes.sort(function (a, b) { return String(b.codigo).localeCompare(String(a.codigo)); });

    const pagina = parseInt(params.pagina || '1', 10);
    const porPagina = parseInt(params.porPagina || '20', 10);
    const total = clientes.length;
    const inicio = (pagina - 1) * porPagina;
    const pagina_dados = clientes.slice(inicio, inicio + porPagina);

    return sucesso_({
      itens: pagina_dados,
      total: total,
      pagina: pagina,
      porPagina: porPagina,
      totalPaginas: Math.ceil(total / porPagina) || 1
    });
  },

  /** Obtém um único cliente pelo código. */
  obter: function (params) {
    Validador.obrigatorio(params.codigo, 'codigo');
    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const cliente = clientes.find(function (c) { return c.codigo === params.codigo; });
    if (!cliente) return erro_('Cliente não encontrado.', 'NAO_ENCONTRADO');
    return sucesso_(cliente);
  },

  /** Cria um novo cliente. Todos os campos são opcionais; quando um
   * telefone, email ou BI é fornecido, o respetivo formato é validado. */
  criar: function (params) {
    if (params.telefone) Validador.telefoneMocambicano(params.telefone, 'telefone');
    Validador.email(params.email, 'email');

    const clientesExistentes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    if (params.bi) {
      const biDuplicado = clientesExistentes.some(function (c) { return c.bi === params.bi; });
      if (biDuplicado) {
        return erro_('Já existe um cliente cadastrado com este número de BI.', 'BI_DUPLICADO');
      }
    }

    const codigo = gerarProximoId_(NOMES_FOLHAS.CLIENTES, 'CLI', 4);
    const folha = obterFolha_(NOMES_FOLHAS.CLIENTES);

    folha.appendRow([
      codigo,
      params.nomeCompleto || '',
      params.bi || '',
      params.nuit || '',
      params.telefone || '',
      params.telefoneAlternativo || '',
      params.email || '',
      params.sexo || '',
      params.dataNascimento || '',
      params.profissao || '',
      params.endereco || '',
      params.bairro || '',
      params.distrito || '',
      params.provincia || '',
      params.nomeFiador || '',
      params.telefoneFiador || '',
      params.observacoes || '',
      params.estado || 'Ativo',
      agoraISO_(),
      params._utilizador ? params._utilizador.nome : 'Sistema'
    ]);

    return sucesso_({ codigo: codigo }, 'Cliente cadastrado com sucesso.');
  },

  /** Atualiza um cliente existente. */
  atualizar: function (params) {
    Validador.obrigatorio(params.codigo, 'codigo');

    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.CLIENTES, 'codigo', params.codigo);
    if (!linhaInfo) return erro_('Cliente não encontrado.', 'NAO_ENCONTRADO');

    if (params.telefone) Validador.telefoneMocambicano(params.telefone, 'telefone');
    if (params.email) Validador.email(params.email, 'email');

    const folha = obterFolha_(NOMES_FOLHAS.CLIENTES);
    const c = linhaInfo.cabecalhos;

    const camposAtualizaveis = [
      'nomeCompleto', 'bi', 'nuit', 'telefone', 'telefoneAlternativo', 'email',
      'sexo', 'dataNascimento', 'profissao', 'endereco', 'bairro', 'distrito',
      'provincia', 'nomeFiador', 'telefoneFiador', 'observacoes', 'estado'
    ];

    camposAtualizaveis.forEach(function (campo) {
      if (params[campo] !== undefined) {
        const indiceColuna = c.indexOf(campo);
        if (indiceColuna !== -1) {
          folha.getRange(linhaInfo.linha, indiceColuna + 1).setValue(params[campo]);
        }
      }
    });

    return sucesso_(null, 'Cliente atualizado com sucesso.');
  },

  /**
   * Exclui um cliente. Bloqueia a exclusão se existirem empréstimos
   * associados, para preservar a integridade do histórico financeiro.
   */
  excluir: function (params) {
    Validador.obrigatorio(params.codigo, 'codigo');

    const emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS);
    const temEmprestimos = emprestimos.some(function (e) { return e.clienteCodigo === params.codigo; });
    if (temEmprestimos) {
      return erro_('Não é possível excluir: este cliente possui empréstimos registados. Considere bloqueá-lo em vez de excluir.', 'CLIENTE_COM_EMPRESTIMOS');
    }

    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.CLIENTES, 'codigo', params.codigo);
    if (!linhaInfo) return erro_('Cliente não encontrado.', 'NAO_ENCONTRADO');

    obterFolha_(NOMES_FOLHAS.CLIENTES).deleteRow(linhaInfo.linha);
    return sucesso_(null, 'Cliente excluído com sucesso.');
  },

  /**
   * Pesquisa clientes por nome, BI, telefone ou código (usado na tabela
   * de clientes e na pesquisa global).
   */
  pesquisar: function (params) {
    Validador.obrigatorio(params.termo, 'termo');
    const termo = String(params.termo).toLowerCase();

    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const resultados = clientes.filter(function (c) {
      return String(c.nomeCompleto).toLowerCase().indexOf(termo) !== -1 ||
             String(c.bi).toLowerCase().indexOf(termo) !== -1 ||
             String(c.telefone).indexOf(termo) !== -1 ||
             String(c.codigo).toLowerCase().indexOf(termo) !== -1;
    });

    return sucesso_(resultados.slice(0, 50));
  }
};
