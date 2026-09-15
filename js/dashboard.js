/**
 * =====================================================================
 * LÓGICA DO DASHBOARD — js/dashboard.js
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', function () {
  Layout.inicializar('dashboard');
  definirDataExtenso();
  carregarDashboard();

  document.getElementById('botao-atualizar-dashboard').addEventListener('click', function () {
    carregarDashboard();
  });
});

function definirDataExtenso() {
  const el = document.getElementById('data-hoje-extenso');
  if (!el) return;
  const hoje = new Date();
  const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const texto = hoje.toLocaleDateString('pt-PT', opcoes);
  el.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}

async function carregarDashboard() {
  const grade = document.getElementById('grade-indicadores');
  grade.innerHTML = gerarEsqueletoIndicadores();

  const resposta = await API.chamar('obterDashboard', {});

  if (!resposta.success) {
    Alertas.erro('Erro ao carregar painel', resposta.error);
    return;
  }

  renderizarIndicadores(resposta.data);
  renderizarUltimosPagamentos(resposta.data.ultimosPagamentos);
  renderizarProximosVencimentos(resposta.data.proximosVencimentos);
}

function gerarEsqueletoIndicadores() {
  let html = '';
  for (let i = 0; i < 6; i++) {
    html += '<div class="cartao-indicador"><div class="linha-carregando-conteudo" style="padding:var(--espaco-4) 0;"><div class="girador girador--pequeno"></div></div></div>';
  }
  return html;
}

function renderizarIndicadores(dados) {
  const grade = document.getElementById('grade-indicadores');

  const cartoes = [
    {
      rotulo: 'Total de Clientes',
      valor: Formato.numero(dados.totalClientes),
      icone: 'fa-users',
      cor: 'marinho',
      rodape: 'clientes registados'
    },
    {
      rotulo: 'Empréstimos Ativos',
      valor: Formato.numero(dados.emprestimosAtivos),
      icone: 'fa-file-contract',
      cor: 'marinho',
      rodape: 'contratos em curso'
    },
    {
      rotulo: 'Valor Emprestado',
      valor: Formato.moeda(dados.valorEmprestado),
      icone: 'fa-sack-dollar',
      cor: 'esmeralda',
      rodape: 'carteira ativa'
    },
    {
      rotulo: 'Recebido Hoje',
      valor: Formato.moeda(dados.valorRecebidoHoje),
      icone: 'fa-hand-holding-dollar',
      cor: 'esmeralda',
      rodape: 'pagamentos de hoje'
    },
    {
      rotulo: 'Caixa Atual',
      valor: Formato.moeda(dados.saldoCaixa),
      icone: 'fa-cash-register',
      cor: dados.saldoCaixa >= 0 ? 'esmeralda' : 'terracota',
      rodape: 'saldo disponível'
    },
    {
      rotulo: 'Empréstimos em Atraso',
      valor: Formato.numero(dados.emprestimosEmAtraso),
      icone: 'fa-triangle-exclamation',
      cor: dados.emprestimosEmAtraso > 0 ? 'terracota' : 'esmeralda',
      rodape: Formato.moeda(dados.valorEmAtraso) + ' em atraso'
    }
  ];

  grade.innerHTML = cartoes.map(function (c) {
    return (
      '<div class="cartao-indicador">' +
        '<div class="cartao-indicador__topo">' +
          '<span class="cartao-indicador__rotulo">' + c.rotulo + '</span>' +
          '<div class="cartao-indicador__icone cartao-indicador__icone--' + c.cor + '"><i class="fa-solid ' + c.icone + '"></i></div>' +
        '</div>' +
        '<div class="cartao-indicador__valor">' + c.valor + '</div>' +
        '<div class="cartao-indicador__rodape">' + c.rodape + '</div>' +
      '</div>'
    );
  }).join('');
}

function renderizarUltimosPagamentos(pagamentos) {
  const container = document.getElementById('lista-ultimos-pagamentos');

  if (!pagamentos || !pagamentos.length) {
    container.innerHTML = criarEstadoVazio('fa-receipt', 'Sem pagamentos ainda', 'Os pagamentos recebidos vão aparecer aqui.');
    return;
  }

  container.innerHTML = pagamentos.map(function (p) {
    return (
      '<div class="lista-simples__item">' +
        '<div>' +
          '<div class="lista-simples__principal">Contrato #' + Utils.escaparHtml(p.numeroContrato) + '</div>' +
          '<div class="lista-simples__secundario">' + Utils.escaparHtml(p.metodo) + ' · ' + p.dataPagamentoFormatada + '</div>' +
        '</div>' +
        '<div class="lista-simples__valor texto-sucesso">+' + Formato.moeda(p.valorPago) + '</div>' +
      '</div>'
    );
  }).join('');
}

function renderizarProximosVencimentos(vencimentos) {
  const container = document.getElementById('lista-proximos-vencimentos');

  if (!vencimentos || !vencimentos.length) {
    container.innerHTML = criarEstadoVazio('fa-calendar-check', 'Sem vencimentos próximos', 'Nenhuma parcela vence nos próximos 30 dias.');
    return;
  }

  container.innerHTML = vencimentos.map(function (v) {
    const classeBadge = Formato.classeBadge(v.estado);
    return (
      '<div class="lista-simples__item">' +
        '<div>' +
          '<div class="lista-simples__principal">Contrato #' + Utils.escaparHtml(v.numeroContrato) + ' · Parcela ' + v.numeroParcela + '</div>' +
          '<div class="lista-simples__secundario">Vence em ' + v.vencimentoFormatado + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div class="lista-simples__valor">' + Formato.moeda(v.total) + '</div>' +
          '<span class="badge badge--' + classeBadge + '" style="margin-top:2px;">' + Utils.escaparHtml(v.estado) + '</span>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function criarEstadoVazio(icone, titulo, texto) {
  return (
    '<div class="estado-vazio" style="padding:var(--espaco-6) 0;">' +
      '<i class="fa-solid ' + icone + '"></i>' +
      '<div class="estado-vazio__titulo">' + titulo + '</div>' +
      '<div class="estado-vazio__texto">' + texto + '</div>' +
    '</div>'
  );
}
