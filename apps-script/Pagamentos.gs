/**
 * =====================================================================
 * MÓDULO DE PAGAMENTOS — Pagamentos.gs
 * =====================================================================
 * Recebe pagamentos (parciais ou totais) sobre um empréstimo, aplica-os
 * às parcelas em aberto (da mais antiga para a mais recente), atualiza
 * o saldo devedor e liquida o empréstimo quando o saldo chega a zero.
 * Também trata multas por atraso e regista automaticamente a entrada
 * correspondente no Caixa.
 * =====================================================================
 */

const METODOS_PAGAMENTO = ['Dinheiro', 'M-Pesa', 'e-Mola', 'Transferência Bancária'];

const PagamentosModulo = {

  /** Lista pagamentos, com filtro opcional por contrato. */
  listar: function (params) {
    let pagamentos = lerFolhaComoObjetos_(NOMES_FOLHAS.PAGAMENTOS);

    if (params.numeroContrato) {
      pagamentos = pagamentos.filter(function (p) { return String(p.numeroContrato) === String(params.numeroContrato); });
    }

    pagamentos.sort(function (a, b) { return new Date(b.dataPagamento) - new Date(a.dataPagamento); });

    const limite = parseInt(params.limite || '50', 10);
    return sucesso_(pagamentos.slice(0, limite));
  },

  /**
   * Regista um novo pagamento sobre um contrato, distribuindo o valor
   * pelas parcelas em aberto (mais antigas primeiro). Se o valor
   * exceder o total das parcelas em atraso/pendentes, o excedente é
   * aplicado às parcelas futuras (amortização antecipada).
   *
   * params: { numeroContrato, valorPago, metodo, dataPagamento, observacoes, multa }
   */
  registar: function (params) {
    Validador.obrigatorio(params.numeroContrato, 'numeroContrato');
    Validador.obrigatorio(params.valorPago, 'valorPago');
    Validador.positivo(params.valorPago, 'valorPago');
    Validador.obrigatorio(params.metodo, 'metodo');

    if (METODOS_PAGAMENTO.indexOf(params.metodo) === -1) {
      throw new Error('Método de pagamento inválido. Use um de: ' + METODOS_PAGAMENTO.join(', '));
    }

    const linhaEmprestimo = encontrarLinhaPorId_(NOMES_FOLHAS.EMPRESTIMOS, 'numeroContrato', params.numeroContrato);
    if (!linhaEmprestimo) return erro_('Empréstimo não encontrado.', 'NAO_ENCONTRADO');

    const cEmp = linhaEmprestimo.cabecalhos;
    const estadoEmprestimo = linhaEmprestimo.dados[cEmp.indexOf('estado')];
    if (['Ativo', 'Em atraso'].indexOf(estadoEmprestimo) === -1) {
      return erro_('Só é possível registar pagamentos em empréstimos Ativos ou Em atraso.', 'ESTADO_INVALIDO');
    }

    let valorRestante = arredondar2_(parseFloat(params.valorPago));
    const valorMulta = arredondar2_(parseFloat(params.multa || 0));

    // Busca as parcelas do contrato em aberto, ordenadas da mais antiga para a mais nova
    const folhaParcelas = obterFolha_(NOMES_FOLHAS.PARCELAS);
    const dadosParcelas = folhaParcelas.getDataRange().getValues();
    const cParc = dadosParcelas[0];
    const colContrato = cParc.indexOf('numeroContrato');
    const colNumero = cParc.indexOf('numero');
    const colTotal = cParc.indexOf('total');
    const colValorPago = cParc.indexOf('valorPago');
    const colEstadoParc = cParc.indexOf('estado');

    const indicesParcelasAbertas = [];
    for (let i = 1; i < dadosParcelas.length; i++) {
      if (String(dadosParcelas[i][colContrato]) === String(params.numeroContrato) &&
          ['Pendente', 'Parcial', 'Atrasada'].indexOf(dadosParcelas[i][colEstadoParc]) !== -1) {
        indicesParcelasAbertas.push(i);
      }
    }
    indicesParcelasAbertas.sort(function (a, b) { return dadosParcelas[a][colNumero] - dadosParcelas[b][colNumero]; });

    const parcelasAfetadas = [];

    for (let idx = 0; idx < indicesParcelasAbertas.length && valorRestante > 0; idx++) {
      const linha = indicesParcelasAbertas[idx];
      const totalParcela = parseFloat(dadosParcelas[linha][colTotal]);
      const jaPago = parseFloat(dadosParcelas[linha][colValorPago]) || 0;
      const faltaPagar = arredondar2_(totalParcela - jaPago);

      if (faltaPagar <= 0) continue;

      const aplicado = Math.min(valorRestante, faltaPagar);
      const novoValorPago = arredondar2_(jaPago + aplicado);
      const novoEstado = (novoValorPago >= totalParcela) ? 'Paga' : 'Parcial';

      folhaParcelas.getRange(linha + 1, colValorPago + 1).setValue(novoValorPago);
      folhaParcelas.getRange(linha + 1, colEstadoParc + 1).setValue(novoEstado);

      parcelasAfetadas.push({ numero: dadosParcelas[linha][colNumero], aplicado: aplicado, novoEstado: novoEstado });
      valorRestante = arredondar2_(valorRestante - aplicado);
    }

    // Atualiza o saldo devedor do empréstimo
    const colSaldoDevedor = cEmp.indexOf('saldoDevedor');
    const saldoAnterior = parseFloat(linhaEmprestimo.dados[colSaldoDevedor]);
    const valorAplicadoTotal = arredondar2_(parseFloat(params.valorPago) - valorRestante);
    const novoSaldo = arredondar2_(Math.max(0, saldoAnterior - valorAplicadoTotal));

    const folhaEmprestimos = obterFolha_(NOMES_FOLHAS.EMPRESTIMOS);
    folhaEmprestimos.getRange(linhaEmprestimo.linha, colSaldoDevedor + 1).setValue(novoSaldo);

    // Se o saldo chegou a zero, liquida o empréstimo
    const colEstadoEmp = cEmp.indexOf('estado');
    let novoEstadoEmprestimo = linhaEmprestimo.dados[colEstadoEmp];
    if (novoSaldo <= 0) {
      novoEstadoEmprestimo = 'Liquidado';
      folhaEmprestimos.getRange(linhaEmprestimo.linha, colEstadoEmp + 1).setValue('Liquidado');
    } else if (novoEstadoEmprestimo === 'Em atraso') {
      // Só volta para "Ativo" se este pagamento tiver de facto quitado TODAS
      // as parcelas que estavam "Atrasada" — caso contrário, reverter aqui
      // faria o contrato aparecer como saudável no dashboard/listagens
      // enquanto ainda existe pelo menos uma parcela vencida e não paga,
      // até a próxima vez que atualizarAtrasos() rodasse (o que só acontece
      // nalgumas ações específicas, ver ACOES_QUE_EXIGEM_ATRASOS_SINCRONIZADOS
      // em Codigo.gs) — uma janela real onde o estado ficaria enganoso.
      // parcelasAfetadas já tem, nesta mesma iteração, o novo estado de cada
      // parcela tocada por este pagamento; combinamos essa informação com o
      // estado ORIGINAL (dadosParcelas, lido no início da função) das
      // parcelas do contrato que este pagamento não chegou a tocar.
      const idsParcelasQuitadasAgora = {};
      parcelasAfetadas.forEach(function (p) {
        if (p.novoEstado === 'Paga') idsParcelasQuitadasAgora[p.numero] = true;
      });

      let restaAlgumaParcelaAtrasada = false;
      for (let i = 1; i < dadosParcelas.length; i++) {
        if (String(dadosParcelas[i][colContrato]) !== String(params.numeroContrato)) continue;
        if (dadosParcelas[i][colEstadoParc] !== 'Atrasada') continue;
        const numeroDestaParcela = dadosParcelas[i][colNumero];
        if (!idsParcelasQuitadasAgora[numeroDestaParcela]) {
          restaAlgumaParcelaAtrasada = true;
          break;
        }
      }

      if (!restaAlgumaParcelaAtrasada) {
        novoEstadoEmprestimo = 'Ativo';
        folhaEmprestimos.getRange(linhaEmprestimo.linha, colEstadoEmp + 1).setValue('Ativo');
      }
      // Se ainda resta alguma parcela atrasada não quitada por este
      // pagamento, o empréstimo permanece "Em atraso" — coerente com o que
      // é mostrado nas parcelas, sem depender de uma sincronização futura.
    }

    // Regista o registo de pagamento
    const numeroRecibo = gerarProximoNumeroRecibo_();
    const idPagamento = gerarProximoId_(NOMES_FOLHAS.PAGAMENTOS, 'PAG', 5);
    const folhaPagamentos = obterFolha_(NOMES_FOLHAS.PAGAMENTOS);

    folhaPagamentos.appendRow([
      idPagamento,
      numeroRecibo,
      params.numeroContrato,
      valorAplicadoTotal,
      valorMulta,
      params.metodo,
      params.dataPagamento || agoraISO_(),
      params.observacoes || '',
      params._utilizador ? params._utilizador.nome : 'Sistema',
      'Confirmado'
    ]);

    // Regista a entrada correspondente no caixa
    CaixaModulo.registarMovimento({
      tipo: 'Entrada',
      categoria: 'Pagamento de Prestação',
      valor: arredondar2_(valorAplicadoTotal + valorMulta),
      descricao: 'Recibo #' + numeroRecibo + ' — Contrato ' + params.numeroContrato,
      referencia: params.numeroContrato,
      _utilizador: params._utilizador
    });

    return sucesso_({
      idPagamento: idPagamento,
      numeroRecibo: numeroRecibo,
      valorAplicado: valorAplicadoTotal,
      valorExcedente: valorRestante,
      novoSaldoDevedor: novoSaldo,
      novoEstadoEmprestimo: novoEstadoEmprestimo,
      parcelasAfetadas: parcelasAfetadas
    }, 'Pagamento registado com sucesso.');
  },

  /**
   * Estorna um pagamento (uso administrativo, para correção de erros).
   * Reverte o valor nas parcelas afetadas mais recentes e no saldo devedor.
   * Restrito ao perfil Administrador — o frontend já oculta o botão para
   * Operadores (ver data-somente-admin em js/pagamentos.js), mas essa
   * ocultação visual não impede um pedido direto à API; a verificação
   * real tem de estar aqui, no backend.
   */
  estornar: function (params) {
    exigirPerfil_(params._utilizador, ['Administrador']);
    Validador.obrigatorio(params.idPagamento, 'idPagamento');

    const linhaInfo = encontrarLinhaPorId_(NOMES_FOLHAS.PAGAMENTOS, 'id', params.idPagamento);
    if (!linhaInfo) return erro_('Pagamento não encontrado.', 'NAO_ENCONTRADO');

    const c = linhaInfo.cabecalhos;
    const estadoPagamento = linhaInfo.dados[c.indexOf('estado')];
    if (estadoPagamento === 'Estornado') {
      return erro_('Este pagamento já foi estornado anteriormente.', 'JA_ESTORNADO');
    }

    const numeroContrato = linhaInfo.dados[c.indexOf('numeroContrato')];
    // "valorPago" nesta folha é apenas a parte que foi aplicada às parcelas
    // (ver PagamentosModulo.registar) — a multa é guardada à parte e nunca
    // entra no saldoDevedor, mas ENTROU no caixa como parte da entrada
    // original. É preciso separar as duas coisas aqui: o saldo devedor só
    // recupera o valor aplicado às parcelas, enquanto a reversão no caixa
    // tem de devolver o total (aplicado + multa) para não deixar a multa
    // "perdida" no livro-caixa — sem isto, a entrada original incluía a
    // multa mas a saída do estorno não, e o caixa ficava desequilibrado.
    const valorAplicadoOriginal = parseFloat(linhaInfo.dados[c.indexOf('valorPago')]) || 0;
    const valorMultaOriginal = parseFloat(linhaInfo.dados[c.indexOf('multa')]) || 0;
    const valorTotalOriginal = arredondar2_(valorAplicadoOriginal + valorMultaOriginal);

    // Marca o pagamento como estornado
    const folhaPagamentos = obterFolha_(NOMES_FOLHAS.PAGAMENTOS);
    folhaPagamentos.getRange(linhaInfo.linha, c.indexOf('estado') + 1).setValue('Estornado');

    // Devolve ao saldo devedor apenas a parte que tinha sido aplicada às
    // parcelas (a multa nunca reduziu o saldo devedor, então não deve ser
    // somada de volta a ele).
    const linhaEmp = encontrarLinhaPorId_(NOMES_FOLHAS.EMPRESTIMOS, 'numeroContrato', numeroContrato);
    if (linhaEmp) {
      const cEmp = linhaEmp.cabecalhos;
      const folhaEmprestimos = obterFolha_(NOMES_FOLHAS.EMPRESTIMOS);
      const saldoAtual = parseFloat(linhaEmp.dados[cEmp.indexOf('saldoDevedor')]);
      const novoSaldo = arredondar2_(saldoAtual + valorAplicadoOriginal);
      folhaEmprestimos.getRange(linhaEmp.linha, cEmp.indexOf('saldoDevedor') + 1).setValue(novoSaldo);

      const estadoAtual = linhaEmp.dados[cEmp.indexOf('estado')];
      if (estadoAtual === 'Liquidado') {
        folhaEmprestimos.getRange(linhaEmp.linha, cEmp.indexOf('estado') + 1).setValue('Ativo');
      }
    }

    // Regista a saída de caixa correspondente ao estorno, pelo valor TOTAL
    // que tinha entrado (aplicado às parcelas + multa), espelhando a
    // entrada original registada em PagamentosModulo.registar.
    CaixaModulo.registarMovimento({
      tipo: 'Saída',
      categoria: 'Estorno de Pagamento',
      valor: valorTotalOriginal,
      descricao: 'Estorno do pagamento ' + params.idPagamento,
      referencia: numeroContrato,
      _utilizador: params._utilizador
    });

    return sucesso_(null, 'Pagamento estornado com sucesso. As parcelas devem ser conferidas manualmente se necessário.');
  },

  /**
   * Monta o texto estruturado de um recibo (a geração do PDF em si é
   * feita no frontend com jsPDF, a partir destes dados — ver js/relatorios.js).
   */
  gerarReciboTexto: function (params) {
    Validador.obrigatorio(params.idPagamento, 'idPagamento');

    const pagamentos = lerFolhaComoObjetos_(NOMES_FOLHAS.PAGAMENTOS);
    const pagamento = pagamentos.find(function (p) { return p.id === params.idPagamento; });
    if (!pagamento) return erro_('Pagamento não encontrado.', 'NAO_ENCONTRADO');

    const emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS);
    const emprestimo = emprestimos.find(function (e) { return String(e.numeroContrato) === String(pagamento.numeroContrato); });

    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const cliente = emprestimo ? clientes.find(function (c) { return c.codigo === emprestimo.clienteCodigo; }) : null;

    const config = ConfigModulo.obter({}).data;

    return sucesso_({
      numeroRecibo: pagamento.numeroRecibo,
      dataPagamento: pagamento.dataPagamento,
      dataPagamentoFormatada: formatarDataBR_(pagamento.dataPagamento),
      valorPago: pagamento.valorPago,
      multa: pagamento.multa,
      metodo: pagamento.metodo,
      operador: pagamento.operador,
      numeroContrato: pagamento.numeroContrato,
      saldoRestante: emprestimo ? emprestimo.saldoDevedor : null,
      cliente: cliente ? { nome: cliente.nomeCompleto, bi: cliente.bi, telefone: cliente.telefone } : null,
      empresa: {
        nome: config.nomeEmpresa,
        moeda: config.moeda,
        telefone: config.telefoneEmpresa || '',
        email: config.emailEmpresa || '',
        endereco: config.enderecoEmpresa || '',
        logotipoUrl: config.logotipoUrl || ''
      }
    });
  }
};
