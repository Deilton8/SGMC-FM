/**
 * =====================================================================
 * MÓDULO DE RELATÓRIOS — Relatorios.gs
 * =====================================================================
 * Prepara conjuntos de dados prontos para exibição em tabela e para
 * exportação em PDF/Excel no frontend (js/relatorios.js usa jsPDF e
 * SheetJS para gerar os ficheiros finais a partir destes dados).
 * =====================================================================
 */

const RelatoriosModulo = {

  /** Relatório de clientes, com filtro opcional por estado e período de cadastro. */
  clientes: function (params) {
    let clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);

    if (params.estado) {
      clientes = clientes.filter(function (c) { return c.estado === params.estado; });
    }
    if (params.dataInicio) {
      const inicio = new Date(params.dataInicio);
      clientes = clientes.filter(function (c) { return new Date(c.criadoEm) >= inicio; });
    }
    if (params.dataFim) {
      const fim = new Date(params.dataFim);
      fim.setHours(23, 59, 59, 999);
      clientes = clientes.filter(function (c) { return new Date(c.criadoEm) <= fim; });
    }

    clientes.sort(function (a, b) { return String(a.nomeCompleto).localeCompare(String(b.nomeCompleto)); });

    return sucesso_({
      itens: clientes,
      totais: { totalClientes: clientes.length }
    });
  },

  /** Relatório de empréstimos, com filtros por estado e período. */
  emprestimos: function (params) {
    let emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS);
    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const mapaClientes = {};
    clientes.forEach(function (c) { mapaClientes[c.codigo] = c.nomeCompleto || '(sem nome)'; });

    if (params.estado) {
      emprestimos = emprestimos.filter(function (e) { return e.estado === params.estado; });
    }
    if (params.dataInicio) {
      const inicio = new Date(params.dataInicio);
      emprestimos = emprestimos.filter(function (e) { return new Date(e.criadoEm) >= inicio; });
    }
    if (params.dataFim) {
      const fim = new Date(params.dataFim);
      fim.setHours(23, 59, 59, 999);
      emprestimos = emprestimos.filter(function (e) { return new Date(e.criadoEm) <= fim; });
    }

    emprestimos = emprestimos.map(function (e) {
      e.clienteNome = mapaClientes.hasOwnProperty(e.clienteCodigo) ? mapaClientes[e.clienteCodigo] : '(cliente removido)';
      return e;
    });

    const totalEmprestado = emprestimos.reduce(function (s, e) { return s + (parseFloat(e.valorAprovado) || 0); }, 0);
    const totalSaldoDevedor = emprestimos.reduce(function (s, e) { return s + (parseFloat(e.saldoDevedor) || 0); }, 0);

    return sucesso_({
      itens: emprestimos,
      totais: {
        totalContratos: emprestimos.length,
        totalEmprestado: arredondar2_(totalEmprestado),
        totalSaldoDevedor: arredondar2_(totalSaldoDevedor)
      }
    });
  },

  /** Relatório de caixa (livro-caixa) num período. */
  caixa: function (params) {
    const resultado = CaixaModulo.listar({
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      tipo: params.tipo,
      limite: 10000
    });

    const movimentos = resultado.data;
    const totalEntradas = movimentos.filter(function (m) { return m.tipo === 'Entrada'; })
      .reduce(function (s, m) { return s + (parseFloat(m.valor) || 0); }, 0);
    const totalSaidas = movimentos.filter(function (m) { return m.tipo === 'Saída'; })
      .reduce(function (s, m) { return s + (parseFloat(m.valor) || 0); }, 0);

    return sucesso_({
      itens: movimentos,
      totais: {
        totalEntradas: arredondar2_(totalEntradas),
        totalSaidas: arredondar2_(totalSaidas),
        saldoPeriodo: arredondar2_(totalEntradas - totalSaidas)
      }
    });
  },

  /** Relatório de pagamentos recebidos num período. */
  pagamentos: function (params) {
    let pagamentos = lerFolhaComoObjetos_(NOMES_FOLHAS.PAGAMENTOS);

    if (params.dataInicio) {
      const inicio = new Date(params.dataInicio);
      pagamentos = pagamentos.filter(function (p) { return new Date(p.dataPagamento) >= inicio; });
    }
    if (params.dataFim) {
      const fim = new Date(params.dataFim);
      fim.setHours(23, 59, 59, 999);
      pagamentos = pagamentos.filter(function (p) { return new Date(p.dataPagamento) <= fim; });
    }
    if (params.metodo) {
      pagamentos = pagamentos.filter(function (p) { return p.metodo === params.metodo; });
    }

    pagamentos.sort(function (a, b) { return new Date(b.dataPagamento) - new Date(a.dataPagamento); });

    const totalRecebido = pagamentos
      .filter(function (p) { return p.estado !== 'Estornado'; })
      .reduce(function (s, p) { return s + (parseFloat(p.valorPago) || 0); }, 0);

    return sucesso_({
      itens: pagamentos,
      totais: { totalPagamentos: pagamentos.length, totalRecebido: arredondar2_(totalRecebido) }
    });
  },

  /** Relatório de clientes/contratos inadimplentes (em atraso). */
  inadimplentes: function (params) {
    const emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS)
      .filter(function (e) { return e.estado === 'Em atraso'; });

    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const mapaClientes = {};
    clientes.forEach(function (c) { mapaClientes[c.codigo] = c; });

    const parcelas = lerFolhaComoObjetos_(NOMES_FOLHAS.PARCELAS);
    const hoje = new Date();

    const itens = emprestimos.map(function (e) {
      const cliente = mapaClientes[e.clienteCodigo] || {};
      const parcelasAtrasadas = parcelas.filter(function (p) {
        return String(p.numeroContrato) === String(e.numeroContrato) && p.estado === 'Atrasada';
      });

      const diasAtrasoMax = parcelasAtrasadas.reduce(function (max, p) {
        const dias = Math.floor((hoje - new Date(p.vencimento)) / (1000 * 60 * 60 * 24));
        return Math.max(max, dias);
      }, 0);

      return {
        numeroContrato: e.numeroContrato,
        clienteNome: cliente.nomeCompleto || '(desconhecido)',
        clienteTelefone: cliente.telefone || '',
        clienteFiador: cliente.nomeFiador || '',
        telefoneFiador: cliente.telefoneFiador || '',
        saldoDevedor: e.saldoDevedor,
        parcelasEmAtraso: parcelasAtrasadas.length,
        diasAtrasoMax: diasAtrasoMax
      };
    });

    itens.sort(function (a, b) { return b.diasAtrasoMax - a.diasAtrasoMax; });

    const totalDevido = itens.reduce(function (s, i) { return s + (parseFloat(i.saldoDevedor) || 0); }, 0);

    return sucesso_({
      itens: itens,
      totais: { totalContratos: itens.length, totalDevido: arredondar2_(totalDevido) }
    });
  },

  /**
   * Relatório financeiro consolidado: visão geral de carteira,
   * recebimentos, e saúde da operação num período.
   */
  financeiro: function (params) {
    const emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS);
    const pagamentosResultado = this.pagamentos(params).data;
    const caixaResultado = this.caixa(params).data;

    const carteiraAtiva = emprestimos.filter(function (e) { return ['Ativo', 'Em atraso'].indexOf(e.estado) !== -1; });
    const carteiraLiquidada = emprestimos.filter(function (e) { return e.estado === 'Liquidado'; });

    const totalCarteiraAtiva = carteiraAtiva.reduce(function (s, e) { return s + (parseFloat(e.saldoDevedor) || 0); }, 0);
    const totalJurosProjetados = emprestimos.reduce(function (s, e) { return s + (parseFloat(e.juroTotal) || 0); }, 0);
    const totalCapitalEmprestado = emprestimos.reduce(function (s, e) { return s + (parseFloat(e.valorAprovado) || 0); }, 0);

    const emprestimosEmAtraso = emprestimos.filter(function (e) { return e.estado === 'Em atraso'; }).length;
    const totalContratos = emprestimos.length || 1;
    const taxaInadimplencia = arredondar2_((emprestimosEmAtraso / totalContratos) * 100);

    return sucesso_({
      carteira: {
        totalContratos: emprestimos.length,
        contratosAtivos: carteiraAtiva.length,
        contratosLiquidados: carteiraLiquidada.length,
        saldoDevedorTotal: arredondar2_(totalCarteiraAtiva),
        totalCapitalEmprestado: arredondar2_(totalCapitalEmprestado),
        totalJurosProjetados: arredondar2_(totalJurosProjetados),
        taxaInadimplenciaPercentual: taxaInadimplencia
      },
      recebimentos: pagamentosResultado.totais,
      caixa: caixaResultado.totais
    });
  }
};
