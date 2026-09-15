/**
 * =====================================================================
 * LÓGICA DE DETALHE DO EMPRÉSTIMO — js/emprestimo-detalhe.js
 * =====================================================================
 */

let EmprestimoAtual = null;

document.addEventListener('DOMContentLoaded', function () {
  Layout.inicializar('emprestimos');

  const numeroContrato = Utils.obterParametroUrl('contrato');
  if (!numeroContrato) {
    window.location.href = 'emprestimos.html';
    return;
  }

  Mascara.moeda(document.getElementById('pagamento-valor'));
  Mascara.moeda(document.getElementById('pagamento-multa'));
  document.getElementById('form-pagamento').addEventListener('submit', submeterPagamento);

  carregarDetalheEmprestimo(numeroContrato);
});

async function carregarDetalheEmprestimo(numeroContrato) {
  const container = document.getElementById('conteudo-detalhe-emprestimo');

  const resposta = await API.chamar('obterEmprestimo', { numeroContrato: numeroContrato });

  if (!resposta.success) {
    container.innerHTML = '<div class="estado-vazio"><i class="fa-solid fa-triangle-exclamation"></i><div class="estado-vazio__titulo">Empréstimo não encontrado</div><div class="estado-vazio__texto">' + Utils.escaparHtml(resposta.error) + '</div></div>';
    return;
  }

  EmprestimoAtual = resposta.data;
  container.innerHTML = montarHtmlDetalheEmprestimo(EmprestimoAtual);
}

function montarHtmlDetalheEmprestimo(e) {
  const cliente = e.cliente || {};
  const classeBadge = Formato.classeBadge(e.estado);
  const podeReceberPagamento = (e.estado === 'Ativo' || e.estado === 'Em atraso');

  return (
    '<div class="pagina-cabecalho">' +
      '<div>' +
        '<h1 class="pagina-titulo">Contrato #' + Utils.escaparHtml(e.numeroContrato) + ' <span class="badge badge--' + classeBadge + '">' + Utils.escaparHtml(e.estado) + '</span></h1>' +
        '<p class="pagina-subtitulo">Cliente: <a href="cliente-perfil.html?codigo=' + encodeURIComponent(cliente.codigo || '') + '">' + Utils.escaparHtml(cliente.nomeCompleto || '—') + '</a></p>' +
      '</div>' +
      '<div class="pagina-acoes">' +
        (podeReceberPagamento ? '<button class="botao botao--sucesso" data-acao="abrir-modal-pagamento"><i class="fa-solid fa-money-bill-transfer"></i> Registar Pagamento</button>' : '') +
        (e.estado === 'Pendente' ? '<button class="botao botao--primario" data-acao="aprovar-emprestimo" data-contrato="' + Utils.escaparHtml(e.numeroContrato) + '"><i class="fa-solid fa-check"></i> Aprovar</button>' : '') +
      '</div>' +
    '</div>' +

    '<div class="grade-indicadores" style="grid-template-columns: repeat(4, 1fr);">' +
      '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Valor Aprovado</span><div class="cartao-indicador__valor">' + Formato.moeda(e.valorAprovado) + '</div></div>' +
      '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Juros Totais</span><div class="cartao-indicador__valor">' + Formato.moeda(e.juroTotal) + '</div></div>' +
      '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Valor Total</span><div class="cartao-indicador__valor">' + Formato.moeda(e.valorTotal) + '</div></div>' +
      '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Saldo Devedor</span><div class="cartao-indicador__valor ' + (parseFloat(e.saldoDevedor) > 0 ? 'texto-perigo' : 'texto-sucesso') + '">' + Formato.moeda(e.saldoDevedor) + '</div></div>' +
    '</div>' +

    '<div class="grade-perfil">' +

      '<div class="cartao">' +
        '<div class="cartao__cabecalho"><span class="cartao__titulo">Plano de Parcelas</span></div>' +
        '<div class="plano-parcelas">' + (e.parcelas.length ? e.parcelas.map(linhaParcelaDetalhe).join('') : '<div class="estado-vazio"><div class="estado-vazio__texto">Sem parcelas geradas.</div></div>') + '</div>' +
      '</div>' +

      '<div>' +
        '<div class="cartao" style="margin-bottom:var(--espaco-5);">' +
          '<div class="cartao__cabecalho"><span class="cartao__titulo">Dados do Contrato</span></div>' +
          '<div class="lista-info" style="grid-template-columns: 1fr;">' +
            criarItemInfoDetalhe('Taxa de Juros', e.taxaJuros + '%') +
            criarItemInfoDetalhe('Prazo', e.prazo + ' ' + e.unidadePrazo) +
            criarItemInfoDetalhe('Nº de Parcelas', e.numeroParcelas) +
            criarItemInfoDetalhe('Valor da Prestação', Formato.moeda(e.valorPrestacao)) +
            criarItemInfoDetalhe('Data de Desembolso', Formato.data(e.dataDesembolso)) +
            criarItemInfoDetalhe('Criado Por', e.criadoPor || '—') +
          '</div>' +
          (e.observacoes ? '<div class="secao-formulario"><div class="secao-formulario__titulo">Observações</div><p style="font-size:var(--tamanho-sm);color:var(--cor-texto-secundario);">' + Utils.escaparHtml(e.observacoes) + '</p></div>' : '') +
        '</div>' +

        '<div class="cartao">' +
          '<div class="cartao__cabecalho"><span class="cartao__titulo">Fiador</span></div>' +
          '<div class="lista-info" style="grid-template-columns: 1fr;">' +
            criarItemInfoDetalhe('Nome', cliente.nomeFiador || 'Não informado') +
            criarItemInfoDetalhe('Telefone', cliente.telefoneFiador || '—') +
          '</div>' +
        '</div>' +
      '</div>' +

    '</div>'
  );
}

function criarItemInfoDetalhe(rotulo, valor) {
  return '<div class="lista-info__item"><div class="rotulo">' + rotulo + '</div><div class="valor">' + Utils.escaparHtml(String(valor)) + '</div></div>';
}

function linhaParcelaDetalhe(p) {
  const hoje = new Date();
  const vencimento = new Date(p.vencimento);
  let classeLinha = '';
  if (p.estado === 'Paga') classeLinha = 'paga';
  else if (p.estado === 'Atrasada' || (vencimento < hoje && p.estado !== 'Paga')) classeLinha = 'atrasada';

  return (
    '<div class="parcela-linha ' + classeLinha + '">' +
      '<div class="parcela-numero">' + p.numero + '</div>' +
      '<div class="parcela-detalhe">' +
        '<div class="parcela-vencimento">Vencimento: ' + Formato.data(p.vencimento) + '</div>' +
        '<div class="parcela-composicao">Capital: ' + Formato.moeda(p.capital) + ' + Juros: ' + Formato.moeda(p.juros) + '</div>' +
      '</div>' +
      '<div class="parcela-valores">' +
        '<div class="parcela-total">' + Formato.moeda(p.total) + '</div>' +
        '<span class="badge badge--' + Formato.classeBadge(p.estado) + '">' + Utils.escaparHtml(p.estado) + '</span>' +
      '</div>' +
    '</div>'
  );
}

/* =====================================================================
   AÇÕES
   ===================================================================== */

/**
 * Delegação de eventos para os botões de ação do cabeçalho (Registar
 * Pagamento, Aprovar). Segue o mesmo padrão de data-acao usado nas
 * restantes páginas do sistema.
 */
document.addEventListener('click', function (e) {
  const botao = e.target.closest('[data-acao]');
  if (!botao) return;

  if (botao.dataset.acao === 'abrir-modal-pagamento') {
    abrirModalPagamento();
  } else if (botao.dataset.acao === 'aprovar-emprestimo') {
    aprovarEmprestimo(botao.dataset.contrato);
  }
});

function aprovarEmprestimo(numeroContrato) {
  Modal.confirmar({
    titulo: 'Aprovar empréstimo',
    texto: 'O valor será desembolsado e registado como saída no caixa. Deseja continuar?',
    textoConfirmar: 'Aprovar e Desembolsar',
    aoConfirmar: async function () {
      Utils.mostrarCarregamento(true, 'A aprovar...');
      const resposta = await API.chamar('aprovarEmprestimo', { numeroContrato: numeroContrato });
      Utils.mostrarCarregamento(false);
      if (!resposta.success) { Alertas.erro('Não foi possível aprovar', resposta.error); return; }
      Alertas.sucesso('Empréstimo aprovado', '');
      carregarDetalheEmprestimo(numeroContrato);
    }
  });
}

function abrirModalPagamento() {
  document.getElementById('form-pagamento').reset();
  document.getElementById('pagamento-numero-contrato').value = EmprestimoAtual.numeroContrato;
  document.getElementById('modal-pagamento-subtitulo').textContent = 'Contrato #' + EmprestimoAtual.numeroContrato;
  document.getElementById('pagamento-saldo-devedor').textContent = Formato.moeda(EmprestimoAtual.saldoDevedor);
  document.getElementById('pagamento-data').value = Formato.paraInputDate(new Date());
  Validacao.limparErros(document.getElementById('form-pagamento'));
  Modal.abrir('modal-pagamento');
}

async function submeterPagamento(e) {
  e.preventDefault();

  if (!Validacao.validarFormulario(e.target)) {
    Alertas.aviso('Verifique o formulário', 'Introduza um valor de pagamento válido.');
    return;
  }

  const dados = {
    numeroContrato: document.getElementById('pagamento-numero-contrato').value,
    valorPago: Mascara.valorNumerico(document.getElementById('pagamento-valor')),
    multa: Mascara.valorNumerico(document.getElementById('pagamento-multa')),
    metodo: document.querySelector('input[name="pagamento-metodo"]:checked').value,
    dataPagamento: document.getElementById('pagamento-data').value,
    observacoes: document.getElementById('pagamento-observacoes').value.trim()
  };

  const botao = document.getElementById('botao-confirmar-pagamento');
  Utils.definirBotaoCarregando(botao, true, 'A registar...');

  const resposta = await API.chamar('registarPagamento', dados);

  Utils.definirBotaoCarregando(botao, false);

  if (!resposta.success) {
    Alertas.erro('Não foi possível registar o pagamento', resposta.error);
    return;
  }

  Modal.fechar('modal-pagamento');
  Alertas.sucesso('Pagamento registado', 'Recibo Nº ' + resposta.data.numeroRecibo + ' gerado com sucesso.');
  carregarDetalheEmprestimo(dados.numeroContrato);
}
