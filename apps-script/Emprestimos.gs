/**
 * =====================================================================
 * MÓDULO DE EMPRÉSTIMOS — Emprestimos.gs
 * =====================================================================
 * Motor de cálculo financeiro (juros simples por prazo, valor da
 * prestação, geração automática do plano de parcelas) e CRUD do ciclo
 * de vida do empréstimo: Pendente -> Ativo -> Liquidado
 *                                          -> Em atraso
 *                        Pendente -> Cancelado
 * =====================================================================
 */

const ESTADOS_EMPRESTIMO = ['Pendente', 'Ativo', 'Liquidado', 'Em atraso', 'Cancelado'];

const EmprestimosModulo = {

  /**
   * Lista empréstimos, com filtros opcionais por estado e/ou cliente.
   */
  listar: function (params) {
    let emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS);

    if (params.estado) {
      emprestimos = emprestimos.filter(function (e) { return e.estado === params.estado; });
    }
    if (params.clienteCodigo) {
      emprestimos = emprestimos.filter(function (e) { return e.clienteCodigo === params.clienteCodigo; });
    }

    // Enriquecer com nome do cliente para exibição direta na tabela
    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const mapaClientes = {};
    clientes.forEach(function (c) { mapaClientes[c.codigo] = c.nomeCompleto || '(sem nome)'; });

    emprestimos = emprestimos.map(function (e) {
      e.clienteNome = mapaClientes.hasOwnProperty(e.clienteCodigo) ? mapaClientes[e.clienteCodigo] : '(cliente removido)';
      return e;
    });

    emprestimos.sort(function (a, b) { return String(b.numeroContrato).localeCompare(String(a.numeroContrato), undefined, { numeric: true }); });

    const pagina = parseInt(params.pagina || '1', 10);
    const porPagina = parseInt(params.porPagina || '20', 10);
    const total = emprestimos.length;
    const inicio = (pagina - 1) * porPagina;

    return sucesso_({
      itens: emprestimos.slice(inicio, inicio + porPagina),
      total: total,
      pagina: pagina,
      porPagina: porPagina,
      totalPaginas: Math.ceil(total / porPagina) || 1
    });
  },

  /** Obtém um empréstimo pelo número de contrato, incluindo as suas parcelas. */
  obter: function (params) {
    Validador.obrigatorio(params.numeroContrato, 'numeroContrato');

    const emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS);
    const emprestimo = emprestimos.find(function (e) { return String(e.numeroContrato) === String(params.numeroContrato); });
    if (!emprestimo) return erro_('Empréstimo não encontrado.', 'NAO_ENCONTRADO');

    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const cliente = clientes.find(function (c) { return c.codigo === emprestimo.clienteCodigo; });
    emprestimo.cliente = cliente || null;

    const todasParcelas = lerFolhaComoObjetos_(NOMES_FOLHAS.PARCELAS);
    emprestimo.parcelas = todasParcelas
      .filter(function (p) { return String(p.numeroContrato) === String(params.numeroContrato); })
      .sort(function (a, b) { return parseInt(a.numero, 10) - parseInt(b.numero, 10); });

    return sucesso_(emprestimo);
  },

  /**
   * Simula um empréstimo sem gravar nada — usado no formulário para
   * mostrar em tempo real: juros, valor total, valor da prestação e
   * o plano de parcelas antes de confirmar.
   */
  simular: function (params) {
    return sucesso_(this._calcular(params));
  },

  /**
   * Motor de cálculo central. Suporta:
   *   tipoJuros: 'simples' (juro total = capital * taxa% * prazo, dividido
   *              igualmente pelas prestações) — método mais comum em
   *              microcrédito e mais simples de auditar.
   *   unidadePrazo: 'meses' | 'semanas' | 'dias'
   */
  _calcular: function (params) {
    const valor = parseFloat(params.valorAprovado || params.valorSolicitado || 0);
    const taxa = parseFloat(params.taxaJuros || 0); // percentual total do prazo, ex.: 10 = 10%
    const prazo = parseInt(params.prazo || 1, 10);
    const unidadePrazo = params.unidadePrazo || 'meses';
    const numeroParcelas = parseInt(params.numeroParcelas || prazo, 10);

    Validador.positivo(valor, 'valorAprovado');
    Validador.positivo(prazo, 'prazo');

    const juroTotal = arredondar2_(valor * (taxa / 100));
    const valorTotal = arredondar2_(valor + juroTotal);
    const valorPrestacao = arredondar2_(valorTotal / numeroParcelas);

    const dataBase = params.dataDesembolso ? new Date(params.dataDesembolso) : new Date();
    const parcelas = [];
    let somaGerada = 0;

    for (let i = 1; i <= numeroParcelas; i++) {
      let vencimento;
      if (unidadePrazo === 'dias') {
        vencimento = adicionarDias_(dataBase, Math.round((prazo / numeroParcelas) * i));
      } else if (unidadePrazo === 'semanas') {
        vencimento = adicionarDias_(dataBase, Math.round((prazo * 7 / numeroParcelas) * i));
      } else {
        vencimento = adicionarMeses_(dataBase, Math.round((prazo / numeroParcelas) * i));
      }

      // Última parcela absorve a diferença de arredondamento
      const ehUltima = (i === numeroParcelas);
      const capitalParcela = arredondar2_(valor / numeroParcelas);
      const jurosParcela = arredondar2_(juroTotal / numeroParcelas);
      let totalParcela = arredondar2_(capitalParcela + jurosParcela);

      somaGerada += totalParcela;

      if (ehUltima) {
        const diferenca = arredondar2_(valorTotal - (somaGerada - totalParcela));
        totalParcela = diferenca;
      }

      parcelas.push({
        numero: i,
        vencimento: vencimento.toISOString(),
        vencimentoFormatado: formatarDataBR_(vencimento),
        capital: capitalParcela,
        juros: jurosParcela,
        total: totalParcela,
        // "saldo" (saldo devedor remanescente após esta parcela) é
        // calculado abaixo, num segundo passo, porque só faz sentido de
        // forma decrescente e acumulada ao longo de todas as parcelas —
        // não dá para calcular corretamente parcela a parcela dentro
        // deste mesmo loop.
        estado: 'Pendente'
      });
    }

    // Calcula o saldo devedor acumulado (decrescente) após cada parcela.
    let saldoRestante = valorTotal;
    parcelas.forEach(function (p) {
      saldoRestante = arredondar2_(saldoRestante - p.total);
      p.saldo = saldoRestante;
    });

    return {
      valorSolicitado: parseFloat(params.valorSolicitado || valor),
      valorAprovado: valor,
      taxaJuros: taxa,
      prazo: prazo,
      unidadePrazo: unidadePrazo,
      numeroParcelas: numeroParcelas,
      juroTotal: juroTotal,
      valorTotal: valorTotal,
      valorPrestacao: valorPrestacao,
      parcelas: parcelas
    };
  },

  /**
   * Cria um novo empréstimo com estado inicial "Pendente" e gera o
   * plano de parcelas correspondente na folha Parcelas.
   */
  criar: function (params) {
    Validador.obrigatorio(params.clienteCodigo, 'clienteCodigo');
    Validador.obrigatorio(params.valorSolicitado, 'valorSolicitado');

    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const cliente = clientes.find(function (c) { return c.codigo === params.clienteCodigo; });
    if (!cliente) return erro_('Cliente não encontrado.', 'CLIENTE_NAO_ENCONTRADO');
    if (String(cliente.estado).toLowerCase() === 'bloqueado') {
      return erro_('Este cliente está bloqueado e não pode receber novos empréstimos.', 'CLIENTE_BLOQUEADO');
    }

    const config = ConfigModulo.obter({}).data;
    const dadosCalculo = Object.assign({}, params, {
      valorAprovado: params.valorAprovado || params.valorSolicitado,
      taxaJuros: params.taxaJuros || config.taxaJurosPadrao
    });
    const calculo = this._calcular(dadosCalculo);

    const numeroContrato = gerarProximoNumeroContrato_();
    const folhaEmprestimos = obterFolha_(NOMES_FOLHAS.EMPRESTIMOS);

    folhaEmprestimos.appendRow([
      numeroContrato,
      numeroContrato,
      params.clienteCodigo,
      calculo.valorSolicitado,
      calculo.valorAprovado,
      calculo.taxaJuros,
      calculo.prazo,
      calculo.unidadePrazo,
      calculo.numeroParcelas,
      calculo.juroTotal,
      calculo.valorTotal,
      calculo.valorPrestacao,
      calculo.valorTotal, // saldoDevedor inicial = valor total
      'Pendente',
      params.dataDesembolso || agoraISO_(),
      params.observacoes || '',
      agoraISO_(),
      params._utilizador ? params._utilizador.nome : 'Sistema'
    ]);

    // Gera as parcelas na folha correspondente. A ordem dos valores segue
    // exatamente o cabeçalho definido em Setup.gs (_criarFolhaParcelas):
    // id, numeroContrato, numero, vencimento, capital, juros, total,
    // valorEmAberto, valorPago, saldo, estado.
    const folhaParcelas = obterFolha_(NOMES_FOLHAS.PARCELAS);
    calculo.parcelas.forEach(function (p) {
      folhaParcelas.appendRow([
        numeroContrato + '-' + p.numero,
        numeroContrato,
        p.numero,
        p.vencimento,
        p.capital,
        p.juros,
        p.total,
        p.total, // valorEmAberto inicial = total da parcela (nada foi pago ainda)
        0,        // valorPago inicial = 0
        p.saldo,
        'Pendente'
      ]);
    });

    return sucesso_({ numeroContrato: numeroContrato, calculo: calculo }, 'Empréstimo criado com sucesso, aguardando aprovação.');
  },

  /**
   * Atualiza campos editáveis de um empréstimo ainda Pendente.
   * Depois de Aprovado, os valores financeiros não podem mais ser
   * alterados diretamente (para preservar a integridade do plano de
   * parcelas); use cancelamento + novo empréstimo nesse caso.
   */
  atualizar: function (params) {
    Validador.obrigatorio(params.numeroContrato, 'numeroContrato');

    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.EMPRESTIMOS, 'numeroContrato', params.numeroContrato);
    if (!linhaInfo) return erro_('Empréstimo não encontrado.', 'NAO_ENCONTRADO');

    const c = linhaInfo.cabecalhos;
    const estadoAtual = linhaInfo.dados[c.indexOf('estado')];

    if (estadoAtual !== 'Pendente' && (params.valorAprovado || params.taxaJuros || params.prazo)) {
      return erro_('Não é possível alterar valores financeiros de um empréstimo que já não está Pendente.', 'ESTADO_INVALIDO');
    }

    const folha = obterFolha_(NOMES_FOLHAS.EMPRESTIMOS);
    if (params.observacoes !== undefined) {
      folha.getRange(linhaInfo.linha, c.indexOf('observacoes') + 1).setValue(params.observacoes);
    }

    return sucesso_(null, 'Empréstimo atualizado com sucesso.');
  },

  /**
   * Aprova um empréstimo Pendente, movendo-o diretamente para "Ativo"
   * (o desembolso é considerado imediato neste fluxo simplificado — não
   * existe um estado intermédio "Aprovado" persistido; ajuste esta função
   * caso o processo real da empresa exija um passo de aprovação separado
   * do desembolso).
   */
  aprovar: function (params) {
    Validador.obrigatorio(params.numeroContrato, 'numeroContrato');

    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.EMPRESTIMOS, 'numeroContrato', params.numeroContrato);
    if (!linhaInfo) return erro_('Empréstimo não encontrado.', 'NAO_ENCONTRADO');

    const c = linhaInfo.cabecalhos;
    const estadoAtual = linhaInfo.dados[c.indexOf('estado')];
    if (estadoAtual !== 'Pendente') {
      return erro_('Apenas empréstimos Pendentes podem ser aprovados.', 'ESTADO_INVALIDO');
    }

    const folha = obterFolha_(NOMES_FOLHAS.EMPRESTIMOS);
    folha.getRange(linhaInfo.linha, c.indexOf('estado') + 1).setValue('Ativo');

    // Regista a saída de caixa referente ao desembolso do empréstimo
    const valorAprovado = parseFloat(linhaInfo.dados[c.indexOf('valorAprovado')]);
    CaixaModulo.registarMovimento({
      tipo: 'Saída',
      categoria: 'Desembolso de Empréstimo',
      valor: valorAprovado,
      descricao: 'Desembolso do contrato ' + params.numeroContrato,
      referencia: params.numeroContrato,
      _utilizador: params._utilizador
    });

    return sucesso_(null, 'Empréstimo aprovado e ativado com sucesso.');
  },

  /** Cancela um empréstimo Pendente (antes de qualquer desembolso). */
  cancelar: function (params) {
    Validador.obrigatorio(params.numeroContrato, 'numeroContrato');

    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.EMPRESTIMOS, 'numeroContrato', params.numeroContrato);
    if (!linhaInfo) return erro_('Empréstimo não encontrado.', 'NAO_ENCONTRADO');

    const c = linhaInfo.cabecalhos;
    const estadoAtual = linhaInfo.dados[c.indexOf('estado')];
    if (estadoAtual !== 'Pendente') {
      return erro_('Apenas empréstimos Pendentes podem ser cancelados. Empréstimos ativos devem ser liquidados.', 'ESTADO_INVALIDO');
    }

    const folha = obterFolha_(NOMES_FOLHAS.EMPRESTIMOS);
    folha.getRange(linhaInfo.linha, c.indexOf('estado') + 1).setValue('Cancelado');

    return sucesso_(null, 'Empréstimo cancelado.');
  },

  /** Exclui definitivamente um empréstimo Pendente ou Cancelado (nunca um Ativo/Liquidado). */
  excluir: function (params) {
    Validador.obrigatorio(params.numeroContrato, 'numeroContrato');

    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.EMPRESTIMOS, 'numeroContrato', params.numeroContrato);
    if (!linhaInfo) return erro_('Empréstimo não encontrado.', 'NAO_ENCONTRADO');

    const c = linhaInfo.cabecalhos;
    const estadoAtual = linhaInfo.dados[c.indexOf('estado')];
    if (['Ativo', 'Liquidado', 'Em atraso'].indexOf(estadoAtual) !== -1) {
      return erro_('Não é possível excluir um empréstimo com movimentação financeira. Considere cancelá-lo se ainda for possível.', 'ESTADO_INVALIDO');
    }

    obterFolha_(NOMES_FOLHAS.EMPRESTIMOS).deleteRow(linhaInfo.linha);

    // Remove também as parcelas órfãs
    const folhaParcelas = obterFolha_(NOMES_FOLHAS.PARCELAS);
    const dados = folhaParcelas.getDataRange().getValues();
    const colContrato = dados[0].indexOf('numeroContrato');
    for (let i = dados.length - 1; i >= 1; i--) {
      if (String(dados[i][colContrato]) === String(params.numeroContrato)) {
        folhaParcelas.deleteRow(i + 1);
      }
    }

    return sucesso_(null, 'Empréstimo excluído com sucesso.');
  },

  /** Lista as parcelas de um contrato específico. */
  listarParcelas: function (params) {
    Validador.obrigatorio(params.numeroContrato, 'numeroContrato');
    const todas = lerFolhaComoObjetos_(NOMES_FOLHAS.PARCELAS);
    const doContrato = todas
      .filter(function (p) { return String(p.numeroContrato) === String(params.numeroContrato); })
      .sort(function (a, b) { return parseInt(a.numero, 10) - parseInt(b.numero, 10); });
    return sucesso_(doContrato);
  },

  /**
   * Rotina de manutenção: percorre parcelas Pendentes/Parciais com
   * vencimento já passado (dia inteiro decorrido, não apenas a hora exata)
   * e marca-as, e o respetivo empréstimo Ativo, como "Em atraso".
   *
   * É chamada automaticamente por handleRequest_() (Codigo.gs) antes de
   * qualquer ação que apresente estados dependentes de data (listagens de
   * empréstimo, dashboard, relatórios de inadimplência/financeiro) — por
   * isso o estado aparece sempre correto na Web App, sem depender de mais
   * nenhuma configuração. Pode também ser ligada a um Trigger diário (ver
   * docs/INSTALACAO.md) para manter a própria folha do Sheets sincronizada
   * mesmo fora da Web App, e para reduzir o recálculo repetido.
   */
  atualizarAtrasos: function () {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const folhaParcelas = obterFolha_(NOMES_FOLHAS.PARCELAS);
    const dadosParcelas = folhaParcelas.getDataRange().getValues();
    const cabecalhosParcelas = dadosParcelas[0];
    const colVencimento = cabecalhosParcelas.indexOf('vencimento');
    const colEstadoParcela = cabecalhosParcelas.indexOf('estado');
    const colContratoParcela = cabecalhosParcelas.indexOf('numeroContrato');

    const contratosEmAtraso = {};

    for (let i = 1; i < dadosParcelas.length; i++) {
      const estado = dadosParcelas[i][colEstadoParcela];
      if (estado === 'Pendente' || estado === 'Parcial') {
        const vencimento = new Date(dadosParcelas[i][colVencimento]);
        if (vencimento < hoje) {
          folhaParcelas.getRange(i + 1, colEstadoParcela + 1).setValue('Atrasada');
          contratosEmAtraso[dadosParcelas[i][colContratoParcela]] = true;
        }
      }
    }

    const folhaEmprestimos = obterFolha_(NOMES_FOLHAS.EMPRESTIMOS);
    const dadosEmprestimos = folhaEmprestimos.getDataRange().getValues();
    const cabecalhosEmprestimos = dadosEmprestimos[0];
    const colNumeroContrato = cabecalhosEmprestimos.indexOf('numeroContrato');
    const colEstadoEmprestimo = cabecalhosEmprestimos.indexOf('estado');

    for (let i = 1; i < dadosEmprestimos.length; i++) {
      const numero = dadosEmprestimos[i][colNumeroContrato];
      const estadoAtual = dadosEmprestimos[i][colEstadoEmprestimo];
      if (contratosEmAtraso[numero] && estadoAtual === 'Ativo') {
        folhaEmprestimos.getRange(i + 1, colEstadoEmprestimo + 1).setValue('Em atraso');
      }
    }

    return sucesso_({ contratosAtualizados: Object.keys(contratosEmAtraso).length });
  }
};
