/**
 * =====================================================================
 * MÓDULO DE DASHBOARD — Dashboard.gs
 * =====================================================================
 * Agrega, numa única chamada, todos os indicadores exibidos nos
 * cartões do painel principal, evitando múltiplas idas ao backend
 * quando o utilizador abre a aplicação.
 * =====================================================================
 */

const DashboardModulo = {

  obterIndicadores: function (params) {
    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS);
    const pagamentos = lerFolhaComoObjetos_(NOMES_FOLHAS.PAGAMENTOS);
    const parcelas = lerFolhaComoObjetos_(NOMES_FOLHAS.PARCELAS);

    const totalClientes = clientes.length;

    const emprestimosAtivos = emprestimos.filter(function (e) { return e.estado === 'Ativo' || e.estado === 'Em atraso'; });
    const totalEmprestimosAtivos = emprestimosAtivos.length;

    const valorEmprestado = emprestimosAtivos.reduce(function (soma, e) { return soma + (parseFloat(e.valorAprovado) || 0); }, 0);

    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const valorRecebidoHoje = pagamentos
      .filter(function (p) { return p.estado !== 'Estornado' && new Date(p.dataPagamento) >= inicioHoje; })
      .reduce(function (soma, p) { return soma + (parseFloat(p.valorPago) || 0); }, 0);

    const saldoCaixa = CaixaModulo.saldoAtual({}).data.saldoAtual;

    const emprestimosEmAtraso = emprestimos.filter(function (e) { return e.estado === 'Em atraso'; });
    const totalEmAtraso = emprestimosEmAtraso.length;
    const valorEmAtraso = emprestimosEmAtraso.reduce(function (soma, e) { return soma + (parseFloat(e.saldoDevedor) || 0); }, 0);

    const ultimosPagamentos = pagamentos
      .filter(function (p) { return p.estado !== 'Estornado'; })
      .sort(function (a, b) { return new Date(b.dataPagamento) - new Date(a.dataPagamento); })
      .slice(0, 8)
      .map(function (p) {
        return {
          numeroRecibo: p.numeroRecibo,
          numeroContrato: p.numeroContrato,
          valorPago: p.valorPago,
          metodo: p.metodo,
          dataPagamento: p.dataPagamento,
          dataPagamentoFormatada: formatarDataBR_(p.dataPagamento)
        };
      });

    const em30Dias = adicionarDias_(hoje, 30);
    const proximosVencimentos = parcelas
      .filter(function (p) {
        if (p.estado !== 'Pendente' && p.estado !== 'Parcial') return false;
        const venc = new Date(p.vencimento);
        return venc >= inicioHoje && venc <= em30Dias;
      })
      .sort(function (a, b) { return new Date(a.vencimento) - new Date(b.vencimento); })
      .slice(0, 8)
      .map(function (p) {
        return {
          numeroContrato: p.numeroContrato,
          numeroParcela: p.numero,
          vencimento: p.vencimento,
          vencimentoFormatado: formatarDataBR_(p.vencimento),
          total: p.total,
          estado: p.estado
        };
      });

    return sucesso_({
      totalClientes: totalClientes,
      emprestimosAtivos: totalEmprestimosAtivos,
      valorEmprestado: arredondar2_(valorEmprestado),
      valorRecebidoHoje: arredondar2_(valorRecebidoHoje),
      saldoCaixa: saldoCaixa,
      emprestimosEmAtraso: totalEmAtraso,
      valorEmAtraso: arredondar2_(valorEmAtraso),
      ultimosPagamentos: ultimosPagamentos,
      proximosVencimentos: proximosVencimentos
    });
  }
};
