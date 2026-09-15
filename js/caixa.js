/**
 * =====================================================================
 * LÓGICA DE CAIXA — js/caixa.js
 * =====================================================================
 */

const EstadoCaixa = { filtroTipo: '' };

document.addEventListener('DOMContentLoaded', function () {
  Layout.inicializar('caixa');

  Mascara.moeda(document.getElementById('movimento-valor'));

  carregarSaldoCaixa();
  carregarMovimentosCaixa();

  document.getElementById('botao-nova-entrada').addEventListener('click', function () { abrirModalMovimento('Entrada'); });
  document.getElementById('botao-nova-saida').addEventListener('click', function () { abrirModalMovimento('Saída'); });
  document.getElementById('form-movimento-caixa').addEventListener('submit', submeterMovimentoCaixa);

  document.getElementById('filtro-tipo-caixa').addEventListener('change', function (e) {
    EstadoCaixa.filtroTipo = e.target.value;
    carregarMovimentosCaixa();
  });
});

async function carregarSaldoCaixa() {
  const resposta = await API.chamar('saldoCaixa', {});
  if (!resposta.success) return;

  const d = resposta.data;
  document.getElementById('caixa-saldo-atual').textContent = Formato.moeda(d.saldoAtual);
  document.getElementById('caixa-entradas-hoje').textContent = Formato.moeda(d.hoje.entradas);
  document.getElementById('caixa-saidas-hoje').textContent = Formato.moeda(d.hoje.saidas);

  const liquidoMes = document.getElementById('caixa-liquido-mes');
  liquidoMes.textContent = Formato.moeda(d.mes.liquido);
  liquidoMes.className = 'cartao-indicador__valor ' + (d.mes.liquido >= 0 ? 'texto-sucesso' : 'texto-perigo');
}

async function carregarMovimentosCaixa() {
  const corpo = document.getElementById('tabela-caixa-corpo');
  corpo.innerHTML = '<tr class="linha-carregando"><td colspan="6"><div class="linha-carregando-conteudo"><div class="girador"></div> A carregar...</div></td></tr>';

  const resposta = await API.chamar('listarCaixa', { tipo: EstadoCaixa.filtroTipo, limite: 200 });

  if (!resposta.success) {
    corpo.innerHTML = '<tr><td colspan="6"><div class="estado-vazio"><i class="fa-solid fa-triangle-exclamation"></i><div class="estado-vazio__titulo">Erro ao carregar</div><div class="estado-vazio__texto">' + Utils.escaparHtml(resposta.error) + '</div></div></td></tr>';
    return;
  }

  renderizarTabelaCaixa(resposta.data);
}

function renderizarTabelaCaixa(movimentos) {
  const corpo = document.getElementById('tabela-caixa-corpo');

  if (!movimentos.length) {
    corpo.innerHTML = '<tr><td colspan="6"><div class="estado-vazio"><i class="fa-solid fa-cash-register"></i><div class="estado-vazio__titulo">Nenhum movimento encontrado</div><div class="estado-vazio__texto">Os movimentos de caixa vão aparecer aqui.</div></div></td></tr>';
    return;
  }

  corpo.innerHTML = movimentos.map(function (m) {
    const ehEntrada = m.tipo === 'Entrada';
    return (
      '<tr>' +
        '<td>' + Formato.dataHora(m.data) + '</td>' +
        '<td><span class="badge ' + (ehEntrada ? 'badge--ativo' : 'badge--em-atraso') + '"><i class="fa-solid ' + (ehEntrada ? 'fa-arrow-up' : 'fa-arrow-down') + '" style="margin-right:4px;"></i>' + Utils.escaparHtml(m.tipo) + '</span></td>' +
        '<td>' + Utils.escaparHtml(m.categoria) + '</td>' +
        '<td class="tabela-dados__linha-secundaria" style="max-width:280px;">' + Utils.escaparHtml(m.descricao || '—') + (m.referencia ? ' <a href="emprestimo-detalhe.html?contrato=' + encodeURIComponent(m.referencia) + '">(#' + Utils.escaparHtml(m.referencia) + ')</a>' : '') + '</td>' +
        '<td class="col-numerica ' + (ehEntrada ? 'texto-sucesso' : 'texto-perigo') + '">' + (ehEntrada ? '+' : '−') + ' ' + Formato.moeda(m.valor) + '</td>' +
        '<td>' + Utils.escaparHtml(m.operador) + '</td>' +
      '</tr>'
    );
  }).join('');
}

function abrirModalMovimento(tipo) {
  document.getElementById('form-movimento-caixa').reset();
  document.getElementById('movimento-tipo').value = tipo;
  document.getElementById('modal-movimento-titulo').textContent = tipo === 'Entrada' ? 'Registar Entrada' : 'Registar Saída';
  document.getElementById('movimento-categoria').placeholder = tipo === 'Entrada' ? 'ex.: Aporte de Capital' : 'ex.: Despesas Administrativas';
  Validacao.limparErros(document.getElementById('form-movimento-caixa'));
  Modal.abrir('modal-movimento-caixa');
}

async function submeterMovimentoCaixa(e) {
  e.preventDefault();

  if (!Validacao.validarFormulario(e.target)) {
    Alertas.aviso('Verifique o formulário', 'Preencha a categoria e um valor válido.');
    return;
  }

  const dados = {
    tipo: document.getElementById('movimento-tipo').value,
    categoria: document.getElementById('movimento-categoria').value.trim(),
    valor: Mascara.valorNumerico(document.getElementById('movimento-valor')),
    descricao: document.getElementById('movimento-descricao').value.trim()
  };

  const botao = document.getElementById('botao-confirmar-movimento');
  Utils.definirBotaoCarregando(botao, true, 'A registar...');

  const resposta = await API.chamar('registarMovimento', dados);

  Utils.definirBotaoCarregando(botao, false);

  if (!resposta.success) {
    Alertas.erro('Não foi possível registar', resposta.error);
    return;
  }

  Modal.fechar('modal-movimento-caixa');
  Alertas.sucesso('Movimento registado', '');
  carregarSaldoCaixa();
  carregarMovimentosCaixa();
}
