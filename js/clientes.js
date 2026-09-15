/**
 * =====================================================================
 * LÓGICA DE CLIENTES — js/clientes.js
 * =====================================================================
 */

const EstadoClientes = {
  pagina: 1,
  porPagina: 10,
  termoPesquisa: '',
  filtroEstado: '',
  emModoEdicao: false
};

document.addEventListener('DOMContentLoaded', function () {
  Layout.inicializar('clientes');

  Mascara.telefone(document.getElementById('cliente-telefone'));
  Mascara.telefone(document.getElementById('cliente-telefone-alt'));
  Mascara.telefone(document.getElementById('cliente-fiador-telefone'));
  Mascara.bi(document.getElementById('cliente-bi'));
  Mascara.nuit(document.getElementById('cliente-nuit'));

  carregarClientes();

  document.getElementById('botao-novo-cliente').addEventListener('click', abrirModalNovoCliente);
  document.getElementById('form-cliente').addEventListener('submit', submeterFormularioCliente);

  document.getElementById('filtro-pesquisa-clientes').addEventListener('input', Utils.debounce(function (e) {
    EstadoClientes.termoPesquisa = e.target.value.trim();
    EstadoClientes.pagina = 1;
    carregarClientes();
  }, 400));

  document.getElementById('filtro-estado-clientes').addEventListener('change', function (e) {
    EstadoClientes.filtroEstado = e.target.value;
    EstadoClientes.pagina = 1;
    carregarClientes();
  });

  // Se a página foi aberta com ?editar=CODIGO (ex.: vindo do perfil do cliente),
  // abre automaticamente o modal de edição correspondente.
  const codigoParaEditar = Utils.obterParametroUrl('editar');
  if (codigoParaEditar) {
    editarCliente(codigoParaEditar);
  }
});

/* =====================================================================
   CARREGAMENTO E RENDERIZAÇÃO DA TABELA
   ===================================================================== */

async function carregarClientes() {
  const corpo = document.getElementById('tabela-clientes-corpo');
  corpo.innerHTML = '<tr class="linha-carregando"><td colspan="7"><div class="linha-carregando-conteudo"><div class="girador"></div> A carregar...</div></td></tr>';

  let resposta;
  if (EstadoClientes.termoPesquisa) {
    resposta = await API.chamar('pesquisarClientes', { termo: EstadoClientes.termoPesquisa });
    if (resposta.success) {
      resposta = { success: true, data: { itens: resposta.data, total: resposta.data.length, pagina: 1, totalPaginas: 1 } };
    }
  } else {
    resposta = await API.chamar('listarClientes', {
      pagina: EstadoClientes.pagina,
      porPagina: EstadoClientes.porPagina,
      estado: EstadoClientes.filtroEstado
    });
  }

  if (!resposta.success) {
    corpo.innerHTML = '<tr><td colspan="7"><div class="estado-vazio"><i class="fa-solid fa-triangle-exclamation"></i><div class="estado-vazio__titulo">Erro ao carregar</div><div class="estado-vazio__texto">' + Utils.escaparHtml(resposta.error) + '</div></div></td></tr>';
    return;
  }

  renderizarTabelaClientes(resposta.data.itens);
  renderizarPaginacao(resposta.data);
}

function renderizarTabelaClientes(clientes) {
  const corpo = document.getElementById('tabela-clientes-corpo');

  if (!clientes.length) {
    corpo.innerHTML = '<tr><td colspan="7"><div class="estado-vazio"><i class="fa-solid fa-user-slash"></i><div class="estado-vazio__titulo">Nenhum cliente encontrado</div><div class="estado-vazio__texto">Tente ajustar a pesquisa ou os filtros, ou cadastre um novo cliente.</div></div></td></tr>';
    return;
  }

  corpo.innerHTML = clientes.map(function (c) {
    const classeBadge = Formato.classeBadge(c.estado);
    return (
      '<tr>' +
        '<td><span class="texto-numerico texto-secundario">' + Utils.escaparHtml(c.codigo) + '</span></td>' +
        '<td>' +
          '<div class="tabela-dados__nome-principal">' + Utils.escaparHtml(c.nomeCompleto || '(sem nome)') + '</div>' +
          '<div class="tabela-dados__linha-secundaria">' + Utils.escaparHtml(c.profissao || 'Sem profissão indicada') + '</div>' +
        '</td>' +
        '<td>' + Utils.escaparHtml(c.bi || '—') + '</td>' +
        '<td>' + Utils.escaparHtml(c.telefone || '—') + '</td>' +
        '<td>' + Utils.escaparHtml(c.bairro || '—') + (c.distrito ? ' / ' + Utils.escaparHtml(c.distrito) : '') + '</td>' +
        '<td><span class="badge badge--' + classeBadge + '">' + Utils.escaparHtml(c.estado) + '</span></td>' +
        '<td class="col-acoes">' +
          '<div class="grupo-acoes-tabela">' +
            '<button class="botao-acao-tabela" title="Ver perfil" data-acao="ver-perfil-cliente" data-codigo="' + Utils.escaparHtml(c.codigo) + '"><i class="fa-solid fa-eye"></i></button>' +
            '<button class="botao-acao-tabela" title="Editar" data-acao="editar-cliente" data-codigo="' + Utils.escaparHtml(c.codigo) + '"><i class="fa-solid fa-pen"></i></button>' +
            '<button class="botao-acao-tabela botao-acao-tabela--perigo" title="Excluir" data-acao="excluir-cliente" data-codigo="' + Utils.escaparHtml(c.codigo) + '" data-nome="' + Utils.escaparHtml(c.nomeCompleto || '(sem nome)') + '"><i class="fa-solid fa-trash-can"></i></button>' +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');
}

/**
 * Delegação de eventos para os botões de ação da tabela (ver perfil, editar,
 * excluir). Os dados vêm de atributos data-* já devidamente escapados por
 * Utils.escaparHtml ao renderizar a linha, em vez de serem injetados
 * diretamente em atributos onclick="..." — isso evita que um nome de cliente
 * com aspas ou apóstrofo (ex.: "João D'Alva") quebre o HTML da página.
 */
document.addEventListener('click', function (e) {
  const botao = e.target.closest('[data-acao]');
  if (!botao) return;

  const acao = botao.dataset.acao;
  const codigo = botao.dataset.codigo;

  if (acao === 'ver-perfil-cliente') {
    window.location.href = 'cliente-perfil.html?codigo=' + encodeURIComponent(codigo);
  } else if (acao === 'editar-cliente') {
    editarCliente(codigo);
  } else if (acao === 'excluir-cliente') {
    confirmarExclusaoCliente(codigo, botao.dataset.nome);
  }
});

function renderizarPaginacao(dadosPagina) {
  const info = document.getElementById('paginacao-info-clientes');
  const controlos = document.getElementById('paginacao-controlos-clientes');

  const inicio = dadosPagina.total === 0 ? 0 : (dadosPagina.pagina - 1) * (EstadoClientes.porPagina) + 1;
  const fim = Math.min(dadosPagina.pagina * EstadoClientes.porPagina, dadosPagina.total);
  info.textContent = dadosPagina.total === 0 ? 'Nenhum resultado' : ('A mostrar ' + inicio + '–' + fim + ' de ' + dadosPagina.total);

  if (EstadoClientes.termoPesquisa) { controlos.innerHTML = ''; return; }

  let html = '<button class="paginacao-botao" ' + (dadosPagina.pagina <= 1 ? 'disabled' : '') + ' onclick="mudarPaginaClientes(' + (dadosPagina.pagina - 1) + ')"><i class="fa-solid fa-chevron-left"></i></button>';

  const totalPaginas = dadosPagina.totalPaginas || 1;
  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || Math.abs(i - dadosPagina.pagina) <= 1) {
      html += '<button class="paginacao-botao ' + (i === dadosPagina.pagina ? 'ativo' : '') + '" onclick="mudarPaginaClientes(' + i + ')">' + i + '</button>';
    } else if (Math.abs(i - dadosPagina.pagina) === 2) {
      html += '<span style="padding:0 4px;color:var(--cor-texto-secundario);">…</span>';
    }
  }

  html += '<button class="paginacao-botao" ' + (dadosPagina.pagina >= totalPaginas ? 'disabled' : '') + ' onclick="mudarPaginaClientes(' + (dadosPagina.pagina + 1) + ')"><i class="fa-solid fa-chevron-right"></i></button>';
  controlos.innerHTML = html;
}

function mudarPaginaClientes(novaPagina) {
  EstadoClientes.pagina = novaPagina;
  carregarClientes();
}

/* =====================================================================
   MODAL DE CADASTRO / EDIÇÃO
   ===================================================================== */

function abrirModalNovoCliente() {
  EstadoClientes.emModoEdicao = false;
  document.getElementById('form-cliente').reset();
  document.getElementById('cliente-codigo-original').value = '';
  document.getElementById('modal-cliente-titulo').textContent = 'Novo Cliente';
  document.getElementById('grupo-cliente-estado').style.display = 'none';
  Validacao.limparErros(document.getElementById('form-cliente'));
  Modal.abrir('modal-cliente');
}

async function editarCliente(codigo) {
  Utils.mostrarCarregamento(true, 'A carregar dados do cliente...');
  const resposta = await API.chamar('obterCliente', { codigo: codigo });
  Utils.mostrarCarregamento(false);

  if (!resposta.success) {
    Alertas.erro('Erro', resposta.error);
    return;
  }

  const c = resposta.data;
  EstadoClientes.emModoEdicao = true;

  document.getElementById('cliente-codigo-original').value = c.codigo;
  document.getElementById('cliente-nome').value = c.nomeCompleto || '';
  document.getElementById('cliente-bi').value = c.bi || '';
  document.getElementById('cliente-nuit').value = c.nuit || '';
  document.getElementById('cliente-sexo').value = c.sexo || '';
  document.getElementById('cliente-nascimento').value = Formato.paraInputDate(c.dataNascimento);
  document.getElementById('cliente-profissao').value = c.profissao || '';
  document.getElementById('cliente-telefone').value = c.telefone || '';
  document.getElementById('cliente-telefone-alt').value = c.telefoneAlternativo || '';
  document.getElementById('cliente-email').value = c.email || '';
  document.getElementById('cliente-endereco').value = c.endereco || '';
  document.getElementById('cliente-bairro').value = c.bairro || '';
  document.getElementById('cliente-distrito').value = c.distrito || '';
  document.getElementById('cliente-provincia').value = c.provincia || '';
  document.getElementById('cliente-fiador-nome').value = c.nomeFiador || '';
  document.getElementById('cliente-fiador-telefone').value = c.telefoneFiador || '';
  document.getElementById('cliente-observacoes').value = c.observacoes || '';

  document.getElementById('grupo-cliente-estado').style.display = 'block';
  const radioEstado = document.querySelector('input[name="cliente-estado"][value="' + (c.estado || 'Ativo') + '"]');
  if (radioEstado) radioEstado.checked = true;

  document.getElementById('modal-cliente-titulo').textContent = 'Editar Cliente — ' + (c.nomeCompleto || '(sem nome)');
  Validacao.limparErros(document.getElementById('form-cliente'));
  Modal.abrir('modal-cliente');
}

async function submeterFormularioCliente(e) {
  e.preventDefault();
  const form = e.target;

  if (!Validacao.validarFormulario(form)) {
    Alertas.aviso('Verifique o formulário', 'Alguns campos precisam de correção.');
    return;
  }

  const dados = {
    nomeCompleto: document.getElementById('cliente-nome').value.trim(),
    bi: document.getElementById('cliente-bi').value.trim(),
    nuit: document.getElementById('cliente-nuit').value.trim(),
    telefone: document.getElementById('cliente-telefone').value.trim(),
    telefoneAlternativo: document.getElementById('cliente-telefone-alt').value.trim(),
    email: document.getElementById('cliente-email').value.trim(),
    sexo: document.getElementById('cliente-sexo').value,
    dataNascimento: document.getElementById('cliente-nascimento').value ? Formato.data(document.getElementById('cliente-nascimento').value) : '',
    profissao: document.getElementById('cliente-profissao').value.trim(),
    endereco: document.getElementById('cliente-endereco').value.trim(),
    bairro: document.getElementById('cliente-bairro').value.trim(),
    distrito: document.getElementById('cliente-distrito').value.trim(),
    provincia: document.getElementById('cliente-provincia').value,
    nomeFiador: document.getElementById('cliente-fiador-nome').value.trim(),
    telefoneFiador: document.getElementById('cliente-fiador-telefone').value.trim(),
    observacoes: document.getElementById('cliente-observacoes').value.trim()
  };

  const botao = document.getElementById('botao-guardar-cliente');
  Utils.definirBotaoCarregando(botao, true, 'A guardar...');

  let resposta;
  if (EstadoClientes.emModoEdicao) {
    dados.codigo = document.getElementById('cliente-codigo-original').value;
    dados.estado = document.querySelector('input[name="cliente-estado"]:checked').value;
    resposta = await API.chamar('atualizarCliente', dados);
  } else {
    resposta = await API.chamar('criarCliente', dados);
  }

  Utils.definirBotaoCarregando(botao, false);

  if (!resposta.success) {
    Alertas.erro('Não foi possível guardar', resposta.error);
    return;
  }

  Modal.fechar('modal-cliente');
  Alertas.sucesso('Sucesso', EstadoClientes.emModoEdicao ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
  carregarClientes();
}

/* =====================================================================
   EXCLUSÃO
   ===================================================================== */

function confirmarExclusaoCliente(codigo, nome) {
  Modal.confirmar({
    titulo: 'Excluir cliente',
    texto: 'Tem a certeza que deseja excluir "' + nome + '"? Esta ação não pode ser desfeita.',
    textoConfirmar: 'Excluir',
    tipoPerigo: true,
    aoConfirmar: async function () {
      Utils.mostrarCarregamento(true, 'A excluir...');
      const resposta = await API.chamar('excluirCliente', { codigo: codigo });
      Utils.mostrarCarregamento(false);

      if (!resposta.success) {
        Alertas.erro('Não foi possível excluir', resposta.error);
        return;
      }

      Alertas.sucesso('Cliente excluído', 'O registo foi removido com sucesso.');
      carregarClientes();
    }
  });
}
