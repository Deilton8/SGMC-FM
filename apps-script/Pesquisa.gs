/**
 * =====================================================================
 * MÓDULO DE PESQUISA GLOBAL — Pesquisa.gs
 * =====================================================================
 * Pesquisa unificada usada na barra superior: procura simultaneamente
 * em Clientes (nome, BI, telefone, código) e em Empréstimos (número
 * do contrato), devolvendo resultados agrupados por tipo.
 * =====================================================================
 */

const PesquisaModulo = {

  pesquisar: function (params) {
    Validador.obrigatorio(params.termo, 'termo');
    const termo = String(params.termo).toLowerCase().trim();
    if (termo.length < 2) {
      return sucesso_({ clientes: [], emprestimos: [] });
    }

    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const clientesEncontrados = clientes.filter(function (c) {
      return String(c.nomeCompleto).toLowerCase().indexOf(termo) !== -1 ||
             String(c.bi).toLowerCase().indexOf(termo) !== -1 ||
             String(c.telefone).indexOf(termo) !== -1 ||
             String(c.codigo).toLowerCase().indexOf(termo) !== -1;
    }).slice(0, 8);

    const emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS);
    const mapaClientes = {};
    clientes.forEach(function (c) { mapaClientes[c.codigo] = c.nomeCompleto; });

    const emprestimosEncontrados = emprestimos.filter(function (e) {
      return String(e.numeroContrato).toLowerCase().indexOf(termo) !== -1;
    }).map(function (e) {
      e.clienteNome = mapaClientes[e.clienteCodigo] || '';
      return e;
    }).slice(0, 8);

    return sucesso_({
      clientes: clientesEncontrados,
      emprestimos: emprestimosEncontrados
    });
  }
};
