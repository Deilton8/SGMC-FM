/**
 * =====================================================================
 * LÓGICA DE PAGAMENTOS — js/pagamentos.js
 * =====================================================================
 */

const EstadoPagamentos = {
  filtroMetodo: '',
  dataInicio: '',
  dataFim: ''
};

let ReciboAtual = null;

document.addEventListener('DOMContentLoaded', function () {
  Layout.inicializar('pagamentos');

  carregarPagamentos();

  document.getElementById('filtro-metodo-pagamentos').addEventListener('change', function (e) {
    EstadoPagamentos.filtroMetodo = e.target.value;
    carregarPagamentos();
  });
  document.getElementById('filtro-data-inicio-pagamentos').addEventListener('change', function (e) {
    EstadoPagamentos.dataInicio = e.target.value;
    carregarPagamentos();
  });
  document.getElementById('filtro-data-fim-pagamentos').addEventListener('change', function (e) {
    EstadoPagamentos.dataFim = e.target.value;
    carregarPagamentos();
  });

  document.getElementById('botao-baixar-recibo-pdf').addEventListener('click', baixarReciboPdf);
});

async function carregarPagamentos() {
  const corpo = document.getElementById('tabela-pagamentos-corpo');
  corpo.innerHTML = '<tr class="linha-carregando"><td colspan="9"><div class="linha-carregando-conteudo"><div class="girador"></div> A carregar...</div></td></tr>';

  const resposta = await API.chamar('listarPagamentos', {
    metodo: EstadoPagamentos.filtroMetodo,
    limite: 200
  });

  if (!resposta.success) {
    corpo.innerHTML = '<tr><td colspan="9"><div class="estado-vazio"><i class="fa-solid fa-triangle-exclamation"></i><div class="estado-vazio__titulo">Erro ao carregar</div><div class="estado-vazio__texto">' + Utils.escaparHtml(resposta.error) + '</div></div></td></tr>';
    return;
  }

  let itens = resposta.data;

  if (EstadoPagamentos.dataInicio) {
    const inicio = new Date(EstadoPagamentos.dataInicio);
    itens = itens.filter(function (p) { return new Date(p.dataPagamento) >= inicio; });
  }
  if (EstadoPagamentos.dataFim) {
    const fim = new Date(EstadoPagamentos.dataFim);
    fim.setHours(23, 59, 59, 999);
    itens = itens.filter(function (p) { return new Date(p.dataPagamento) <= fim; });
  }

  renderizarTabelaPagamentos(itens);
}

function renderizarTabelaPagamentos(pagamentos) {
  const corpo = document.getElementById('tabela-pagamentos-corpo');

  if (!pagamentos.length) {
    corpo.innerHTML = '<tr><td colspan="9"><div class="estado-vazio"><i class="fa-solid fa-receipt"></i><div class="estado-vazio__titulo">Nenhum pagamento encontrado</div><div class="estado-vazio__texto">Tente ajustar os filtros.</div></div></td></tr>';
    return;
  }

  corpo.innerHTML = pagamentos.map(function (p) {
    const classeBadge = Formato.classeBadge(p.estado);
    return (
      '<tr>' +
        '<td>#' + Utils.escaparHtml(p.numeroRecibo) + '</td>' +
        '<td><a href="emprestimo-detalhe.html?contrato=' + encodeURIComponent(p.numeroContrato) + '">#' + Utils.escaparHtml(p.numeroContrato) + '</a></td>' +
        '<td class="col-numerica texto-sucesso">' + Formato.moeda(p.valorPago) + '</td>' +
        '<td class="col-numerica">' + (parseFloat(p.multa) > 0 ? Formato.moeda(p.multa) : '—') + '</td>' +
        '<td>' + Utils.escaparHtml(p.metodo) + '</td>' +
        '<td>' + Formato.dataHora(p.dataPagamento) + '</td>' +
        '<td>' + Utils.escaparHtml(p.operador) + '</td>' +
        '<td><span class="badge badge--' + classeBadge + '">' + Utils.escaparHtml(p.estado) + '</span></td>' +
        '<td class="col-acoes">' +
          '<div class="grupo-acoes-tabela">' +
            '<button class="botao-acao-tabela" title="Ver recibo" data-acao="ver-recibo" data-id="' + Utils.escaparHtml(p.id) + '"><i class="fa-solid fa-receipt"></i></button>' +
            (p.estado !== 'Estornado' ? '<button class="botao-acao-tabela botao-acao-tabela--perigo" title="Estornar" data-acao="estornar-pagamento" data-id="' + Utils.escaparHtml(p.id) + '" data-somente-admin><i class="fa-solid fa-rotate-left"></i></button>' : '') +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');

  // Reaplica a restrição de perfil aos botões recém-criados
  const utilizador = API.obterUtilizadorAtual();
  if (utilizador && utilizador.perfil !== 'Administrador') {
    document.querySelectorAll('[data-somente-admin]').forEach(function (el) { el.style.display = 'none'; });
  }
}

/**
 * Delegação de eventos para os botões de ação da tabela (ver recibo,
 * estornar). Segue o mesmo padrão de data-acao usado nas restantes
 * páginas do sistema.
 */
document.addEventListener('click', function (e) {
  const botao = e.target.closest('[data-acao]');
  if (!botao) return;

  const id = botao.dataset.id;
  if (botao.dataset.acao === 'ver-recibo') {
    verRecibo(id);
  } else if (botao.dataset.acao === 'estornar-pagamento') {
    confirmarEstorno(id);
  }
});

/* =====================================================================
   RECIBO
   ===================================================================== */

async function verRecibo(idPagamento) {
  Utils.mostrarCarregamento(true, 'A gerar recibo...');
  const resposta = await API.chamar('gerarReciboTexto', { idPagamento: idPagamento });
  Utils.mostrarCarregamento(false);

  if (!resposta.success) {
    Alertas.erro('Não foi possível gerar o recibo', resposta.error);
    return;
  }

  ReciboAtual = resposta.data;
  document.getElementById('recibo-preview-conteudo').innerHTML = montarHtmlRecibo(ReciboAtual);
  Modal.abrir('modal-recibo');
}

function montarHtmlRecibo(r) {
  const linhasContacto = [
    r.empresa.telefone ? '<div class="recibo-preview__contacto">' + Utils.escaparHtml(r.empresa.telefone) + '</div>' : '',
    r.empresa.endereco ? '<div class="recibo-preview__contacto">' + Utils.escaparHtml(r.empresa.endereco) + '</div>' : ''
  ].join('');

  const logotipoHtml = r.empresa.logotipoUrl
    ? '<img src="' + Utils.escaparHtml(r.empresa.logotipoUrl) + '" alt="Logotipo" class="recibo-preview__logotipo">'
    : '';

  return (
    '<div class="recibo-preview__cabecalho">' +
      logotipoHtml +
      '<div class="recibo-preview__empresa">' + Utils.escaparHtml(r.empresa.nome) + '</div>' +
      linhasContacto +
      '<div class="recibo-preview__numero">Recibo Nº ' + Utils.escaparHtml(r.numeroRecibo) + '</div>' +
    '</div>' +
    '<div class="recibo-preview__linha"><span>Cliente</span><strong>' + Utils.escaparHtml(r.cliente ? r.cliente.nome : '—') + '</strong></div>' +
    '<div class="recibo-preview__linha"><span>BI</span><span>' + Utils.escaparHtml(r.cliente ? r.cliente.bi : '—') + '</span></div>' +
    '<div class="recibo-preview__linha"><span>Contrato</span><span>#' + Utils.escaparHtml(r.numeroContrato) + '</span></div>' +
    '<div class="recibo-preview__linha"><span>Data</span><span>' + Utils.escaparHtml(r.dataPagamentoFormatada) + '</span></div>' +
    '<div class="recibo-preview__linha"><span>Método</span><span>' + Utils.escaparHtml(r.metodo) + '</span></div>' +
    '<div class="recibo-preview__linha"><span>Operador</span><span>' + Utils.escaparHtml(r.operador) + '</span></div>' +
    (parseFloat(r.multa) > 0 ? '<div class="recibo-preview__linha"><span>Multa</span><span>' + Formato.moeda(r.multa) + '</span></div>' : '') +
    '<div class="recibo-preview__linha"><span>Saldo Restante</span><span>' + Formato.moeda(r.saldoRestante) + '</span></div>' +
    '<div class="recibo-preview__total"><span>Valor Pago</span><span>' + Formato.moeda(r.valorPago) + '</span></div>'
  );
}

function baixarReciboPdf() {
  if (!ReciboAtual) return;
  const r = ReciboAtual;

  // eslint-disable-next-line no-undef
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: [80, 150] }); // formato tipo talão

  let y = 12;

  // Logotipo da empresa, se configurado. getImageProperties devolve as
  // dimensões reais da imagem para calcular a altura mantendo a proporção
  // (evita distorcer logotipos não quadrados); a largura e a altura estão
  // ambas limitadas, e a mais restritiva das duas é que define o tamanho
  // final, já que o talão tem só 80mm de largura útil.
  if (r.empresa.logotipoUrl) {
    try {
      const formatoImagem = (r.empresa.logotipoUrl.match(/^data:image\/(\w+);/) || [, 'PNG'])[1].toUpperCase();
      const propriedadesImagem = doc.getImageProperties(r.empresa.logotipoUrl);
      const larguraMaxima = 24;
      const alturaMaxima = 20;
      const proporcao = propriedadesImagem.width / propriedadesImagem.height;
      let largura = larguraMaxima;
      let altura = largura / proporcao;
      if (altura > alturaMaxima) {
        altura = alturaMaxima;
        largura = altura * proporcao;
      }
      doc.addImage(r.empresa.logotipoUrl, formatoImagem, 40 - largura / 2, y, largura, altura);
      y += altura + 4;
    } catch (erroLogotipo) {
      // Um logotipo corrompido ou em formato não suportado pelo jsPDF não
      // deve impedir a geração do resto do recibo — simplesmente é omitido.
      console.error('Não foi possível incluir o logotipo no PDF do recibo:', erroLogotipo);
    }
  }

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(r.empresa.nome, 40, y, { align: 'center' });
  y += 6;

  // Dados de contacto da empresa (telefone/endereço), se configurados.
  // splitTextToSize evita que um telefone ou morada mais longos saiam da
  // margem dos 80mm de largura do talão — quebra em várias linhas conforme
  // necessário, com y avançando o número exato de linhas geradas.
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  [r.empresa.telefone, r.empresa.endereco].filter(Boolean).forEach(function (texto) {
    const linhasTexto = doc.splitTextToSize(texto, 68);
    linhasTexto.forEach(function (linhaTexto) {
      doc.text(linhaTexto, 40, y, { align: 'center' });
      y += 4;
    });
  });
  y += 2;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('Recibo Nº ' + r.numeroRecibo, 40, y, { align: 'center' });
  y += 8;
  doc.line(6, y, 74, y);
  y += 6;

  const linha = function (rotulo, valor) {
    doc.text(rotulo, 6, y);
    doc.text(String(valor), 74, y, { align: 'right' });
    y += 6;
  };

  linha('Cliente:', r.cliente ? r.cliente.nome : '—');
  linha('BI:', r.cliente ? r.cliente.bi : '—');
  linha('Contrato:', '#' + r.numeroContrato);
  linha('Data:', r.dataPagamentoFormatada);
  linha('Método:', r.metodo);
  linha('Operador:', r.operador);
  if (parseFloat(r.multa) > 0) linha('Multa:', Formato.moeda(r.multa));
  linha('Saldo Restante:', Formato.moeda(r.saldoRestante));

  y += 2;
  doc.line(6, y, 74, y);
  y += 7;
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  linha('VALOR PAGO:', Formato.moeda(r.valorPago));

  y += 8;
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Obrigado pela preferência!', 40, y, { align: 'center' });

  doc.save('recibo-' + r.numeroRecibo + '.pdf');
}

/* =====================================================================
   ESTORNO
   ===================================================================== */

function confirmarEstorno(idPagamento) {
  Modal.confirmar({
    titulo: 'Estornar pagamento',
    texto: 'Esta ação reverte o valor no saldo devedor do empréstimo. Use apenas para corrigir erros de lançamento. Deseja continuar?',
    textoConfirmar: 'Estornar',
    tipoPerigo: true,
    aoConfirmar: async function () {
      Utils.mostrarCarregamento(true, 'A estornar...');
      const resposta = await API.chamar('estornarPagamento', { idPagamento: idPagamento });
      Utils.mostrarCarregamento(false);

      if (!resposta.success) { Alertas.erro('Não foi possível estornar', resposta.error); return; }
      Alertas.sucesso('Pagamento estornado', '');
      carregarPagamentos();
    }
  });
}
