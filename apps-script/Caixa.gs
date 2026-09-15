/**
 * =====================================================================
 * MÓDULO DE CAIXA — Caixa.gs
 * =====================================================================
 * Livro de caixa simples: cada linha é um movimento (Entrada ou Saída)
 * com categoria, valor, descrição e referência opcional (ex.: número
 * do contrato). O saldo é sempre calculado por soma, nunca armazenado
 * de forma independente, evitando divergências.
 * =====================================================================
 */

const CaixaModulo = {

  /** Lista movimentos de caixa, com filtro opcional por período e tipo. */
  listar: function (params) {
    let movimentos = lerFolhaComoObjetos_(NOMES_FOLHAS.CAIXA);

    if (params.tipo) {
      movimentos = movimentos.filter(function (m) { return m.tipo === params.tipo; });
    }
    if (params.dataInicio) {
      const inicio = new Date(params.dataInicio);
      movimentos = movimentos.filter(function (m) { return new Date(m.data) >= inicio; });
    }
    if (params.dataFim) {
      const fim = new Date(params.dataFim);
      fim.setHours(23, 59, 59, 999);
      movimentos = movimentos.filter(function (m) { return new Date(m.data) <= fim; });
    }

    movimentos.sort(function (a, b) { return new Date(b.data) - new Date(a.data); });

    const limite = parseInt(params.limite || '100', 10);
    return sucesso_(movimentos.slice(0, limite));
  },

  /**
   * Regista um movimento manual de caixa (despesas administrativas,
   * aportes de capital, etc.). Pagamentos e desembolsos de empréstimo
   * chamam esta função internamente a partir dos respetivos módulos.
   *
   * params: { tipo: 'Entrada'|'Saída', categoria, valor, descricao, referencia }
   */
  registarMovimento: function (params) {
    Validador.obrigatorio(params.tipo, 'tipo');
    Validador.obrigatorio(params.categoria, 'categoria');
    Validador.obrigatorio(params.valor, 'valor');
    Validador.positivo(params.valor, 'valor');

    if (['Entrada', 'Saída'].indexOf(params.tipo) === -1) {
      throw new Error('Tipo de movimento inválido. Use "Entrada" ou "Saída".');
    }

    const id = gerarProximoId_(NOMES_FOLHAS.CAIXA, 'MOV', 6);
    const folha = obterFolha_(NOMES_FOLHAS.CAIXA);

    folha.appendRow([
      id,
      params.tipo,
      params.categoria,
      arredondar2_(parseFloat(params.valor)),
      params.descricao || '',
      params.referencia || '',
      params.data || agoraISO_(),
      params._utilizador ? params._utilizador.nome : 'Sistema'
    ]);

    return sucesso_({ id: id }, 'Movimento de caixa registado.');
  },

  /**
   * Calcula o saldo atual do caixa (soma de todas as entradas menos
   * todas as saídas) e também os totais do dia e do mês corrente.
   */
  saldoAtual: function (params) {
    const movimentos = lerFolhaComoObjetos_(NOMES_FOLHAS.CAIXA);

    let saldo = 0, totalDiaEntradas = 0, totalDiaSaidas = 0, totalMesEntradas = 0, totalMesSaidas = 0;

    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    movimentos.forEach(function (m) {
      const valor = parseFloat(m.valor) || 0;
      const dataMovimento = new Date(m.data);
      const sinal = (m.tipo === 'Entrada') ? 1 : -1;
      saldo = arredondar2_(saldo + sinal * valor);

      if (dataMovimento >= inicioHoje) {
        if (m.tipo === 'Entrada') totalDiaEntradas = arredondar2_(totalDiaEntradas + valor);
        else totalDiaSaidas = arredondar2_(totalDiaSaidas + valor);
      }
      if (dataMovimento >= inicioMes) {
        if (m.tipo === 'Entrada') totalMesEntradas = arredondar2_(totalMesEntradas + valor);
        else totalMesSaidas = arredondar2_(totalMesSaidas + valor);
      }
    });

    return sucesso_({
      saldoAtual: saldo,
      hoje: { entradas: totalDiaEntradas, saidas: totalDiaSaidas, liquido: arredondar2_(totalDiaEntradas - totalDiaSaidas) },
      mes: { entradas: totalMesEntradas, saidas: totalMesSaidas, liquido: arredondar2_(totalMesEntradas - totalMesSaidas) }
    });
  }
};
