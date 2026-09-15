/**
 * =====================================================================
 * LÓGICA DE EMPRÉSTIMOS — js/emprestimos.js
 * =====================================================================
 */

const EstadoEmprestimos = {
  pagina: 1,
  porPagina: 10,
  termoPesquisa: '',
  filtroEstado: '',
  clienteSelecionado: null,
  taxaJurosPadrao: null
};

document.addEventListener('DOMContentLoaded', function () {
  Layout.inicializar('emprestimos');

  carregarEmprestimos();
  configurarFormularioSimulacao();
  carregarTaxaJurosPadrao();

  document.getElementById('botao-novo-emprestimo').addEventListener('click', function () {
    abrirModalNovoEmprestimo();
  });

  document.getElementById('form-emprestimo').addEventListener('submit', submeterNovoEmprestimo);

  document.getElementById('filtro-pesquisa-emprestimos').addEventListener('input', Utils.debounce(function (e) {
    EstadoEmprestimos.termoPesquisa = e.target.value.trim();
    EstadoEmprestimos.pagina = 1;
    carregarEmprestimos();
  }, 400));

  document.getElementById('filtro-estado-emprestimos').addEventListener('change', function (e) {
    EstadoEmprestimos.filtroEstado = e.target.value;
    EstadoEmprestimos.pagina = 1;
    carregarEmprestimos();
  });

  // Suporte a abertura direta via ?novo=1&cliente=CODIGO (vindo do dashboard ou perfil do cliente)
  if (Utils.obterParametroUrl('novo') === '1') {
    const clientePreSelecionado = Utils.obterParametroUrl('cliente');
    abrirModalNovoEmprestimo(clientePreSelecionado);
  }
});

/* =====================================================================
   LISTAGEM
   ===================================================================== */

async function carregarEmprestimos() {
  const corpo = document.getElementById('tabela-emprestimos-corpo');
  corpo.innerHTML = '<tr class="linha-carregando"><td colspan="7"><div class="linha-carregando-conteudo"><div class="girador"></div> A carregar...</div></td></tr>';

  const resposta = await API.chamar('listarEmprestimos', {
    pagina: EstadoEmprestimos.pagina,
    porPagina: EstadoEmprestimos.porPagina,
    estado: EstadoEmprestimos.filtroEstado
  });

  if (!resposta.success) {
    corpo.innerHTML = '<tr><td colspan="7"><div class="estado-vazio"><i class="fa-solid fa-triangle-exclamation"></i><div class="estado-vazio__titulo">Erro ao carregar</div><div class="estado-vazio__texto">' + Utils.escaparHtml(resposta.error) + '</div></div></td></tr>';
    return;
  }

  let itens = resposta.data.itens;
  if (EstadoEmprestimos.termoPesquisa) {
    const termo = EstadoEmprestimos.termoPesquisa.toLowerCase();
    itens = itens.filter(function (e) { return String(e.numeroContrato).toLowerCase().indexOf(termo) !== -1; });
  }

  renderizarTabelaEmprestimos(itens);
  renderizarPaginacaoEmprestimos(resposta.data);
}

function renderizarTabelaEmprestimos(emprestimos) {
  const corpo = document.getElementById('tabela-emprestimos-corpo');

  if (!emprestimos.length) {
    corpo.innerHTML = '<tr><td colspan="7"><div class="estado-vazio"><i class="fa-solid fa-file-circle-xmark"></i><div class="estado-vazio__titulo">Nenhum empréstimo encontrado</div><div class="estado-vazio__texto">Tente ajustar os filtros ou crie um novo empréstimo.</div></div></td></tr>';
    return;
  }

  corpo.innerHTML = emprestimos.map(function (e) {
    const classeBadge = Formato.classeBadge(e.estado);
    return (
      '<tr>' +
        '<td><a href="emprestimo-detalhe.html?contrato=' + encodeURIComponent(e.numeroContrato) + '">#' + Utils.escaparHtml(e.numeroContrato) + '</a></td>' +
        '<td>' + Utils.escaparHtml(e.clienteNome) + '</td>' +
        '<td class="col-numerica">' + Formato.moeda(e.valorAprovado) + '</td>' +
        '<td class="col-numerica">' + Formato.moeda(e.saldoDevedor) + '</td>' +
        '<td>' + e.prazo + ' ' + Utils.escaparHtml(e.unidadePrazo) + '</td>' +
        '<td><span class="badge badge--' + classeBadge + '">' + Utils.escaparHtml(e.estado) + '</span></td>' +
        '<td class="col-acoes">' +
          '<div class="grupo-acoes-tabela">' +
            '<a href="emprestimo-detalhe.html?contrato=' + encodeURIComponent(e.numeroContrato) + '" class="botao-acao-tabela" title="Ver detalhe"><i class="fa-solid fa-eye"></i></a>' +
            (e.estado === 'Pendente' ? '<button class="botao-acao-tabela botao-acao-tabela--sucesso" title="Aprovar" data-acao="aprovar-emprestimo" data-contrato="' + Utils.escaparHtml(e.numeroContrato) + '"><i class="fa-solid fa-check"></i></button>' : '') +
            (e.estado === 'Pendente' ? '<button class="botao-acao-tabela botao-acao-tabela--perigo" title="Cancelar" data-acao="cancelar-emprestimo" data-contrato="' + Utils.escaparHtml(e.numeroContrato) + '"><i class="fa-solid fa-ban"></i></button>' : '') +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');
}

/**
 * Delegação de eventos para os botões de ação da tabela (aprovar, cancelar).
 * Segue o mesmo padrão usado em clientes.js e config.js: os dados vêm de
 * atributos data-* já escapados por Utils.escaparHtml ao renderizar a linha,
 * em vez de serem interpolados diretamente num onclick="..." — evita que um
 * número de contrato com caracteres especiais quebre o HTML da página, e
 * mantém a mesma técnica em todas as tabelas do sistema.
 */
document.addEventListener('click', function (e) {
  const botao = e.target.closest('[data-acao]');
  if (!botao) return;

  const acao = botao.dataset.acao;
  const contrato = botao.dataset.contrato;

  if (acao === 'aprovar-emprestimo') {
    aprovarEmprestimo(contrato);
  } else if (acao === 'cancelar-emprestimo') {
    cancelarEmprestimo(contrato);
  }
});

function renderizarPaginacaoEmprestimos(dadosPagina) {
  const info = document.getElementById('paginacao-info-emprestimos');
  const controlos = document.getElementById('paginacao-controlos-emprestimos');

  const inicio = dadosPagina.total === 0 ? 0 : (dadosPagina.pagina - 1) * EstadoEmprestimos.porPagina + 1;
  const fim = Math.min(dadosPagina.pagina * EstadoEmprestimos.porPagina, dadosPagina.total);
  info.textContent = dadosPagina.total === 0 ? 'Nenhum resultado' : ('A mostrar ' + inicio + '–' + fim + ' de ' + dadosPagina.total);

  let html = '<button class="paginacao-botao" ' + (dadosPagina.pagina <= 1 ? 'disabled' : '') + ' onclick="mudarPaginaEmprestimos(' + (dadosPagina.pagina - 1) + ')"><i class="fa-solid fa-chevron-left"></i></button>';
  const totalPaginas = dadosPagina.totalPaginas || 1;
  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || Math.abs(i - dadosPagina.pagina) <= 1) {
      html += '<button class="paginacao-botao ' + (i === dadosPagina.pagina ? 'ativo' : '') + '" onclick="mudarPaginaEmprestimos(' + i + ')">' + i + '</button>';
    } else if (Math.abs(i - dadosPagina.pagina) === 2) {
      html += '<span style="padding:0 4px;color:var(--cor-texto-secundario);">…</span>';
    }
  }
  html += '<button class="paginacao-botao" ' + (dadosPagina.pagina >= totalPaginas ? 'disabled' : '') + ' onclick="mudarPaginaEmprestimos(' + (dadosPagina.pagina + 1) + ')"><i class="fa-solid fa-chevron-right"></i></button>';
  controlos.innerHTML = html;
}

function mudarPaginaEmprestimos(novaPagina) {
  EstadoEmprestimos.pagina = novaPagina;
  carregarEmprestimos();
}

/* =====================================================================
   AÇÕES DE ESTADO (APROVAR / CANCELAR)
   ===================================================================== */

function aprovarEmprestimo(numeroContrato) {
  Modal.confirmar({
    titulo: 'Aprovar empréstimo',
    texto: 'Ao aprovar o contrato #' + numeroContrato + ', o valor será desembolsado e registado como saída no caixa. Deseja continuar?',
    textoConfirmar: 'Aprovar e Desembolsar',
    aoConfirmar: async function () {
      Utils.mostrarCarregamento(true, 'A aprovar empréstimo...');
      const resposta = await API.chamar('aprovarEmprestimo', { numeroContrato: numeroContrato });
      Utils.mostrarCarregamento(false);

      if (!resposta.success) { Alertas.erro('Não foi possível aprovar', resposta.error); return; }
      Alertas.sucesso('Empréstimo aprovado', 'O contrato #' + numeroContrato + ' está agora ativo.');
      carregarEmprestimos();
    }
  });
}

function cancelarEmprestimo(numeroContrato) {
  Modal.confirmar({
    titulo: 'Cancelar empréstimo',
    texto: 'Tem a certeza que deseja cancelar o contrato #' + numeroContrato + '?',
    textoConfirmar: 'Cancelar Contrato',
    tipoPerigo: true,
    aoConfirmar: async function () {
      Utils.mostrarCarregamento(true, 'A cancelar...');
      const resposta = await API.chamar('cancelarEmprestimo', { numeroContrato: numeroContrato });
      Utils.mostrarCarregamento(false);

      if (!resposta.success) { Alertas.erro('Não foi possível cancelar', resposta.error); return; }
      Alertas.sucesso('Contrato cancelado', '');
      carregarEmprestimos();
    }
  });
}

/* =====================================================================
   MODAL: SIMULAÇÃO E CRIAÇÃO DE EMPRÉSTIMO
   ===================================================================== */

function abrirModalNovoEmprestimo(codigoClientePreSelecionado) {
  document.getElementById('form-emprestimo').reset();
  EstadoEmprestimos.clienteSelecionado = null;
  document.getElementById('emprestimo-cliente-codigo').value = '';
  document.getElementById('emprestimo-cliente-selecionado').style.display = 'none';
  document.getElementById('emprestimo-cliente-busca').value = '';
  document.getElementById('emprestimo-unidade-prazo').value = 'meses';
  document.getElementById('emprestimo-data-desembolso').value = Formato.paraInputDate(new Date());
  if (EstadoEmprestimos.taxaJurosPadrao !== null) {
    document.getElementById('emprestimo-taxa-juros').value = EstadoEmprestimos.taxaJurosPadrao;
  }
  limparResumoSimulacao();
  Validacao.limparErros(document.getElementById('form-emprestimo'));

  Modal.abrir('modal-emprestimo');

  if (codigoClientePreSelecionado) {
    selecionarClienteParaEmprestimo({ codigo: codigoClientePreSelecionado, nomeCompleto: 'A carregar...' });
    API.chamar('obterCliente', { codigo: codigoClientePreSelecionado }).then(function (resposta) {
      if (resposta.success) selecionarClienteParaEmprestimo(resposta.data);
    });
  }
}

/**
 * Obtém a taxa de juros padrão configurada (Configurações > Parâmetros
 * Financeiros) uma única vez, para pré-preencher o campo de taxa sempre que
 * o modal de novo empréstimo for aberto — evitando que o operador tenha de
 * a digitar manualmente em todos os contratos. Sem isto, o campo ficava
 * sempre vazio (apenas com um placeholder ilustrativo), independentemente
 * da taxa padrão configurada.
 */
async function carregarTaxaJurosPadrao() {
  const resposta = await API.chamar('obterConfiguracoes', {});
  if (resposta.success && resposta.data.taxaJurosPadrao !== undefined && resposta.data.taxaJurosPadrao !== null) {
    EstadoEmprestimos.taxaJurosPadrao = resposta.data.taxaJurosPadrao;
  }
}

function configurarFormularioSimulacao() {
  const buscaCliente = document.getElementById('emprestimo-cliente-busca');
  const resultadosCliente = document.getElementById('emprestimo-cliente-resultados');

  buscaCliente.addEventListener('input', Utils.debounce(async function () {
    const termo = buscaCliente.value.trim();
    if (termo.length < 2) { resultadosCliente.style.display = 'none'; return; }

    const resposta = await API.chamar('pesquisarClientes', { termo: termo });
    if (!resposta.success || !resposta.data.length) {
      resultadosCliente.innerHTML = '<div style="padding:var(--espaco-3);font-size:var(--tamanho-sm);color:var(--cor-texto-secundario);">Nenhum cliente encontrado.</div>';
      resultadosCliente.style.display = 'block';
      return;
    }

    resultadosCliente.innerHTML = resposta.data.map(function (c) {
      return '<div class="item-resultado-cliente" data-codigo="' + Utils.escaparHtml(c.codigo) + '" style="padding:var(--espaco-3);cursor:pointer;border-bottom:1px solid var(--cor-borda);font-size:var(--tamanho-sm);" onmouseover="this.style.background=\'var(--cor-neutro-50)\'" onmouseout="this.style.background=\'\'">' +
        '<strong>' + Utils.escaparHtml(c.nomeCompleto || '(sem nome)') + '</strong> <span style="color:var(--cor-texto-secundario);">— ' + Utils.escaparHtml(c.codigo) + ' · ' + Utils.escaparHtml(c.telefone || 'sem telefone') + '</span>' +
      '</div>';
    }).join('');
    resultadosCliente.style.display = 'block';

    resultadosCliente.querySelectorAll('.item-resultado-cliente').forEach(function (item) {
      item.addEventListener('click', function () {
        const codigo = item.dataset.codigo;
        const clienteEncontrado = resposta.data.find(function (c) { return c.codigo === codigo; });
        selecionarClienteParaEmprestimo(clienteEncontrado);
      });
    });
  }, 350));

  // Recalcula a simulação sempre que qualquer campo relevante muda
  const camposSimulacao = ['emprestimo-valor-solicitado', 'emprestimo-valor-aprovado', 'emprestimo-taxa-juros', 'emprestimo-prazo', 'emprestimo-unidade-prazo', 'emprestimo-numero-parcelas', 'emprestimo-data-desembolso'];
  const recalcularComDebounce = Utils.debounce(recalcularSimulacao, 300);

  camposSimulacao.forEach(function (id) {
    const el = document.getElementById(id);
    if (['emprestimo-valor-solicitado', 'emprestimo-valor-aprovado'].indexOf(id) !== -1) {
      Mascara.moeda(el);
    }
    el.addEventListener('input', recalcularComDebounce);
    el.addEventListener('change', recalcularComDebounce);
  });

  // Ao mudar o prazo, sugere automaticamente o mesmo número de parcelas (comportamento comum em microcrédito)
  document.getElementById('emprestimo-prazo').addEventListener('input', function () {
    const campoParcelas = document.getElementById('emprestimo-numero-parcelas');
    if (!campoParcelas.dataset.editadoManualmente) {
      campoParcelas.value = this.value;
    }
  });
  document.getElementById('emprestimo-numero-parcelas').addEventListener('input', function () {
    this.dataset.editadoManualmente = '1';
  });
}

function selecionarClienteParaEmprestimo(cliente) {
  EstadoEmprestimos.clienteSelecionado = cliente;
  document.getElementById('emprestimo-cliente-codigo').value = cliente.codigo;
  document.getElementById('emprestimo-cliente-busca').value = '';
  document.getElementById('emprestimo-cliente-resultados').style.display = 'none';

  const painelSelecionado = document.getElementById('emprestimo-cliente-selecionado');
  painelSelecionado.style.display = 'block';
  painelSelecionado.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><strong>' + Utils.escaparHtml(cliente.nomeCompleto || '(sem nome)') + '</strong><br><span style="color:var(--cor-texto-secundario);">' + Utils.escaparHtml(cliente.codigo) + '</span></div>' +
      '<button type="button" onclick="limparClienteSelecionado()" style="border:none;background:transparent;color:var(--cor-texto-secundario);" aria-label="Remover"><i class="fa-solid fa-xmark"></i></button>' +
    '</div>';
}

function limparClienteSelecionado() {
  EstadoEmprestimos.clienteSelecionado = null;
  document.getElementById('emprestimo-cliente-codigo').value = '';
  document.getElementById('emprestimo-cliente-selecionado').style.display = 'none';
}

async function recalcularSimulacao() {
  const valorSolicitado = Mascara.valorNumerico(document.getElementById('emprestimo-valor-solicitado'));
  const valorAprovadoInput = document.getElementById('emprestimo-valor-aprovado');
  const valorAprovado = valorAprovadoInput.value ? Mascara.valorNumerico(valorAprovadoInput) : valorSolicitado;
  const taxaJuros = parseFloat(document.getElementById('emprestimo-taxa-juros').value) || 0;
  const prazo = parseInt(document.getElementById('emprestimo-prazo').value, 10) || 0;
  const unidadePrazo = document.getElementById('emprestimo-unidade-prazo').value;
  const numeroParcelas = parseInt(document.getElementById('emprestimo-numero-parcelas').value, 10) || prazo;
  const dataDesembolso = document.getElementById('emprestimo-data-desembolso').value;

  if (!valorAprovado || !prazo) {
    limparResumoSimulacao();
    return;
  }

  const resposta = await API.chamar('simularEmprestimo', {
    valorSolicitado: valorSolicitado,
    valorAprovado: valorAprovado,
    taxaJuros: taxaJuros,
    prazo: prazo,
    unidadePrazo: unidadePrazo,
    numeroParcelas: numeroParcelas,
    dataDesembolso: dataDesembolso
  });

  if (!resposta.success) return;

  renderizarResumoSimulacao(resposta.data);
}

function limparResumoSimulacao() {
  document.getElementById('sim-valor-aprovado').textContent = '0,00 MT';
  document.getElementById('sim-juros-totais').textContent = '0,00 MT';
  document.getElementById('sim-numero-parcelas').textContent = '—';
  document.getElementById('sim-valor-prestacao').textContent = '0,00 MT';
  document.getElementById('sim-valor-total').textContent = '0,00 MT';
  document.getElementById('tabela-simulacao-parcelas').innerHTML = '';
}

function renderizarResumoSimulacao(calculo) {
  document.getElementById('sim-valor-aprovado').textContent = Formato.moeda(calculo.valorAprovado);
  document.getElementById('sim-juros-totais').textContent = Formato.moeda(calculo.juroTotal);
  document.getElementById('sim-numero-parcelas').textContent = calculo.numeroParcelas;
  document.getElementById('sim-valor-prestacao').textContent = Formato.moeda(calculo.valorPrestacao);
  document.getElementById('sim-valor-total').textContent = Formato.moeda(calculo.valorTotal);

  const container = document.getElementById('tabela-simulacao-parcelas');
  container.innerHTML = '<div style="font-size:var(--tamanho-xs);font-weight:600;color:var(--cor-texto-secundario);margin-bottom:var(--espaco-2);">PLANO DE PARCELAS</div>' +
    calculo.parcelas.map(function (p) {
      return '<div style="display:flex;justify-content:space-between;padding:var(--espaco-2) 0;border-bottom:1px solid var(--cor-borda);font-size:var(--tamanho-xs);">' +
        '<span>Parcela ' + p.numero + ' — ' + p.vencimentoFormatado + '</span>' +
        '<span style="font-weight:600;">' + Formato.moeda(p.total) + '</span>' +
      '</div>';
    }).join('');
}

async function submeterNovoEmprestimo(e) {
  e.preventDefault();

  if (!EstadoEmprestimos.clienteSelecionado) {
    Alertas.aviso('Cliente não selecionado', 'Pesquise e selecione um cliente para continuar.');
    return;
  }
  if (!Validacao.validarFormulario(e.target)) {
    Alertas.aviso('Verifique o formulário', 'Alguns campos precisam de correção.');
    return;
  }

  const dados = {
    clienteCodigo: EstadoEmprestimos.clienteSelecionado.codigo,
    valorSolicitado: Mascara.valorNumerico(document.getElementById('emprestimo-valor-solicitado')),
    valorAprovado: document.getElementById('emprestimo-valor-aprovado').value
      ? Mascara.valorNumerico(document.getElementById('emprestimo-valor-aprovado'))
      : undefined,
    taxaJuros: parseFloat(document.getElementById('emprestimo-taxa-juros').value),
    prazo: parseInt(document.getElementById('emprestimo-prazo').value, 10),
    unidadePrazo: document.getElementById('emprestimo-unidade-prazo').value,
    numeroParcelas: parseInt(document.getElementById('emprestimo-numero-parcelas').value, 10),
    dataDesembolso: document.getElementById('emprestimo-data-desembolso').value,
    observacoes: document.getElementById('emprestimo-observacoes').value.trim()
  };

  const botao = document.getElementById('botao-criar-emprestimo');
  Utils.definirBotaoCarregando(botao, true, 'A criar...');

  const resposta = await API.chamar('criarEmprestimo', dados);

  Utils.definirBotaoCarregando(botao, false);

  if (!resposta.success) {
    Alertas.erro('Não foi possível criar o empréstimo', resposta.error);
    return;
  }

  Modal.fechar('modal-emprestimo');
  Alertas.sucesso('Empréstimo criado', 'Contrato #' + resposta.data.numeroContrato + ' criado com sucesso, aguardando aprovação.');
  carregarEmprestimos();
}
