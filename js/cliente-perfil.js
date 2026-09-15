/**
 * =====================================================================
 * LÓGICA DO PERFIL DE CLIENTE — js/cliente-perfil.js
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', function () {
  Layout.inicializar('clientes');

  const codigo = Utils.obterParametroUrl('codigo');
  if (!codigo) {
    window.location.href = 'clientes.html';
    return;
  }

  carregarPerfilCliente(codigo);
});

async function carregarPerfilCliente(codigo) {
  const container = document.getElementById('conteudo-perfil-cliente');

  const [respostaCliente, respostaEmprestimos] = await Promise.all([
    API.chamar('obterCliente', { codigo: codigo }),
    API.chamar('listarEmprestimos', { clienteCodigo: codigo, porPagina: 100 })
  ]);

  if (!respostaCliente.success) {
    container.innerHTML = '<div class="estado-vazio"><i class="fa-solid fa-triangle-exclamation"></i><div class="estado-vazio__titulo">Cliente não encontrado</div><div class="estado-vazio__texto">' + Utils.escaparHtml(respostaCliente.error) + '</div></div>';
    return;
  }

  const cliente = respostaCliente.data;
  const emprestimos = respostaEmprestimos.success ? respostaEmprestimos.data.itens : [];

  container.innerHTML = montarHtmlPerfil(cliente, emprestimos);
  ligarAbas();
}

function montarHtmlPerfil(c, emprestimos) {
  const classeBadgeEstado = Formato.classeBadge(c.estado);
  const emprestimosAtivos = emprestimos.filter(function (e) { return e.estado === 'Ativo' || e.estado === 'Em atraso'; });
  const totalEmprestado = emprestimos.reduce(function (s, e) { return s + parseFloat(e.valorAprovado || 0); }, 0);
  const saldoDevedorTotal = emprestimosAtivos.reduce(function (s, e) { return s + parseFloat(e.saldoDevedor || 0); }, 0);

  return (
    '<div class="pagina-cabecalho">' +
      '<div class="perfil-cabecalho" style="margin-bottom:0;">' +
        '<div class="perfil-avatar">' + Formato.iniciais(c.nomeCompleto) + '</div>' +
        '<div class="perfil-info-principal">' +
          '<div class="perfil-nome">' + Utils.escaparHtml(c.nomeCompleto || '(sem nome)') + ' <span class="badge badge--' + classeBadgeEstado + '">' + Utils.escaparHtml(c.estado) + '</span></div>' +
          '<div class="perfil-meta">' +
            '<span><i class="fa-solid fa-id-card"></i> ' + Utils.escaparHtml(c.codigo) + '</span>' +
            '<span><i class="fa-solid fa-phone"></i> ' + Utils.escaparHtml(c.telefone || 'Sem telefone') + '</span>' +
            '<span><i class="fa-solid fa-location-dot"></i> ' + Utils.escaparHtml(c.bairro || 'Sem bairro') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pagina-acoes">' +
        '<a href="emprestimos.html?novo=1&cliente=' + encodeURIComponent(c.codigo) + '" class="botao botao--primario"><i class="fa-solid fa-plus"></i> Novo Empréstimo</a>' +
        '<button class="botao botao--secundario" data-acao="editar-cliente" data-codigo="' + Utils.escaparHtml(c.codigo) + '"><i class="fa-solid fa-pen"></i> Editar</button>' +
      '</div>' +
    '</div>' +

    '<div class="grade-indicadores" style="grid-template-columns: repeat(3, 1fr);">' +
      '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Total de Empréstimos</span><div class="cartao-indicador__valor">' + emprestimos.length + '</div></div>' +
      '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Total Já Emprestado</span><div class="cartao-indicador__valor">' + Formato.moeda(totalEmprestado) + '</div></div>' +
      '<div class="cartao-indicador"><span class="cartao-indicador__rotulo">Saldo Devedor Atual</span><div class="cartao-indicador__valor">' + Formato.moeda(saldoDevedorTotal) + '</div></div>' +
    '</div>' +

    '<div class="abas">' +
      '<button class="aba-botao ativa" data-aba="dados">Dados Pessoais</button>' +
      '<button class="aba-botao" data-aba="emprestimos">Empréstimos (' + emprestimos.length + ')</button>' +
    '</div>' +

    '<div class="aba-painel ativa" data-aba-painel="dados">' +
      '<div class="cartao">' +
        '<div class="lista-info">' +
          criarItemInfo('BI', c.bi || '—') +
          criarItemInfo('NUIT', c.nuit || '—') +
          criarItemInfo('Sexo', c.sexo || '—') +
          criarItemInfo('Data de Nascimento', c.dataNascimento || '—') +
          criarItemInfo('Profissão', c.profissao || '—') +
          criarItemInfo('Email', c.email || '—') +
          criarItemInfo('Telefone Alternativo', c.telefoneAlternativo || '—') +
          criarItemInfo('Endereço', c.endereco || '—') +
          criarItemInfo('Distrito', c.distrito || '—') +
          criarItemInfo('Província', c.provincia || '—') +
          criarItemInfo('Nome do Fiador', c.nomeFiador || '—') +
          criarItemInfo('Telefone do Fiador', c.telefoneFiador || '—') +
        '</div>' +
        (c.observacoes ? '<div class="secao-formulario"><div class="secao-formulario__titulo">Observações</div><p style="font-size:var(--tamanho-sm);color:var(--cor-texto-secundario);">' + Utils.escaparHtml(c.observacoes) + '</p></div>' : '') +
      '</div>' +
    '</div>' +

    '<div class="aba-painel" data-aba-painel="emprestimos">' +
      '<div class="painel-tabela">' +
        '<div class="painel-tabela__scroll">' +
          '<table class="tabela-dados">' +
            '<thead><tr><th>Contrato</th><th>Valor Aprovado</th><th>Saldo Devedor</th><th>Estado</th><th class="col-acoes">Ações</th></tr></thead>' +
            '<tbody>' + (emprestimos.length ? emprestimos.map(linhaEmprestimoPerfil).join('') : '<tr><td colspan="5"><div class="estado-vazio"><i class="fa-solid fa-file-circle-xmark"></i><div class="estado-vazio__titulo">Sem empréstimos</div><div class="estado-vazio__texto">Este cliente ainda não tem nenhum empréstimo registado.</div></div></td></tr>') + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function criarItemInfo(rotulo, valor) {
  return '<div class="lista-info__item"><div class="rotulo">' + rotulo + '</div><div class="valor">' + Utils.escaparHtml(valor) + '</div></div>';
}

function linhaEmprestimoPerfil(e) {
  const classeBadge = Formato.classeBadge(e.estado);
  return (
    '<tr>' +
      '<td><a href="emprestimo-detalhe.html?contrato=' + encodeURIComponent(e.numeroContrato) + '">#' + Utils.escaparHtml(e.numeroContrato) + '</a></td>' +
      '<td class="col-numerica">' + Formato.moeda(e.valorAprovado) + '</td>' +
      '<td class="col-numerica">' + Formato.moeda(e.saldoDevedor) + '</td>' +
      '<td><span class="badge badge--' + classeBadge + '">' + Utils.escaparHtml(e.estado) + '</span></td>' +
      '<td class="col-acoes"><a href="emprestimo-detalhe.html?contrato=' + encodeURIComponent(e.numeroContrato) + '" class="botao-acao-tabela" title="Ver detalhe"><i class="fa-solid fa-eye"></i></a></td>' +
    '</tr>'
  );
}

/**
 * Delegação de eventos para os botões de ação do cabeçalho do perfil
 * (atualmente só "Editar"). Segue o mesmo padrão de data-acao usado em
 * clientes.js, emprestimos.js e config.js.
 */
document.addEventListener('click', function (e) {
  const botao = e.target.closest('[data-acao]');
  if (!botao) return;

  if (botao.dataset.acao === 'editar-cliente') {
    editarCliente(botao.dataset.codigo);
  }
});

function ligarAbas() {
  document.querySelectorAll('.aba-botao').forEach(function (botao) {
    botao.addEventListener('click', function () {
      document.querySelectorAll('.aba-botao').forEach(function (b) { b.classList.remove('ativa'); });
      document.querySelectorAll('.aba-painel').forEach(function (p) { p.classList.remove('ativa'); });
      botao.classList.add('ativa');
      document.querySelector('[data-aba-painel="' + botao.dataset.aba + '"]').classList.add('ativa');
    });
  });
}

/** Redireciona à página de clientes com o modal de edição pronto a abrir (via query param). */
function editarCliente(codigo) {
  window.location.href = 'clientes.html?editar=' + encodeURIComponent(codigo);
}
