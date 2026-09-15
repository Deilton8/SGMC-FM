/**
 * =====================================================================
 * LÓGICA DE RELATÓRIOS — js/relatorios.js
 * =====================================================================
 * Cada relatório é descrito por uma "definição" com: a ação da API a
 * chamar, as colunas a exibir (rótulo + como extrair/formatar o valor
 * de cada item) e os totais a apresentar nos cartões acima da tabela.
 * Esta abordagem evita duplicar lógica de renderização/exportação para
 * cada um dos 6 relatórios pedidos.
 * =====================================================================
 */

const DEFINICOES_RELATORIO = {

  clientes: {
    acao: 'relatorioClientes',
    titulo: 'Relatório de Clientes',
    usaDatas: true,
    colunas: [
      { rotulo: 'Código', chave: 'codigo' },
      { rotulo: 'Nome Completo', chave: 'nomeCompleto' },
      { rotulo: 'BI', chave: 'bi' },
      { rotulo: 'Telefone', chave: 'telefone' },
      { rotulo: 'Bairro', chave: 'bairro' },
      { rotulo: 'Estado', chave: 'estado' },
      { rotulo: 'Cadastrado em', chave: 'criadoEm', formato: 'data' }
    ],
    totais: [{ rotulo: 'Total de Clientes', chave: 'totalClientes', formato: 'numero' }]
  },

  emprestimos: {
    acao: 'relatorioEmprestimos',
    titulo: 'Relatório de Empréstimos',
    usaDatas: true,
    colunas: [
      { rotulo: 'Contrato', chave: 'numeroContrato' },
      { rotulo: 'Cliente', chave: 'clienteNome' },
      { rotulo: 'Valor Aprovado', chave: 'valorAprovado', formato: 'moeda' },
      { rotulo: 'Saldo Devedor', chave: 'saldoDevedor', formato: 'moeda' },
      { rotulo: 'Taxa', chave: 'taxaJuros', formato: 'percentual' },
      { rotulo: 'Estado', chave: 'estado' },
      { rotulo: 'Criado em', chave: 'criadoEm', formato: 'data' }
    ],
    totais: [
      { rotulo: 'Total de Contratos', chave: 'totalContratos', formato: 'numero' },
      { rotulo: 'Total Emprestado', chave: 'totalEmprestado', formato: 'moeda' },
      { rotulo: 'Saldo Devedor Total', chave: 'totalSaldoDevedor', formato: 'moeda' }
    ]
  },

  caixa: {
    acao: 'relatorioCaixa',
    titulo: 'Relatório de Caixa',
    usaDatas: true,
    colunas: [
      { rotulo: 'Data', chave: 'data', formato: 'dataHora' },
      { rotulo: 'Tipo', chave: 'tipo' },
      { rotulo: 'Categoria', chave: 'categoria' },
      { rotulo: 'Descrição', chave: 'descricao' },
      { rotulo: 'Valor', chave: 'valor', formato: 'moeda' },
      { rotulo: 'Operador', chave: 'operador' }
    ],
    totais: [
      { rotulo: 'Total de Entradas', chave: 'totalEntradas', formato: 'moeda' },
      { rotulo: 'Total de Saídas', chave: 'totalSaidas', formato: 'moeda' },
      { rotulo: 'Saldo do Período', chave: 'saldoPeriodo', formato: 'moeda' }
    ]
  },

  pagamentos: {
    acao: 'relatorioPagamentos',
    titulo: 'Relatório de Pagamentos',
    usaDatas: true,
    colunas: [
      { rotulo: 'Recibo', chave: 'numeroRecibo' },
      { rotulo: 'Contrato', chave: 'numeroContrato' },
      { rotulo: 'Valor Pago', chave: 'valorPago', formato: 'moeda' },
      { rotulo: 'Método', chave: 'metodo' },
      { rotulo: 'Data', chave: 'dataPagamento', formato: 'dataHora' },
      { rotulo: 'Operador', chave: 'operador' },
      { rotulo: 'Estado', chave: 'estado' }
    ],
    totais: [
      { rotulo: 'Total de Pagamentos', chave: 'totalPagamentos', formato: 'numero' },
      { rotulo: 'Total Recebido', chave: 'totalRecebido', formato: 'moeda' }
    ]
  },

  inadimplentes: {
    acao: 'relatorioInadimplentes',
    titulo: 'Relatório de Inadimplentes',
    usaDatas: false,
    colunas: [
      { rotulo: 'Contrato', chave: 'numeroContrato' },
      { rotulo: 'Cliente', chave: 'clienteNome' },
      { rotulo: 'Telefone', chave: 'clienteTelefone' },
      { rotulo: 'Fiador', chave: 'clienteFiador' },
      { rotulo: 'Saldo Devedor', chave: 'saldoDevedor', formato: 'moeda' },
      { rotulo: 'Parcelas em Atraso', chave: 'parcelasEmAtraso' },
      { rotulo: 'Dias de Atraso (máx.)', chave: 'diasAtrasoMax' }
    ],
    totais: [
      { rotulo: 'Contratos em Atraso', chave: 'totalContratos', formato: 'numero' },
      { rotulo: 'Total Devido', chave: 'totalDevido', formato: 'moeda' }
    ]
  },

  financeiro: {
    acao: 'relatorioFinanceiro',
    titulo: 'Relatório Financeiro',
    usaDatas: true,
    ehResumo: true // este relatório não lista itens; mostra apenas os totais agregados
  }
};

const EstadoRelatorios = {
  tipoAtivo: 'clientes',
  dadosAtuais: null
};

document.addEventListener('DOMContentLoaded', function () {
  Layout.inicializar('relatorios');

  document.querySelectorAll('[data-relatorio]').forEach(function (aba) {
    aba.addEventListener('click', function () {
      document.querySelectorAll('[data-relatorio]').forEach(function (a) { a.classList.remove('ativa'); });
      aba.classList.add('ativa');
      EstadoRelatorios.tipoAtivo = aba.dataset.relatorio;
      limparTabelaRelatorio();
    });
  });

  document.getElementById('botao-gerar-relatorio').addEventListener('click', gerarRelatorio);
  document.getElementById('botao-exportar-pdf').addEventListener('click', exportarRelatorioPdf);
  document.getElementById('botao-exportar-excel').addEventListener('click', exportarRelatorioExcel);
});

function limparTabelaRelatorio() {
  document.getElementById('tabela-relatorio-cabecalho').innerHTML = '';
  document.getElementById('tabela-relatorio-corpo').innerHTML = '<tr><td colspan="8"><div class="estado-vazio"><i class="fa-solid fa-chart-line"></i><div class="estado-vazio__titulo">Pronto para gerar</div><div class="estado-vazio__texto">Clique em "Gerar Relatório" para ver os dados de "' + DEFINICOES_RELATORIO[EstadoRelatorios.tipoAtivo].titulo + '".</div></div></td></tr>';
  document.getElementById('relatorio-totais-grade').style.display = 'none';
  EstadoRelatorios.dadosAtuais = null;
}

async function gerarRelatorio() {
  const definicao = DEFINICOES_RELATORIO[EstadoRelatorios.tipoAtivo];
  const corpo = document.getElementById('tabela-relatorio-corpo');
  corpo.innerHTML = '<tr><td colspan="8"><div class="linha-carregando-conteudo" style="padding:var(--espaco-8) 0;"><div class="girador"></div> A gerar relatório...</div></td></tr>';

  const parametros = {
    dataInicio: document.getElementById('relatorio-data-inicio').value,
    dataFim: document.getElementById('relatorio-data-fim').value
  };

  const resposta = await API.chamar(definicao.acao, parametros);

  if (!resposta.success) {
    corpo.innerHTML = '<tr><td colspan="8"><div class="estado-vazio"><i class="fa-solid fa-triangle-exclamation"></i><div class="estado-vazio__titulo">Erro ao gerar relatório</div><div class="estado-vazio__texto">' + Utils.escaparHtml(resposta.error) + '</div></div></td></tr>';
    return;
  }

  EstadoRelatorios.dadosAtuais = resposta.data;

  if (definicao.ehResumo) {
    renderizarRelatorioResumo(resposta.data);
  } else {
    renderizarTotaisRelatorio(definicao, resposta.data.totais);
    renderizarTabelaGenerica(definicao, resposta.data.itens);
  }
}

function renderizarTotaisRelatorio(definicao, totais) {
  const grade = document.getElementById('relatorio-totais-grade');
  grade.style.display = 'grid';
  grade.style.gridTemplateColumns = 'repeat(' + definicao.totais.length + ', 1fr)';

  grade.innerHTML = definicao.totais.map(function (t) {
    return '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">' + t.rotulo + '</span><div class="cartao-indicador__valor">' + formatarValorRelatorio(totais[t.chave], t.formato) + '</div></div>';
  }).join('');
}

function renderizarTabelaGenerica(definicao, itens) {
  const cabecalho = document.getElementById('tabela-relatorio-cabecalho');
  const corpo = document.getElementById('tabela-relatorio-corpo');

  cabecalho.innerHTML = '<tr>' + definicao.colunas.map(function (c) { return '<th' + (c.formato === 'moeda' || c.formato === 'numero' ? ' class="col-numerica"' : '') + '>' + c.rotulo + '</th>'; }).join('') + '</tr>';

  if (!itens.length) {
    corpo.innerHTML = '<tr><td colspan="' + definicao.colunas.length + '"><div class="estado-vazio"><i class="fa-solid fa-inbox"></i><div class="estado-vazio__titulo">Sem dados no período</div><div class="estado-vazio__texto">Ajuste as datas e tente novamente.</div></div></td></tr>';
    return;
  }

  corpo.innerHTML = itens.map(function (item) {
    return '<tr>' + definicao.colunas.map(function (c) {
      const valor = formatarValorRelatorio(item[c.chave], c.formato);
      return '<td' + (c.formato === 'moeda' || c.formato === 'numero' ? ' class="col-numerica"' : '') + '>' + Utils.escaparHtml(valor) + '</td>';
    }).join('') + '</tr>';
  }).join('');
}

function renderizarRelatorioResumo(dados) {
  const grade = document.getElementById('relatorio-totais-grade');
  grade.style.display = 'grid';
  grade.style.gridTemplateColumns = 'repeat(3, 1fr)';
  grade.innerHTML =
    '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Contratos Ativos</span><div class="cartao-indicador__valor">' + dados.carteira.contratosAtivos + '</div></div>' +
    '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Saldo Devedor Total</span><div class="cartao-indicador__valor">' + Formato.moeda(dados.carteira.saldoDevedorTotal) + '</div></div>' +
    '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Taxa de Inadimplência</span><div class="cartao-indicador__valor">' + dados.carteira.taxaInadimplenciaPercentual + '%</div></div>';

  const cabecalho = document.getElementById('tabela-relatorio-cabecalho');
  const corpo = document.getElementById('tabela-relatorio-corpo');
  cabecalho.innerHTML = '<tr><th>Indicador</th><th class="col-numerica">Valor</th></tr>';

  const linhas = [
    ['Total de Contratos', dados.carteira.totalContratos],
    ['Contratos Ativos', dados.carteira.contratosAtivos],
    ['Contratos Liquidados', dados.carteira.contratosLiquidados],
    ['Total de Capital Emprestado', Formato.moeda(dados.carteira.totalCapitalEmprestado)],
    ['Total de Juros Projetados', Formato.moeda(dados.carteira.totalJurosProjetados)],
    ['Saldo Devedor Total (carteira ativa)', Formato.moeda(dados.carteira.saldoDevedorTotal)],
    ['Taxa de Inadimplência', dados.carteira.taxaInadimplenciaPercentual + '%'],
    ['Total Recebido (período)', Formato.moeda(dados.recebimentos.totalRecebido)],
    ['Nº de Pagamentos (período)', dados.recebimentos.totalPagamentos],
    ['Entradas de Caixa (período)', Formato.moeda(dados.caixa.totalEntradas)],
    ['Saídas de Caixa (período)', Formato.moeda(dados.caixa.totalSaidas)],
    ['Saldo de Caixa (período)', Formato.moeda(dados.caixa.saldoPeriodo)]
  ];

  corpo.innerHTML = linhas.map(function (l) {
    return '<tr><td>' + l[0] + '</td><td class="col-numerica">' + l[1] + '</td></tr>';
  }).join('');
}

function formatarValorRelatorio(valor, formato) {
  if (valor === undefined || valor === null || valor === '') return '—';
  switch (formato) {
    case 'moeda': return Formato.moeda(valor);
    case 'numero': return Formato.numero(valor);
    case 'data': return Formato.data(valor);
    case 'dataHora': return Formato.dataHora(valor);
    case 'percentual': return valor + '%';
    default: return String(valor);
  }
}

/* =====================================================================
   EXPORTAÇÃO PDF
   ===================================================================== */

function exportarRelatorioPdf() {
  if (!EstadoRelatorios.dadosAtuais) {
    Alertas.aviso('Nada para exportar', 'Gere um relatório primeiro.');
    return;
  }

  const definicao = DEFINICOES_RELATORIO[EstadoRelatorios.tipoAtivo];
  // eslint-disable-next-line no-undef
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.text(definicao.titulo, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text('Gerado em ' + Formato.dataHora(new Date()), 14, 22);

  if (definicao.ehResumo) {
    const linhas = document.querySelectorAll('#tabela-relatorio-corpo tr');
    const dadosTabela = Array.from(linhas).map(function (tr) {
      return Array.from(tr.querySelectorAll('td')).map(function (td) { return td.textContent; });
    });
    doc.autoTable({ startY: 28, head: [['Indicador', 'Valor']], body: dadosTabela, headStyles: { fillColor: [16, 35, 58] } });
  } else {
    const cabecalhos = definicao.colunas.map(function (c) { return c.rotulo; });
    const linhas = EstadoRelatorios.dadosAtuais.itens.map(function (item) {
      return definicao.colunas.map(function (c) { return formatarValorRelatorio(item[c.chave], c.formato); });
    });
    doc.autoTable({ startY: 28, head: [cabecalhos], body: linhas, headStyles: { fillColor: [16, 35, 58] }, styles: { fontSize: 8 } });
  }

  doc.save(EstadoRelatorios.tipoAtivo + '-relatorio.pdf');
}

/* =====================================================================
   EXPORTAÇÃO EXCEL
   ===================================================================== */

function exportarRelatorioExcel() {
  if (!EstadoRelatorios.dadosAtuais) {
    Alertas.aviso('Nada para exportar', 'Gere um relatório primeiro.');
    return;
  }

  const definicao = DEFINICOES_RELATORIO[EstadoRelatorios.tipoAtivo];
  let dadosPlanilha;

  if (definicao.ehResumo) {
    const linhas = document.querySelectorAll('#tabela-relatorio-corpo tr');
    dadosPlanilha = Array.from(linhas).map(function (tr) {
      const celulas = tr.querySelectorAll('td');
      return { Indicador: celulas[0].textContent, Valor: celulas[1].textContent };
    });
  } else {
    dadosPlanilha = EstadoRelatorios.dadosAtuais.itens.map(function (item) {
      const linha = {};
      definicao.colunas.forEach(function (c) {
        linha[c.rotulo] = formatarValorRelatorio(item[c.chave], c.formato);
      });
      return linha;
    });
  }

  // eslint-disable-next-line no-undef
  const folha = XLSX.utils.json_to_sheet(dadosPlanilha);
  // eslint-disable-next-line no-undef
  const livro = XLSX.utils.book_new();
  // eslint-disable-next-line no-undef
  XLSX.utils.book_append_sheet(livro, folha, definicao.titulo.substring(0, 30));
  // eslint-disable-next-line no-undef
  XLSX.writeFile(livro, EstadoRelatorios.tipoAtivo + '-relatorio.xlsx');
}
